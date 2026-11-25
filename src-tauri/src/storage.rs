//! JSON files in the app's own folder. A save never leaves half a file.

use serde_json::{Map, Value, json};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering::SeqCst};
use std::sync::{Mutex, MutexGuard};

/// Writes beside the file, then takes its place. The one before stays as `.bak`.
pub fn save(path: &Path, value: &Value) -> Result<(), String> {
    let say = |e: std::io::Error| format!("{}: {e}", path.display());
    if let Some(folder) = path.parent() {
        fs::create_dir_all(folder).map_err(say)?;
    }
    let fresh = path.with_extension("tmp");
    let mut file = fs::File::create(&fresh).map_err(say)?;
    file.write_all(value.to_string().as_bytes()).and_then(|()| file.sync_all()).map_err(say)?;
    drop(file);
    if path.exists() {
        let _ = fs::copy(path, path.with_extension("bak"));
    }
    fs::rename(&fresh, path).map_err(say)
}

/// The file, or its backup when the file is missing or damaged.
pub fn load(path: &Path) -> Option<Value> {
    let read = |p: &Path| serde_json::from_str(&fs::read_to_string(p).ok()?).ok();
    read(path).or_else(|| read(&path.with_extension("bak")))
}

/// Writes a file to share. The name is made plain, and nothing there is written over.
pub fn export(folder: &Path, name: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    let (stem, kind) = name.rsplit_once('.').unwrap_or((name, ""));
    if !["csv", "json", "png"].contains(&kind) {
        return Err("not a file to share".into());
    }
    let plain: String = stem.chars().map(|c| if c.is_ascii_alphanumeric() || " -_".contains(c) { c } else { '-' }).take(80).collect();
    for n in 1..1000 {
        let tail = if n == 1 { String::new() } else { format!(" {n}") };
        let path = folder.join(format!("Plume {plain}{tail}.{kind}"));
        match fs::OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => return file.write_all(bytes).map(|()| path).map_err(|e| e.to_string()),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(e) => return Err(format!("{}: {e}", path.display())),
        }
    }
    Err("too many files of this name".into())
}

const SOUNDS: [&str; 5] = ["wav", "mp3", "ogg", "m4a", "flac"];
/// A warning is short. A longer file is a mistake.
const SOUND_BYTES: u64 = 8 << 20;

/// The sound files you put into your folder.
pub fn sounds(folder: &Path) -> Vec<String> {
    let files = fs::read_dir(folder).into_iter().flatten().flatten();
    let mut names: Vec<String> = files.filter_map(|e| e.file_name().into_string().ok()).filter(|n| is_sound(n)).collect();
    names.sort_by_key(|n| n.to_lowercase());
    names.truncate(200);
    names
}

fn is_sound(name: &str) -> bool {
    let kind = name.rsplit_once('.').map_or(String::new(), |(_, k)| k.to_ascii_lowercase());
    SOUNDS.contains(&kind.as_str()) && !name.contains(['/', '\\', ':'])
}

/// One of them. A name that walks to another folder is refused.
pub fn sound(folder: &Path, name: &str) -> Result<Vec<u8>, String> {
    if !is_sound(name) {
        return Err("not a sound file".into());
    }
    let path = folder.join(name);
    let say = |e: std::io::Error| format!("{name}: {e}");
    if fs::metadata(&path).map_err(say)?.len() > SOUND_BYTES {
        return Err(format!("{name} is too long"));
    }
    fs::read(&path).map_err(say)
}

/// A small picture of a skill or an effect. A larger file is a mistake.
const PICTURE_BYTES: u64 = 1 << 20;

/// Which picture each skill and effect has. Nothing when there are no pictures.
pub fn pictures(folder: &Path) -> Value {
    let path = folder.join("index.json");
    let fits = fs::metadata(&path).is_ok_and(|m| m.len() <= PICTURE_BYTES);
    let text = if fits { fs::read_to_string(path).ok() } else { None };
    text.and_then(|t| serde_json::from_str(t.trim_start_matches('\u{feff}')).ok()).unwrap_or(Value::Null)
}

/// One of them. Its name is letters, digits and `_` alone, so it cannot leave the folder.
pub fn picture(folder: &Path, name: &str) -> Result<Vec<u8>, String> {
    if name.is_empty() || name.len() > 80 || !name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') {
        return Err("not a picture".into());
    }
    let path = folder.join(format!("{name}.png"));
    let say = |e: std::io::Error| format!("{name}: {e}");
    if fs::metadata(&path).map_err(say)?.len() > PICTURE_BYTES {
        return Err(format!("{name} is too large"));
    }
    let bytes = fs::read(&path).map_err(say)?;
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { Ok(bytes) } else { Err(format!("{name} is not a PNG")) }
}

/// Finished fights, one file each.
pub struct Fights {
    folder: PathBuf,
    /// What the list shows of each, read once: the files are long.
    briefs: Mutex<Option<HashMap<String, Value>>>,
    /// How many are kept, 0 for all.
    pub keep: AtomicUsize,
}

impl Fights {
    pub fn new(folder: PathBuf) -> Self {
        Self { folder, briefs: Mutex::new(None), keep: AtomicUsize::new(0) }
    }

    fn briefs(&self) -> MutexGuard<'_, Option<HashMap<String, Value>>> {
        self.briefs.lock().unwrap_or_else(|p| p.into_inner())
    }

    fn file(&self, id: &str) -> Result<PathBuf, String> {
        // The id becomes a file name, so nothing in it may walk to another folder.
        let plain = |c: char| c.is_ascii_alphanumeric() || c == '_' || c == '-';
        if id.is_empty() || id.len() > 80 || !id.chars().all(plain) {
            return Err("not a fight".into());
        }
        Ok(self.folder.join(format!("{id}.json")))
    }

    pub fn save(&self, fight: &Value) -> Result<(), String> {
        let id = fight["id"].as_str().unwrap_or_default();
        let path = self.file(id)?;
        save(&path, fight)?;
        if let Some(all) = self.briefs().as_mut() {
            all.insert(id.into(), brief(fight.clone()));
        }
        // A fight is written again as it grows, and the last is the whole of it.
        let _ = fs::remove_file(path.with_extension("bak"));
        let keep = self.keep.load(SeqCst);
        if keep > 0 {
            for old in self.list().iter().skip(keep) {
                let _ = self.delete(old["id"].as_str().unwrap_or_default());
            }
        }
        Ok(())
    }

    /// Every fight, whole.
    pub fn all(&self) -> Vec<Value> {
        self.list().iter().filter_map(|f| self.load(f["id"].as_str()?)).collect()
    }

    pub fn load(&self, id: &str) -> Option<Value> {
        load(&self.file(id).ok()?)
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        fs::remove_file(self.file(id)?).map_err(|e| e.to_string())?;
        if let Some(all) = self.briefs().as_mut() {
            all.remove(id);
        }
        Ok(())
    }

    /// Every fight without its long lists, newest first.
    pub fn list(&self) -> Vec<Value> {
        let mut briefs = self.briefs();
        let known = briefs.get_or_insert_with(|| {
            let files = fs::read_dir(&self.folder).into_iter().flatten().flatten().map(|e| e.path());
            let json = files.filter(|p| p.extension().is_some_and(|e| e == "json"));
            let all = json.filter_map(|p| load(&p)).map(brief);
            all.map(|f| (f["id"].as_str().unwrap_or_default().to_string(), f)).collect()
        });
        let mut all: Vec<Value> = known.values().cloned().collect();
        all.sort_by_key(|f| std::cmp::Reverse(f["start"].as_i64().unwrap_or(0)));
        all
    }
}

fn brief(mut fight: Value) -> Value {
    if let Some(f) = fight.as_object_mut() {
        let left = f.get("health").and_then(Value::as_array).and_then(|h| h.last()).cloned();
        f.insert("left".into(), left.unwrap_or_else(|| (-1).into()));
        for long in ["curve", "health", "casts", "taken", "blows", "names", "deaths", "stagger", "buffs", "stats", "pings"] {
            f.remove(long);
        }
        if let Some(you) = f.get_mut("you").and_then(Value::as_object_mut) {
            for long in ["skills", "heals", "curve"] {
                you.remove(long);
            }
        }
    }
    fight
}

/// Lists of a fight that name no player.
const OURS: [&str; 20] = [
    "id", "target", "code", "start", "ms", "total", "maxHp", "killed", "dummy", "dungeon", "run", "lost", "curve",
    "health", "casts", "taken", "blows", "names", "stats", "pings",
];

fn list<'a>(fight: &'a Value, key: &str) -> &'a [Value] {
    fight[key].as_array().map_or(&[], Vec::as_slice)
}

/// What of a kept fight may come back from a backup: what would have been written down, and nothing more.
pub fn kept(fight: &Value) -> Value {
    let own = ["deaths", "stagger", "buffs", "you", "others", "players"];
    let all = fight.as_object().into_iter().flatten();
    Value::Object(all.filter(|(k, _)| OURS.contains(&k.as_str()) || own.contains(&k.as_str())).map(|(k, v)| (k.clone(), v.clone())).collect())
}

/// What may be written down of a fight. Other players become one sum: no names, classes, ids or numbers of theirs.
pub fn only_yours(fight: &Value) -> Value {
    let rows = list(fight, "rows");
    let damage = |r: &&Value| r["damage"].as_i64().unwrap_or(0);
    let others: Vec<&Value> = rows.iter().filter(|r| r["you"] != true).collect();
    let you = rows.iter().find(|r| r["you"] == true).cloned().unwrap_or(Value::Null);
    let mut kept = Map::new();
    for key in OURS {
        if let Some(value) = fight.get(key) {
            kept.insert(key.into(), value.clone());
        }
    }
    let player = |id: &Value| rows.iter().any(|r| r["id"] == *id);
    let mine = |id: &Value| !you.is_null() && *id == you["id"];
    let stranger = |id: &Value| player(id) && !mine(id);

    let deaths: Vec<&Value> = list(fight, "deaths").iter().filter(|d| d["you"] == true).collect();
    kept.insert("deaths".into(), json!(deaths));
    let buffs: Vec<Value> = list(fight, "buffs")
        .iter()
        // Yours, and what the boss put on itself: that names no player.
        .filter(|b| mine(&b["on"]) || (!player(&b["on"]) && (mine(&b["by"]) || b["by"] == b["on"])))
        .map(|b| {
            let mut b = b.clone();
            // Someone else's: that it was there matters, not whose it was.
            if stranger(&b["by"]) {
                b["by"] = 0.into();
            }
            b
        })
        .collect();
    kept.insert("buffs".into(), buffs.into());
    let stagger: Vec<Value> = list(fight, "stagger")
        .iter()
        .map(|w| {
            let (mut own, mut rest) = (0, 0);
            for (id, value) in w["by"].as_object().into_iter().flatten() {
                let value = value.as_i64().unwrap_or(0);
                if you["id"].as_i64().is_some_and(|y| y.to_string() == *id) { own += value } else { rest += value }
            }
            let mut by = Map::new();
            if let Some(id) = you["id"].as_i64() {
                by.insert(id.to_string(), own.into());
            }
            by.insert("0".into(), rest.into());
            let mut w = w.clone();
            w["by"] = by.into();
            w
        })
        .collect();
    kept.insert("stagger".into(), stagger.into());
    kept.insert("you".into(), you);
    kept.insert("others".into(), others.iter().map(damage).sum::<i64>().into());
    kept.insert("players".into(), rows.len().into());
    Value::Object(kept)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn folder(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("plume-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        path
    }

    #[test]
    fn a_damaged_file_gives_its_backup() {
        let path = folder("backup").join("settings.json");
        save(&path, &json!({ "a": 1 })).unwrap();
        save(&path, &json!({ "a": 2 })).unwrap();
        fs::write(&path, "{").unwrap();
        assert_eq!(load(&path), Some(json!({ "a": 1 })));
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn a_saved_fight_holds_nothing_of_other_players() {
        let fight = json!({
            "id": "auto_1_2", "target": "Boss", "start": 5, "ms": 9, "total": 30, "secret": 1,
            "casts": [[0, 5, 10, 1]],
            "rows": [
                { "id": 4111, "name": "Stranger", "job": "cleric", "damage": 20, "you": false },
                { "id": 2, "name": "Me", "job": "ranger", "damage": 10, "you": true },
            ],
            "deaths": [{ "id": 4111, "you": false, "ms": 3, "hits": [] }, { "id": 2, "you": true, "ms": 4, "hits": [] }],
            "buffs": [
                { "id": 7, "on": 2, "by": 4111 }, { "id": 8, "on": 4111, "by": 2 }, { "id": 9, "on": 900, "by": 2 },
                { "id": 10, "on": 900, "by": 4111 }, { "id": 11, "on": 2, "by": 900 },
                { "id": 12, "on": 900, "by": 900 }, { "id": 13, "on": 4111, "by": 4111 },
            ],
            "stagger": [{ "start": 1, "by": { "2": 30, "4111": 70, "900": 5 } }],
            "credits": [{ "by": 4111, "to": 2, "damage": 5 }],
        });
        let kept = only_yours(&fight);
        assert_eq!((&kept["you"]["name"], &kept["others"], &kept["players"]), (&json!("Me"), &json!(20), &json!(2)));
        assert_eq!(kept["deaths"].as_array().unwrap().len(), 1);
        let buffs: Vec<_> = list(&kept, "buffs").iter().map(|b| (b["id"].as_i64().unwrap(), b["by"].as_i64().unwrap())).collect();
        assert_eq!(buffs, [(7, 0), (9, 2), (11, 900), (12, 900)]);
        assert_eq!((&kept["stagger"][0]["by"], &kept["casts"][0][2]), (&json!({ "2": 30, "0": 75 }), &json!(10)));
        let text = kept.to_string();
        assert!(!text.contains("4111") && !text.contains("credits"));
        assert!(!text.contains("Stranger") && !text.contains("cleric") && !text.contains("rows") && !text.contains("secret"));
    }

    #[test]
    fn a_shared_file_stays_in_its_folder_and_writes_over_nothing() {
        let here = folder("export");
        fs::create_dir_all(&here).unwrap();
        let first = export(&here, "../a:b.csv", b"1").unwrap();
        assert_eq!(first, here.join("Plume ---a-b.csv"));
        assert_ne!(export(&here, "../a:b.csv", b"2").unwrap(), first);
        assert_eq!(fs::read(first).unwrap(), b"1");
        assert!(export(&here, "a.exe", b"").is_err() && export(&here, "a", b"").is_err());
        fs::remove_dir_all(here).unwrap();
    }

    #[test]
    fn only_sounds_of_their_own_folder_are_read() {
        let here = folder("sounds");
        fs::create_dir_all(&here).unwrap();
        for name in ["b.wav", "A.MP3", "c.txt"] {
            fs::write(here.join(name), "x").unwrap();
        }
        assert_eq!(sounds(&here), ["A.MP3", "b.wav"]);
        assert_eq!(sound(&here, "b.wav").unwrap(), b"x");
        for bad in ["c.txt", "../b.wav", "..\\b.wav", "C:b.wav", "none.wav", ""] {
            assert!(sound(&here, bad).is_err(), "{bad}");
        }
        fs::remove_dir_all(&here).unwrap();
        assert!(sounds(&here).is_empty());
    }

    #[test]
    fn only_pictures_of_their_own_folder_are_read() {
        let here = folder("pictures");
        fs::create_dir_all(&here).unwrap();
        let png = b"\x89PNG\r\n\x1a\nrest";
        fs::write(here.join("ICON_A_1.png"), png).unwrap();
        fs::write(here.join("fake.png"), "<svg/>").unwrap();
        fs::write(here.join("index.json"), r#"{"skills":{"1335":"ICON_A_1"}}"#).unwrap();
        assert_eq!(picture(&here, "ICON_A_1").unwrap(), png);
        assert_eq!(pictures(&here)["skills"]["1335"], "ICON_A_1");
        for bad in ["fake", "none", "", "../ICON_A_1", "ICON_A_1.png", "a b", "C:x"] {
            assert!(picture(&here, bad).is_err(), "{bad}");
        }
        fs::remove_dir_all(&here).unwrap();
        assert!(pictures(&here).is_null());
    }

    #[test]
    fn fights_are_listed_newest_first_and_an_id_cannot_leave_the_folder() {
        let fights = Fights::new(folder("fights"));
        let fight = |id: &str, start: i64| json!({ "id": id, "start": start, "curve": [1], "health": [9, 4], "you": { "name": "Me", "skills": [1] } });
        fights.save(&fight("a", 1)).unwrap();
        assert_eq!(fights.list().len(), 1);
        fights.save(&fight("b", 2)).unwrap();
        let list = fights.list();
        assert_eq!((&list[0]["left"], list[0].get("health")), (&json!(4), None));
        assert_eq!((list.len(), &list[0]["id"]), (2, &json!("b")));
        assert!(list[0].get("curve").is_none() && list[0]["you"].get("skills").is_none());
        assert_eq!(fights.load("a").unwrap()["curve"], json!([1]));
        for bad in ["", "..", "../a", "a/b", "C:\\x"] {
            assert!(fights.delete(bad).is_err(), "{bad}");
        }
        fights.delete("a").unwrap();
        assert!(fights.load("a").is_none() && fights.list().len() == 1);
        fights.keep.store(2, SeqCst);
        fights.save(&fight("c", 3)).unwrap();
        fights.save(&fight("d", 4)).unwrap();
        let ids: Vec<_> = fights.all().iter().map(|f| f["id"].as_str().unwrap().to_string()).collect();
        assert_eq!(ids, ["d", "c"]);
        let back = kept(&json!({ "id": "x", "you": 1, "rows": [1], "credits": [], "casts": [2] }));
        assert_eq!(back, json!({ "id": "x", "you": 1, "casts": [2] }));
        fs::remove_dir_all(&fights.folder).unwrap();
    }
}
