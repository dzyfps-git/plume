#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine;
mod hotkeys;
mod storage;
mod windowing;

use engine::Engine;
use serde_json::{Value, json};
use std::path::PathBuf;
use std::sync::atomic::Ordering::SeqCst;
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WindowEvent};
use windowing::Overlay;

/// What the meter shows, in the order its key goes through. The same as in `src/store/settings.ts`.
const VIEWS: [&str; 5] = ["damage", "rdps", "healing", "taken", "hits"];

struct Saved {
    path: PathBuf,
    settings: Mutex<Value>,
}

/// Everything a page needs to draw its first frame.
#[tauri::command]
fn start_state(app: AppHandle, saved: State<Saved>, engine: State<Arc<Engine>>) -> Value {
    let settings = saved.settings.lock().unwrap_or_else(|p| p.into_inner()).clone();
    let mut now = engine.now();
    now["settings"] = settings;
    now["editing"] = app.state::<Overlay>().editing.load(SeqCst).into();
    now
}

/// Keeps the settings and puts them to work. Gives back the actions whose key could not be had.
#[tauri::command(async)]
fn save_settings(app: AppHandle, saved: State<Saved>, value: Value) -> Result<Vec<String>, String> {
    storage::save(&saved.path, &value)?;
    let before = std::mem::replace(&mut *saved.settings.lock().unwrap_or_else(|p| p.into_inner()), value.clone());
    let _ = app.emit("settings", &value);
    Ok(apply(&app, &before, &value))
}

fn apply(app: &AppHandle, before: &Value, settings: &Value) -> Vec<String> {
    let engine = app.state::<Arc<Engine>>();
    let overlay = app.state::<Overlay>();
    overlay.on.store(settings["overlay"]["on"].as_bool().unwrap_or(true), SeqCst);
    overlay.only_in_game.store(settings["overlay"]["onlyInGame"].as_bool().unwrap_or(true), SeqCst);
    let _ = engine.send(json!({ "cmd": "rate", "ms": settings["updateMs"].as_i64().unwrap_or(250) }));
    // Only when it changed: a training run has a mode of its own until its page closes.
    if before["mode"] != settings["mode"] {
        let _ = engine.send(json!({ "cmd": "mode", "mode": settings["mode"].as_str().unwrap_or("bossTargets") }));
    }
    // Weighing buffs costs time, so only while it is what the meter shows.
    let _ = engine.send(json!({ "cmd": "credit", "on": settings["meter"]["view"] == "rdps" }));
    engine.want(settings["live"].as_bool().unwrap_or(false));
    let key = |action: &str| settings["hotkeys"][action].as_str().unwrap_or_default().to_string();
    hotkeys::set(["overlay", "edit", "reset", "view"].map(|a| (a.to_string(), key(a))).to_vec())
}

#[tauri::command]
fn engine_send(engine: State<Arc<Engine>>, command: Value) -> Result<(), String> {
    engine.send(command)
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
fn edit_overlays(app: AppHandle, on: bool) {
    windowing::edit(&app, on);
}

#[tauri::command(async)]
fn open_engine_folder(app: AppHandle) -> Result<(), String> {
    let folder = engine_folder(&app)?;
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    std::process::Command::new("explorer").arg(folder).spawn().map(drop).map_err(|e| e.to_string())
}

fn engine_folder(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("engine"))
}

/// A key pressed over the game. Never on the main thread: a window cannot be built from inside its loop.
fn pressed(app: &AppHandle, action: &str) {
    let overlay = app.state::<Overlay>();
    let set = |edit: &dyn Fn(&mut Value)| {
        let saved = app.state::<Saved>();
        let mut settings = saved.settings.lock().unwrap_or_else(|p| p.into_inner()).clone();
        edit(&mut settings);
        if let Err(e) = save_settings(app.clone(), saved, settings) {
            eprintln!("{e}");
        }
    };
    match action {
        "overlay" => set(&|s| s["overlay"]["on"] = (!overlay.on.load(SeqCst)).into()),
        "view" => set(&|s| {
            let at = VIEWS.iter().position(|v| s["meter"]["view"] == *v).unwrap_or(0);
            s["meter"]["view"] = VIEWS[(at + 1) % VIEWS.len()].into();
        }),
        "edit" => windowing::edit(app, !overlay.editing.load(SeqCst)),
        "reset" => {
            let _ = app.state::<Arc<Engine>>().send(json!({ "cmd": "reset" }));
        }
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
            open_engine_folder
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            // Tests and the bench keep their files elsewhere, so yours stay as they are.
            let folder = match std::env::var_os("PLUME_DATA") {
                Some(folder) => PathBuf::from(folder),
                None => app.path().app_local_data_dir()?,
            };
            let path = folder.join("settings.json");
            let settings = storage::load(&path).unwrap_or(Value::Null);
            app.manage(Saved { path, settings: Mutex::new(settings.clone()) });

            let name = "plume-engine.exe";
            let mut places: Vec<PathBuf> = std::env::var_os("PLUME_ENGINE").map(PathBuf::from).into_iter().collect();
            places.extend(std::env::current_exe().ok().and_then(|e| Some(e.parent()?.join(name))));
            places.push(engine_folder(&handle)?.join(name));
            let tell = handle.clone();
            let engine = Engine::new(
                places,
                storage::Fights::new(folder.join("fights")),
                Box::new(move |event, value| {
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
                apply(&handle, &Value::Null, &settings);
            }
            tray(&handle)?;
            windowing::show_main(&handle);
            windowing::watch(handle);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Plume could not start");

    app.run(|app, e| match e {
        // A page that closes with its window cannot put back what it asked of the engine.
        RunEvent::WindowEvent { label, event: WindowEvent::Destroyed, .. } if label == windowing::MAIN => {
            let engine = app.state::<Arc<Engine>>();
            let settings = app.state::<Saved>().settings.lock().unwrap_or_else(|p| p.into_inner()).clone();
            let mode = settings["mode"].as_str().unwrap_or("bossTargets");
            for command in [json!({ "cmd": "limit", "ms": 0 }), json!({ "cmd": "mode", "mode": mode }), json!({ "cmd": "watch" })] {
                let _ = engine.send(command);
            }
        }
        // Closing the main window leaves the overlays over the game. The tray quits.
        RunEvent::ExitRequested { api, code: None, .. } => api.prevent_exit(),
        // The engine says its open fights before it goes.
        RunEvent::Exit => app.state::<Arc<Engine>>().finish(),
        _ => {}
    });
}
