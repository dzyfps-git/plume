#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cost;
mod engine;
mod hotkeys;
mod pets;
mod startup;
mod storage;
mod windowing;

use engine::Engine;
use serde_json::{Value, json};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering::SeqCst};
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WindowEvent};
use windowing::Overlay;

/// What the meter shows, in the order its key goes through. The same as in `src/store/settings.ts`.
const VIEWS: [&str; 6] = ["damage", "rdps", "ndps", "healing", "taken", "hits"];

struct Saved {
    path: PathBuf,
    settings: Mutex<Value>,
    /// One save at a time, from writing the file to putting it to work: the main window, the overlay and the keys all save.
    writes: Mutex<()>,
    /// The page the main window opens on, when a key asked for one.
    page: Mutex<String>,
    /// It opens minimized, without taking the screen from the game.
    quiet: AtomicBool,
}

/// Numbers change once a second, because Plume took much of the CPU.
static LIGHT: AtomicBool = AtomicBool::new(false);
/// Above this share of the CPU Plume makes itself lighter, below the other it is itself again. In percent.
const HEAVY: f64 = 6.0;
const EASY: f64 = 3.0;

/// The keys a page reads from the settings, as `read` in `src/store/settings.ts` does: one the file has not got is the default,
/// and the overlay controls leave the key they had before version 2. A key you emptied stays empty.
const KEYS: [(&str, &str); 5] =
    [("overlay", "Ctrl+Alt+F9"), ("edit", "Ctrl+Alt+F10"), ("reset", "Ctrl+Alt+F11"), ("view", "Ctrl+Alt+F12"), ("quick", "Alt+E")];

/// Puts in the keys Windows is to have, so they work before any page saves. True when something changed.
fn fill_keys(settings: &mut Value) -> bool {
    if !settings.is_object() {
        return false;
    }
    let old = settings["version"].as_u64().unwrap_or(0) < 2;
    let mut changed = old;
    if !settings["hotkeys"].is_object() {
        settings["hotkeys"] = json!({});
    }
    for (action, key) in KEYS {
        let now = &settings["hotkeys"][action];
        if !now.is_string() || (action == "quick" && old && now == "Ctrl+Alt+F8") {
            settings["hotkeys"][action] = key.into();
            changed = true;
        }
    }
    if old {
        settings["version"] = 2.into();
    }
    changed
}

/// Everything a page needs to draw its first frame.
#[tauri::command]
fn start_state(app: AppHandle, window: tauri::WebviewWindow, saved: State<Saved>, engine: State<Arc<Engine>>) -> Value {
    let settings = saved.settings.lock().unwrap_or_else(|p| p.into_inner()).clone();
    let mut now = engine.now();
    now["settings"] = settings;
    if window.label() == windowing::MAIN {
        now["page"] = std::mem::take(&mut *saved.page.lock().unwrap_or_else(|p| p.into_inner())).into();
        now["quiet"] = saved.quiet.swap(false, SeqCst).into();
    }
    now["editing"] = windowing::MODES[usize::from(app.state::<Overlay>().editing.load(SeqCst))].into();
    now["pointer"] = app.state::<Overlay>().pointer.load(SeqCst).into();
    now
}

/// Keeps the settings and puts them to work. Gives back the actions whose key could not be had.
#[tauri::command(async)]
fn save_settings(app: AppHandle, saved: State<Saved>, value: Value) -> Result<Vec<String>, String> {
    let _one = saved.writes.lock().unwrap_or_else(|p| p.into_inner());
    put(&app, &saved, value)
}

/// Writes the settings and puts them to work. The caller holds `writes`.
fn put(app: &AppHandle, saved: &Saved, value: Value) -> Result<Vec<String>, String> {
    storage::save(&saved.path, &value)?;
    let before = std::mem::replace(&mut *saved.settings.lock().unwrap_or_else(|p| p.into_inner()), value.clone());
    let _ = app.emit("settings", &value);
    Ok(apply(app, &before, &value))
}

fn apply(app: &AppHandle, before: &Value, settings: &Value) -> Vec<String> {
    let engine = app.state::<Arc<Engine>>();
    let overlay = app.state::<Overlay>();
    overlay.on.store(settings["overlay"]["on"].as_bool().unwrap_or(true), SeqCst);
    overlay.only_in_game.store(settings["overlay"]["onlyInGame"].as_bool().unwrap_or(true), SeqCst);
    overlay.sleep.store(settings["sleep"].as_bool().unwrap_or(true), SeqCst);
    let startup = settings["startup"].as_bool().unwrap_or(false);
    // Nothing is written to Windows until you turn it on, nor by a test with its own files.
    if startup != before["startup"].as_bool().unwrap_or(false) && std::env::var_os("PLUME_DATA").is_none()
        && let Err(e) = startup::set(startup)
    {
        eprintln!("{e}");
    }
    if settings["lighten"] != true {
        LIGHT.store(false, SeqCst);
    }
    let _ = engine.send(json!({ "cmd": "rate", "ms": rate(settings) }));
    // Only when it changed: a training run has a mode of its own until its page closes.
    if before["mode"] != settings["mode"] {
        let _ = engine.send(json!({ "cmd": "mode", "mode": settings["mode"].as_str().unwrap_or("bossTargets") }));
    }
    if before["training"] != settings["training"] {
        train(&engine, settings);
    }
    if before["record"] != settings["record"] {
        record(app, settings);
    }
    engine.fights.keep.store(settings["fights"]["keep"].as_u64().unwrap_or(0) as usize, SeqCst);
    // Weighing buffs costs time, so only while the meter shows something of it.
    let weigh = settings["meter"]["buffShare"] == true || settings["meter"]["view"].as_str().is_some_and(|v| v.ends_with("dps"));
    let _ = engine.send(json!({ "cmd": "credit", "on": weigh }));
    engine.want(settings["live"].as_bool().unwrap_or(false));
    let keys = settings["hotkeys"].as_object().into_iter().flatten();
    hotkeys::set(keys.map(|(action, key)| (action.clone(), key.as_str().unwrap_or_default().to_string())).collect())
}

/// Whether a dummy turns training on by itself, and how long a run is.
fn train(engine: &Engine, settings: &Value) {
    let ms = settings["training"]["seconds"].as_i64().unwrap_or(0) * 1000;
    let _ = engine.send(json!({ "cmd": "train", "auto": settings["training"]["auto"] == true, "ms": ms }));
}

/// Records the session into a file of its own, or stops.
fn record(app: &AppHandle, settings: &Value) {
    let path = (settings["record"] == true).then(|| recordings_folder(app)).filter(|f| std::fs::create_dir_all(f).is_ok()).map(|f| {
        let seconds = std::time::UNIX_EPOCH.elapsed().map_or(0, |d| d.as_secs());
        f.join(format!("session-{seconds}.txt"))
    });
    let _ = app.state::<Arc<Engine>>().send(json!({ "cmd": "record", "path": path }));
}

fn recordings_folder(app: &AppHandle) -> PathBuf {
    app.state::<Saved>().path.with_file_name("recordings")
}

#[tauri::command(async)]
fn open_recordings_folder(app: AppHandle) -> Result<(), String> {
    show_folder(recordings_folder(&app))
}

/// The last skills each window asked to watch: when one closes, what another still watches is asked for again.
static WATCHES: Mutex<Vec<(String, Value)>> = Mutex::new(Vec::new());

/// Forgets what a closed window watched, and gives the watch another window still wants, if any.
fn unwatch(label: &str) -> Value {
    let mut all = WATCHES.lock().unwrap_or_else(|p| p.into_inner());
    all.retain(|(l, _)| l != label);
    all.iter().rev().map(|(_, c)| c).find(|c| !c["id"].is_null()).cloned().unwrap_or_else(|| json!({ "cmd": "watch" }))
}

#[tauri::command]
fn engine_send(app: AppHandle, window: tauri::Window, engine: State<Arc<Engine>>, command: Value) -> Result<(), String> {
    if command["cmd"] == "watch" {
        let mut all = WATCHES.lock().unwrap_or_else(|p| p.into_inner());
        all.retain(|(l, _)| l != window.label());
        all.push((window.label().to_string(), command.clone()));
    }
    // Where a file is written is not for a page to say.
    if command["cmd"] == "record" {
        return Err("not from here".into());
    }
    if command["cmd"] == "reset" {
        let _ = app.emit("cleared", ());
    }
    engine.send(command)
}

/// Settings and fights in one file, in Downloads.
#[tauri::command(async)]
fn backup(app: AppHandle, saved: State<Saved>, engine: State<Arc<Engine>>, name: String) -> Result<(), String> {
    let settings = saved.settings.lock().unwrap_or_else(|p| p.into_inner()).clone();
    let all = json!({ "plume": 1, "settings": settings, "fights": engine.fights.all() });
    export(app, name, all.to_string().into_bytes())
}

/// What a backup held: its settings take the place of yours, its fights come beside yours. Gives back how many.
/// How many fights are kept and whether the session is recorded stay as they are on this PC, and a fight you have is not written over.
#[tauri::command(async)]
fn restore(app: AppHandle, saved: State<Saved>, engine: State<Arc<Engine>>, value: Value) -> Result<usize, String> {
    let fights = value["fights"].as_array().filter(|_| value["plume"] == 1 && value["settings"].is_object());
    let fights = fights.ok_or("This is not a backup of Plume.")?;
    let mut settings = value["settings"].clone();
    {
        let now = saved.settings.lock().unwrap_or_else(|p| p.into_inner());
        settings["record"] = now["record"].as_bool().unwrap_or(false).into();
        settings["fights"]["keep"] = now["fights"]["keep"].clone();
    }
    let mut count = 0;
    for fight in fights {
        let fight = storage::kept(fight);
        let id = fight["id"].as_str().unwrap_or_default();
        if !fight["you"].is_null() && engine.fights.load(id).is_none() && engine.fights.save(&fight).is_ok() {
            count += 1;
        }
    }
    save_settings(app.clone(), saved, settings)?;
    let _ = app.emit("saved", json!({ "id": "" }));
    Ok(count)
}

/// What of the overlay takes the mouse, when it is not being edited.
#[tauri::command]
fn set_zones(app: AppHandle, zones: Vec<[i32; 4]>) {
    *app.state::<Overlay>().zones.lock().unwrap_or_else(|p| p.into_inner()) = zones;
}

/// Opens the main window on a page.
#[tauri::command(async)]
fn open_page(app: AppHandle, page: String) {
    if app.get_webview_window(windowing::MAIN).is_some() {
        let _ = app.emit("go", &page);
    } else {
        *app.state::<Saved>().page.lock().unwrap_or_else(|p| p.into_inner()) = page;
    }
    windowing::show_main(&app);
}

/// How often the engine says its numbers: as set, or once a second while Plume is made lighter.
fn rate(settings: &Value) -> i64 {
    if LIGHT.load(SeqCst) { 1000 } else { settings["updateMs"].as_i64().unwrap_or(250) }
}

/// Plume's share of the CPU, and whether it made itself lighter.
#[tauri::command]
fn cost() -> Value {
    json!({ "cpu": f64::from(cost::CPU.load(SeqCst)) / 10.0, "light": LIGHT.load(SeqCst) })
}

/// The game is there: the page you chose opens, minimized if the window was closed, so the game keeps the screen.
pub(crate) fn game_came(app: &AppHandle) {
    let page = app.state::<Saved>().settings.lock().unwrap_or_else(|p| p.into_inner())["gameOpens"].as_str().unwrap_or_default().to_string();
    if page.is_empty() {
        return;
    }
    if app.get_webview_window(windowing::MAIN).is_some() {
        let _ = app.emit("go", &page);
        return;
    }
    let saved = app.state::<Saved>();
    *saved.page.lock().unwrap_or_else(|p| p.into_inner()) = page;
    saved.quiet.store(true, SeqCst);
    windowing::show_main(app);
}

/// Opens the page for another screen, or closes it.
#[tauri::command(async)]
fn second_screen(app: AppHandle) {
    if open_second(&app) {
        edit_settings(&app, &|s| s["second"]["open"] = true.into());
    }
}

fn open_second(app: &AppHandle) -> bool {
    let second = app.state::<Saved>().settings.lock().unwrap_or_else(|p| p.into_inner())["second"].clone();
    windowing::second(app, serde_json::from_value(second["at"].clone()).ok(), second["full"] == true)
}

/// Remembers where the page for another screen is, and whether it opens with Plume.
fn keep_second(app: &AppHandle, place: Option<(windowing::Rect, bool)>, open: bool) {
    edit_settings(app, &|s| {
        s["second"]["open"] = open.into();
        if let Some((at, full)) = place {
            s["second"]["at"] = json!(at);
            s["second"]["full"] = full.into();
        }
    });
}

/// Nothing before the first start is done: what is written then would pass for settings.
fn edit_settings(app: &AppHandle, edit: &dyn Fn(&mut Value)) {
    let saved = app.state::<Saved>();
    let _one = saved.writes.lock().unwrap_or_else(|p| p.into_inner());
    let mut settings = saved.settings.lock().unwrap_or_else(|p| p.into_inner()).clone();
    if !settings.is_object() {
        return;
    }
    edit(&mut settings);
    if let Err(e) = put(app, &saved, settings) {
        eprintln!("{e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn closing_a_window_gives_back_what_another_watches() {
        WATCHES.lock().unwrap().extend([("overlay".to_string(), json!({ "cmd": "watch", "id": 7 })), ("main".to_string(), json!({ "cmd": "watch", "id": 9 }))]);
        assert_eq!(unwatch("main"), json!({ "cmd": "watch", "id": 7 }));
        assert_eq!(unwatch("overlay"), json!({ "cmd": "watch" }));
    }

    #[test]
    fn keys_are_there_before_a_page_saves() {
        let mut old = json!({ "version": 1, "hotkeys": { "quick": "Ctrl+Alt+F8", "edit": "" } });
        assert!(fill_keys(&mut old));
        assert_eq!(old["hotkeys"]["quick"], "Alt+E");
        assert_eq!(old["hotkeys"]["edit"], "", "an emptied key stays empty");
        assert_eq!(old["hotkeys"]["overlay"], "Ctrl+Alt+F9");
        let mut missing = json!({ "version": 2, "hotkeys": {} });
        assert!(fill_keys(&mut missing) && missing["hotkeys"]["quick"] == "Alt+E");
        let mut chosen = json!({ "version": 2, "hotkeys": { "quick": "Ctrl+Alt+F8", "overlay": "", "edit": "", "reset": "", "view": "" } });
        assert!(!fill_keys(&mut chosen) && chosen["hotkeys"]["quick"] == "Ctrl+Alt+F8");
        assert!(!fill_keys(&mut Value::Null));
    }
}

#[tauri::command(async)]
fn fights(engine: State<Arc<Engine>>) -> Vec<Value> {
    engine.fights.list()
}

#[tauri::command(async)]
fn fight(engine: State<Arc<Engine>>, id: String) -> Option<Value> {
    engine.fight(&id)
}

#[tauri::command(async)]
fn delete_fight(engine: State<Arc<Engine>>, id: String) -> Result<(), String> {
    engine.forget(&id)
}

/// Your part of a fight alone, as it is on the disk.
#[tauri::command(async)]
fn kept_fight(engine: State<Arc<Engine>>, id: String) -> Option<Value> {
    engine.fights.load(&id)
}

/// Writes a file you asked for into Downloads, and shows it.
#[tauri::command(async)]
fn export(app: AppHandle, name: String, bytes: Vec<u8>) -> Result<(), String> {
    let folder = app.path().download_dir().map_err(|e| e.to_string())?;
    let path = storage::export(&folder, &name, &bytes)?;
    std::process::Command::new("explorer").arg("/select,").arg(path).spawn().map(drop).map_err(|e| e.to_string())
}

#[tauri::command(async)]
fn edit_overlays(app: AppHandle, mode: String) {
    let mode = windowing::MODES.iter().position(|m| *m == mode).unwrap_or(0);
    windowing::edit(&app, mode as u8);
}

#[tauri::command(async)]
fn sound_files(app: AppHandle) -> Result<Vec<String>, String> {
    Ok(storage::sounds(&sounds_folder(&app)?))
}

#[tauri::command(async)]
fn sound_file(app: AppHandle, name: String) -> Result<tauri::ipc::Response, String> {
    storage::sound(&sounds_folder(&app)?, &name).map(tauri::ipc::Response::new)
}

#[tauri::command(async)]
fn open_sounds_folder(app: AppHandle) -> Result<(), String> {
    show_folder(sounds_folder(&app)?)
}

fn pictures_folder(app: &AppHandle) -> Result<PathBuf, String> {
    data(app, "icons")
}

/// `world` or `icons` in the data folder, or else beside Plume, where a full installer puts them.
fn data(app: &AppHandle, part: &str) -> Result<PathBuf, String> {
    let own = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join(part);
    let filled = |d: &PathBuf| d.read_dir().is_ok_and(|mut files| files.next().is_some());
    if filled(&own) {
        return Ok(own);
    }
    Ok(app.path().resource_dir().map(|d| d.join(part)).ok().filter(filled).unwrap_or(own))
}

#[tauri::command(async)]
fn pictures(app: AppHandle) -> Result<Value, String> {
    Ok(storage::pictures(&pictures_folder(&app)?))
}

#[tauri::command(async)]
fn picture(app: AppHandle, name: String) -> Result<tauri::ipc::Response, String> {
    storage::picture(&pictures_folder(&app)?, &name).map(tauri::ipc::Response::new)
}

/// Maps, pets and drops, made by the engine's `tools/world.py`.
#[tauri::command(async)]
fn world_file(app: AppHandle, name: String) -> Result<tauri::ipc::Response, String> {
    storage::world(&data(&app, "world")?, &name).map(tauri::ipc::Response::new)
}

#[tauri::command(async)]
fn open_pictures_folder(app: AppHandle) -> Result<(), String> {
    show_folder(pictures_folder(&app)?)
}

fn sounds_folder(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("sounds"))
}

fn show_folder(folder: PathBuf) -> Result<(), String> {
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    std::process::Command::new("explorer").arg(folder).spawn().map(drop).map_err(|e| e.to_string())
}

/// Plume's own data folder: where a friend puts the `world` and `icons` folders you give them.
#[tauri::command(async)]
fn open_data_folder(app: AppHandle) -> Result<(), String> {
    show_folder(app.path().app_local_data_dir().map_err(|e| e.to_string())?)
}

/// Copies the maps, names and pictures, made from public data on this PC, into a folder on the Desktop to give a friend.
/// Your settings, fights and characters stay here. Gives back how many files were copied.
#[tauri::command(async)]
fn share_data(app: AppHandle) -> Result<usize, String> {
    let to = app.path().desktop_dir().map_err(|e| e.to_string())?.join("Plume data for a friend");
    let mut copied = 0;
    for part in ["world", "icons"] {
        let (source, target) = (data(&app, part)?, to.join(part));
        std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        for entry in std::fs::read_dir(&source).map_err(|e| format!("{part}: {e}"))?.flatten() {
            if entry.file_type().is_ok_and(|t| t.is_file()) {
                std::fs::copy(entry.path(), target.join(entry.file_name())).map_err(|e| e.to_string())?;
                copied += 1;
            }
        }
    }
    let note = "Put the folders world and icons into Plume's data folder: in Plume, Settings, About, \"Open the data folder\".
                They are made from public data with their own terms (GPL-3.0, CC BY-NC 4.0): for you, not for sale or for others.
";
    std::fs::write(to.join("Read me.txt"), note).map_err(|e| e.to_string())?;
    show_folder(to)?;
    Ok(copied)
}

#[tauri::command(async)]
fn open_engine_folder(app: AppHandle) -> Result<(), String> {
    show_folder(engine_folder(&app)?)
}

fn engine_folder(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("engine"))
}

/// Stops a running stopwatch, goes on with a stopped one, or starts one: as `toggle` in `src/features/time/logic.ts`.
fn stopwatch(clock: &mut Value) {
    let now = std::time::UNIX_EPOCH.elapsed().map_or(0, |d| d.as_millis() as u64);
    let at = |key: &str| clock[key].as_u64().unwrap_or(0);
    let (start, stopped) = (at("start"), at("stopped"));
    let (start, stopped) = match (start, stopped) {
        (0, _) => (now, 0),
        (_, 0) => (start, now),
        _ => (start + now.saturating_sub(stopped), 0),
    };
    if !clock.is_object() {
        *clock = json!({ "end": 0 });
    }
    clock["start"] = start.into();
    clock["stopped"] = stopped.into();
}

fn turn(value: &mut Value, unset: bool) {
    *value = (!value.as_bool().unwrap_or(unset)).into();
}

/// A key pressed over the game. Never on the main thread: a window cannot be built from inside its loop.
fn pressed(app: &AppHandle, action: &str) {
    let overlay = app.state::<Overlay>();
    let set = |edit: &dyn Fn(&mut Value)| edit_settings(app, edit);
    match action {
        "overlay" => set(&|s| s["overlay"]["on"] = (!overlay.on.load(SeqCst)).into()),
        "view" => set(&|s| {
            let at = VIEWS.iter().position(|v| s["meter"]["view"] == *v).unwrap_or(0);
            s["meter"]["view"] = VIEWS[(at + 1) % VIEWS.len()].into();
        }),
        "edit" | "quick" => {
            let mode = if action == "edit" { windowing::MOVE } else { windowing::QUICK };
            windowing::edit(app, if overlay.editing.load(SeqCst) == mode { windowing::NONE } else { mode });
        }
        "reset" => {
            let _ = app.emit("cleared", ());
            let _ = app.state::<Arc<Engine>>().send(json!({ "cmd": "reset" }));
        }
        "peek" => {
            let _ = app.emit("peek", ());
        }
        "compact" => set(&|s| turn(&mut s["meter"]["small"], false)),
        "lock" => set(&|s| turn(&mut s["meter"]["locked"], true)),
        "discreet" => set(&|s| turn(&mut s["discreet"], false)),
        // Both are off until you turn them on.
        "buffs" | "actions" => set(&|s| turn(&mut s["places"][action]["on"], false)),
        "second" => second_screen(app.clone()),
        "stopwatch" => set(&|s| stopwatch(&mut s["clock"])),
        "history" | "details" | "settings" => open_page(app.clone(), action.into()),
        _ => {}
    }
}

fn tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Plume", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let mut tray = TrayIconBuilder::new()
        .tooltip("Plume")
        .menu(&Menu::with_items(app, &[&open, &quit])?)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id().as_ref() {
            "quit" => app.exit(0),
            _ => open_main(app),
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                open_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app).map(drop)
}

fn open_main(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || windowing::show_main(&app));
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| open_main(app)))
        .manage(Overlay::default())
        .invoke_handler(tauri::generate_handler![
            start_state,
            save_settings,
            engine_send,
            fights,
            fight,
            kept_fight,
            delete_fight,
            export,
            edit_overlays,
            open_engine_folder,
            open_recordings_folder,
            backup,
            restore,
            set_zones,
            open_page,
            second_screen,
            sound_files,
            sound_file,
            open_sounds_folder,
            pictures,
            picture,
            open_pictures_folder,
            world_file,
            cost,
            open_data_folder,
            share_data
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            // Tests and the bench keep their files elsewhere, so yours stay as they are.
            let folder = match std::env::var_os("PLUME_DATA") {
                Some(folder) => PathBuf::from(folder),
                None => app.path().app_local_data_dir()?,
            };
            let path = folder.join("settings.json");
            let mut settings = storage::load(&path).unwrap_or(Value::Null);
            // Written down before the keys are taken from it: an upgrade has the keys the pages show.
            if fill_keys(&mut settings)
                && let Err(e) = storage::save(&path, &settings)
            {
                eprintln!("{e}");
            }
            app.manage(Saved { path, settings: Mutex::new(settings.clone()), writes: Mutex::default(), page: Mutex::default(), quiet: AtomicBool::new(false) });

            let name = "plume-engine.exe";
            let mut places: Vec<PathBuf> = std::env::var_os("PLUME_ENGINE").map(PathBuf::from).into_iter().collect();
            places.extend(std::env::current_exe().ok().and_then(|e| Some(e.parent()?.join(name))));
            places.push(engine_folder(&handle)?.join(name));
            let tell = handle.clone();
            let engine = Engine::new(
                places,
                storage::Fights::new(folder.join("fights")),
                Box::new(move |event, value| {
                    if event == "live" && value["t"] == "pets" {
                        edit_settings(&tell, &|s| {
                            let (levels, souls) = pets::hear(&s["pets"], value);
                            s["pets"]["levels"] = levels;
                            s["pets"]["souls"] = souls;
                            if value["what"] == "all" {
                                s["pets"]["told"] = std::time::UNIX_EPOCH.elapsed().map_or(0, |d| d.as_millis() as u64).into();
                            }
                        });
                    }
                    let _ = tell.emit(event, value);
                }),
            );
            engine.start();
            app.manage(engine);

            let keys = handle.clone();
            hotkeys::start(move |action| {
                let (app, action) = (keys.clone(), action.to_string());
                std::thread::spawn(move || pressed(&app, &action));
            });
            // The first start has no settings: the page makes them and saves.
            if settings.is_object() {
                apply(&handle, &settings, &settings);
                train(&handle.state::<Arc<Engine>>(), &settings);
                record(&handle, &settings);
                let _ = handle.state::<Arc<Engine>>().send(json!({ "cmd": "mode", "mode": settings["mode"].as_str().unwrap_or("bossTargets") }));
            }
            tray(&handle)?;
            // Windows starting it is no reason to open a window. Without settings it is the first start.
            if !settings.is_object() || !std::env::args().any(|a| a == startup::HIDDEN) {
                windowing::show_main(&handle);
            }
            if settings["second"]["open"] == true {
                open_second(&handle);
            }
            let light = handle.clone();
            cost::watch(move |percent| {
                let settings = light.state::<Saved>().settings.lock().unwrap_or_else(|p| p.into_inner()).clone();
                let was = LIGHT.load(SeqCst);
                let now = settings["lighten"] == true && if was { percent > EASY } else { percent > HEAVY };
                if now != was {
                    LIGHT.store(now, SeqCst);
                    let _ = light.state::<Arc<Engine>>().send(json!({ "cmd": "rate", "ms": rate(&settings) }));
                }
            });
            windowing::point(handle.clone());
            windowing::watch(handle);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Plume could not start");

    app.run(|app, e| match e {
        // A page that closes with its window cannot put back what it asked of the engine.
        RunEvent::WindowEvent { label, event: WindowEvent::Destroyed, .. } => {
            let engine = app.state::<Arc<Engine>>();
            let watch = unwatch(&label);
            if label == windowing::MAIN {
                let settings = app.state::<Saved>().settings.lock().unwrap_or_else(|p| p.into_inner()).clone();
                let mode = settings["mode"].as_str().unwrap_or("bossTargets");
                for command in [json!({ "cmd": "limit", "ms": 0 }), json!({ "cmd": "mode", "mode": mode })] {
                    let _ = engine.send(command);
                }
            }
            let _ = engine.send(watch);
        }
        // Unless you chose that closing it quits. Before you chose, the page asks.
        RunEvent::WindowEvent { label, event: WindowEvent::CloseRequested { .. }, .. }
            if label == windowing::MAIN && {
                let s = app.state::<Saved>().settings.lock().unwrap_or_else(|p| p.into_inner()).clone();
                s["close"] == "quit" && s["closeAsked"] == true
            } =>
        {
            app.exit(0);
        }
        RunEvent::WindowEvent { label, event: WindowEvent::CloseRequested { .. }, .. } if label == windowing::SECOND => {
            let (app, place) = (app.clone(), windowing::second_at(app));
            std::thread::spawn(move || keep_second(&app, place, false));
        }
        RunEvent::ExitRequested { code: Some(_), .. } if app.get_webview_window(windowing::SECOND).is_some() => {
            keep_second(app, windowing::second_at(app), true);
        }
        // Closing the main window leaves the overlays over the game. The tray quits.
        RunEvent::ExitRequested { api, code: None, .. } => api.prevent_exit(),
        // The engine says its open fights before it goes.
        RunEvent::Exit => app.state::<Arc<Engine>>().finish(),
        _ => {}
    });
}
