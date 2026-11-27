//! Keeps the engine running, a program of its own, and passes on what it says. Plume works without it.

use crate::storage::{Fights, only_yours};
use serde_json::{Value, json};
use std::io::{BufRead, BufReader, Write};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::time::{Duration, Instant};

const NO_WINDOW: u32 = 0x0800_0000;
const PROTOCOL: i64 = 1;
/// The engine's own way to say that the network devices changed.
const AGAIN: i32 = 3;
const LONGEST_WAIT: Duration = Duration::from_secs(30);
/// Run this long, it starts fresh: the next fault is a new one.
const STEADY: Duration = Duration::from_secs(60);
/// Whole fights of this session, kept in memory only.
const SESSION: usize = 200;
/// How long an engine told to stop has before it is ended.
const GRACE: Duration = Duration::from_millis(1500);
const COMMANDS: [&str; 8] = ["mode", "rate", "limit", "watch", "credit", "train", "record", "reset"];

type Tell = dyn Fn(&str, &Value) + Send + Sync;

struct Inner {
    wanted: bool,
    running: bool,
    /// The last of each setting, said again to an engine that starts later.
    settings: Vec<(String, Value)>,
    input: Option<ChildStdin>,
    /// The engine that runs now, and how many were started: one told to stop that is still there after a while is ended.
    child: Option<Child>,
    runs: u64,
    status: Value,
    state: Value,
    reads: Value,
    fight: Value,
    near: Value,
    entries: Value,
    /// Where you are. Yours alone, and not kept.
    place: Value,
    session: Vec<Value>,
}

pub struct Engine {
    inner: Mutex<Inner>,
    change: Condvar,
    places: Vec<PathBuf>,
    pub fights: Fights,
    tell: Box<Tell>,
}

impl Engine {
    /// `tell` gets an event's name and value. `places` are the files the engine may be.
    pub fn new(places: Vec<PathBuf>, fights: Fights, tell: Box<Tell>) -> Arc<Self> {
        Arc::new(Self {
            inner: Mutex::new(Inner {
                wanted: false,
                running: false,
                settings: Vec::new(),
                input: None,
                child: None,
                runs: 0,
                status: json!({ "status": "off" }),
                state: Value::Null,
                reads: Value::Null,
                fight: Value::Null,
                near: Value::Null,
                entries: Value::Null,
                place: Value::Null,
                session: Vec::new(),
            }),
            change: Condvar::new(),
            places,
            fights,
            tell,
        })
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|p| p.into_inner())
    }

    pub fn now(&self) -> Value {
        let i = self.lock();
        json!({ "engine": i.status, "state": i.state, "reads": i.reads, "fight": i.fight, "near": i.near, "entries": i.entries, "place": i.place })
    }

    /// The game is connected and talking.
    pub fn live(&self) -> bool {
        self.lock().state["live"] == true
    }

    pub fn start(self: &Arc<Self>) {
        let engine = self.clone();
        std::thread::spawn(move || engine.keep());
    }

    /// Turns live data on or off. An engine that does not stop when asked is ended after a while.
    pub fn want(self: &Arc<Self>, on: bool) {
        let mut i = self.lock();
        if i.wanted == on {
            return;
        }
        i.wanted = on;
        if !on && let Some(mut input) = i.input.take() {
            let _ = writeln!(input, r#"{{"cmd":"stop"}}"#);
            let (engine, run) = (self.clone(), i.runs);
            std::thread::spawn(move || {
                std::thread::sleep(GRACE);
                engine.end(Some(run));
            });
        }
        self.change.notify_all();
    }

    /// Ends the engine that runs, or only the one started as `run`, and waits until it is gone.
    fn end(&self, run: Option<u64>) {
        let child = {
            let mut i = self.lock();
            if run.is_some_and(|r| r != i.runs) {
                return;
            }
            i.child.take()
        };
        if let Some(mut child) = child {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    /// Turns it off and waits a moment, so the fights still open are kept. Then it is ended.
    pub fn finish(self: &Arc<Self>) {
        self.want(false);
        let until = Instant::now() + GRACE;
        while self.lock().running && Instant::now() < until {
            std::thread::sleep(Duration::from_millis(10));
        }
        self.end(None);
    }

    /// Passes a command on. A setting is kept for an engine that starts later.
    pub fn send(&self, command: Value) -> Result<(), String> {
        let name = command["cmd"].as_str().unwrap_or_default().to_string();
        if !COMMANDS.contains(&name.as_str()) {
            return Err(format!("no such command: {name}"));
        }
        let mut i = self.lock();
        if let Some(input) = &mut i.input {
            let _ = writeln!(input, "{command}");
        }
        if name != "reset" {
            i.settings.retain(|(n, _)| *n != name);
            i.settings.push((name, command));
        }
        Ok(())
    }

    /// A fight in full when it is this session's, or your part of it.
    pub fn fight(&self, id: &str) -> Option<Value> {
        let found = self.lock().session.iter().find(|f| f["id"] == id).cloned();
        found.map(with_yours).or_else(|| self.fights.load(id))
    }

    pub fn forget(&self, id: &str) -> Result<(), String> {
        self.lock().session.retain(|f| f["id"] != id);
        self.fights.delete(id)
    }

    fn say(&self, status: &str, message: &str) {
        let value = json!({ "status": status, "message": message });
        {
            let mut i = self.lock();
            if i.status == value {
                return;
            }
            i.status = value.clone();
            if status != "running" {
                i.state = Value::Null;
                i.reads = Value::Null;
                i.near = Value::Null;
                i.entries = Value::Null;
                i.place = Value::Null;
            }
        }
        (self.tell)("engine", &value);
    }

    fn keep(self: Arc<Self>) {
        let mut faults = 0u32;
        loop {
            {
                let mut i = self.lock();
                while !i.wanted {
                    drop(i);
                    self.say("off", "");
                    i = self.lock();
                    if !i.wanted {
                        i = self.change.wait(i).unwrap_or_else(|p| p.into_inner());
                    }
                }
            }
            let begun = Instant::now();
            let ended = match self.places.iter().find(|p| p.is_file()) {
                None => {
                    self.say("missing", "The engine is not installed.");
                    None
                }
                Some(path) => {
                    self.lock().running = true;
                    let code = self.run(path);
                    self.lock().running = false;
                    code
                }
            };
            if !self.lock().wanted || ended == Some(AGAIN) {
                faults = 0;
                continue;
            }
            faults = if begun.elapsed() > STEADY { 1 } else { faults + 1 };
            let wait = Duration::from_secs(1 << faults.min(5)).min(LONGEST_WAIT);
            let i = self.lock();
            drop(self.change.wait_timeout(i, wait));
        }
    }

    /// Runs the engine until it ends. Gives back its exit code.
    fn run(&self, path: &PathBuf) -> Option<i32> {
        self.say("starting", "");
        let mut command = Command::new(path);
        command.arg("serve");
        // For trying things out without the game.
        if let Ok(file) = std::env::var("PLUME_REPLAY") {
            command.args(["--replay", &file]);
        }
        command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).creation_flags(NO_WINDOW);
        let mut child: Child = match command.spawn() {
            Ok(child) => child,
            Err(e) => {
                self.say("failed", &e.to_string());
                return None;
            }
        };
        let (out, err) = (child.stdout.take()?, child.stderr.take()?);
        let fault = std::thread::spawn(move || BufReader::new(err).lines().map_while(Result::ok).last());
        {
            let mut i = self.lock();
            let mut input = child.stdin.take()?;
            for (_, command) in &i.settings {
                let _ = writeln!(input, "{command}");
            }
            if i.wanted {
                i.input = Some(input);
            }
            i.runs += 1;
            i.child = Some(child);
        }
        for line in BufReader::new(out).lines().map_while(Result::ok) {
            let Ok(message) = serde_json::from_str::<Value>(&line) else { continue };
            if message["t"] == "state" && message["protocol"].as_i64() != Some(PROTOCOL) {
                self.lock().input = None;
                self.end(None);
                self.say("failed", "The engine and Plume do not fit together. Update both.");
                return None;
            }
            self.hear(message);
        }
        let child = {
            let mut i = self.lock();
            i.input = None;
            i.child.take()
        };
        // None when it was ended for not stopping.
        let code = child.and_then(|mut c| c.wait().ok()).and_then(|s| s.code());
        let words = fault.join().ok().flatten().unwrap_or_default();
        if self.lock().wanted && code != Some(AGAIN) {
            self.say("failed", if words.is_empty() { "The engine stopped. Starting it again." } else { &words });
        }
        code
    }

    fn hear(&self, message: Value) {
        self.say("running", "");
        match message["t"].as_str() {
            Some("state") => self.lock().state = message.clone(),
            Some("reads") => self.lock().reads = message.clone(),
            Some("fight") => self.lock().fight = message.clone(),
            Some("near") => self.lock().near = message.clone(),
            Some("entries") => self.lock().entries = message.clone(),
            Some("place") => self.lock().place = message.clone(),
            Some("saved") => {
                {
                    let mut i = self.lock();
                    i.session.retain(|f| f["id"] != message["id"]);
                    i.session.push(message.clone());
                    if i.session.len() > SESSION {
                        i.session.remove(0);
                    }
                }
                let kept = only_yours(&message);
                // A fight that was not yours at all is not written down.
                if !kept["you"].is_null()
                    && let Err(e) = self.fights.save(&kept)
                {
                    eprintln!("{e}");
                }
                // With its target, so a page can tell the fight it shows from one kept just before.
                return (self.tell)("saved", &json!({ "id": message["id"], "code": message["code"] }));
            }
            _ => {}
        }
        (self.tell)("live", &message);
    }
}

/// The shape of a saved fight, with what this session still knows of everyone.
fn with_yours(fight: Value) -> Value {
    let mut whole = only_yours(&fight);
    for key in ["rows", "deaths", "stagger", "buffs", "credits"] {
        whole[key] = fight[key].clone();
    }
    whole
}

#[cfg(test)]
mod tests {
    use super::*;

    fn engine(folder: &std::path::Path) -> Arc<Engine> {
        Engine::new(Vec::new(), Fights::new(folder.to_path_buf()), Box::new(|_, _| ()))
    }

    #[test]
    fn only_known_commands_pass_and_the_last_of_each_is_kept() {
        let e = engine(&std::env::temp_dir());
        assert!(e.send(json!({ "cmd": "stop" })).is_err());
        assert!(e.send(json!({ "cmd": "shell" })).is_err());
        for ms in [100, 250] {
            e.send(json!({ "cmd": "rate", "ms": ms })).unwrap();
        }
        e.send(json!({ "cmd": "reset" })).unwrap();
        assert_eq!(e.lock().settings, [("rate".to_string(), json!({ "cmd": "rate", "ms": 250 }))]);
    }

    #[test]
    fn a_finished_fight_is_whole_in_memory_and_yours_alone_on_disk() {
        let folder = std::env::temp_dir().join(format!("plume-test-engine-{}", std::process::id()));
        let e = engine(&folder);
        e.hear(json!({ "t": "saved", "id": "x", "start": 1, "rows": [
            { "name": "Stranger", "damage": 5, "you": false }, { "name": "Me", "damage": 7, "you": true },
        ]}));
        e.hear(json!({ "t": "saved", "id": "y", "start": 2, "rows": [{ "name": "Stranger", "damage": 5, "you": false }]}));
        assert_eq!(e.fight("x").unwrap()["rows"].as_array().unwrap().len(), 2);
        let disk = std::fs::read_to_string(folder.join("x.json")).unwrap();
        assert!(disk.contains("Me") && !disk.contains("Stranger"));
        assert!(!folder.join("y.json").exists());
        std::fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn what_is_near_is_gone_with_the_engine() {
        let e = engine(&std::env::temp_dir());
        e.hear(json!({ "t": "state", "live": true }));
        e.hear(json!({ "t": "near", "party": [{ "name": "Stranger" }] }));
        e.hear(json!({ "t": "place", "map": 20, "x": 1 }));
        assert!(e.live() && e.now()["near"]["party"][0]["name"] == "Stranger" && e.now()["place"]["map"] == 20);
        e.say("failed", "");
        assert!(!e.live() && e.now()["near"].is_null() && e.now()["place"].is_null());
    }

    #[test]
    fn a_missing_engine_is_said_and_off_stays_off() {
        let (send, said) = std::sync::mpsc::channel();
        let tell = move |name: &str, value: &Value| {
            let _ = send.send((name.to_string(), value["status"].as_str().unwrap_or_default().to_string()));
        };
        let e = Engine::new(vec!["C:\\no\\such.exe".into()], Fights::new(std::env::temp_dir()), Box::new(tell));
        e.start();
        e.want(true);
        let wait = Duration::from_secs(5);
        assert_eq!(said.recv_timeout(wait).unwrap(), ("engine".into(), "missing".into()));
        e.want(false);
        assert_eq!(said.recv_timeout(wait).unwrap(), ("engine".into(), "off".into()));
    }
}
