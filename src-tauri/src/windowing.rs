//! Plume's own windows: the main one, and one clear window over the game that holds every overlay.

use crate::engine::Engine;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering::SeqCst};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use windows::Win32::Foundation::POINT;
use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MONITOR_DEFAULTTOPRIMARY, MONITORINFO, MonitorFromWindow};
use windows::Win32::UI::WindowsAndMessaging::{GetCursorPos, GetForegroundWindow, GetWindowTextW};

pub const MAIN: &str = "main";
pub const OVERLAY: &str = "overlay";
const LOOK: Duration = Duration::from_millis(400);
/// How often it is asked whether the pointer is on a button, while there are buttons.
const POINT_LOOK: Duration = Duration::from_millis(30);
/// The overlay window is closed once the game is gone for this long.
const SLEEP: Duration = Duration::from_secs(60);
/// What the overlay window is open for. The pages know them by these names.
pub const MODES: [&str; 3] = ["", "move", "quick"];
pub const NONE: u8 = 0;
pub const MOVE: u8 = 1;
pub const QUICK: u8 = 2;
/// How the game names its window.
const GAME: [&str; 2] = ["AION 2", "AION2"];

#[derive(Default)]
pub struct Overlay {
    pub on: AtomicBool,
    pub only_in_game: AtomicBool,
    pub sleep: AtomicBool,
    /// One of `MODES`.
    pub editing: AtomicU8,
    place: Mutex<(i32, i32, i32, i32)>,
    /// What takes the mouse, in points of the screen from the window's corner: left, top, right, bottom.
    pub zones: Mutex<Vec<[i32; 4]>>,
    /// Two threads ask for the window. A half-built one would lose what the other tells it.
    building: Mutex<()>,
}

/// Opens the main window, or brings it forward.
pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let built = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App("index.html".into()))
        .title("Plume")
        .inner_size(1120.0, 720.0)
        .min_inner_size(760.0, 480.0)
        .decorations(false)
        // The page shows it once there is something to see.
        .visible(false)
        .build();
    if let Err(e) = built {
        eprintln!("{e}");
    }
}

fn overlay(app: &AppHandle) -> Option<WebviewWindow> {
    let state = app.state::<Overlay>();
    let _building = state.building.lock().unwrap_or_else(|p| p.into_inner());
    if let Some(w) = app.get_webview_window(OVERLAY) {
        return Some(w);
    }
    let w = WebviewWindowBuilder::new(app, OVERLAY, WebviewUrl::App("overlay.html".into()))
        .title("Plume overlay")
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .focusable(false)
        .visible(false)
        .build()
        .inspect_err(|e| eprintln!("{e}"))
        .ok()?;
    let _ = w.set_ignore_cursor_events(true);
    Some(w)
}

/// Lets the overlays be moved or the quick bar be used, or passes every click to the game again.
pub fn edit(app: &AppHandle, mode: u8) {
    let state = app.state::<Overlay>();
    if state.editing.swap(mode, SeqCst) == mode {
        return;
    }
    let on = mode != NONE;
    if let Some(w) = overlay(app) {
        let _ = w.set_ignore_cursor_events(!on);
        let _ = w.set_focusable(on);
        if on {
            place(app, &w);
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
    let _ = app.emit("edit", MODES[usize::from(mode)]);
}

/// Covers the screen of the window in front: the game's when it plays, yours while you edit.
fn place(app: &AppHandle, w: &WebviewWindow) {
    let mut info = MONITORINFO { cbSize: size_of::<MONITORINFO>() as u32, ..Default::default() };
    let found = unsafe { GetMonitorInfoW(MonitorFromWindow(GetForegroundWindow(), MONITOR_DEFAULTTOPRIMARY), &mut info) };
    if !found.as_bool() {
        return;
    }
    let r = info.rcMonitor;
    let now = (r.left, r.top, r.right - r.left, r.bottom - r.top);
    let state = app.state::<Overlay>();
    let mut last = state.place.lock().unwrap_or_else(|p| p.into_inner());
    if *last != now {
        *last = now;
        let _ = w.set_position(PhysicalPosition::new(now.0, now.1));
        let _ = w.set_size(PhysicalSize::new(now.2 as u32, now.3 as u32));
    }
}

/// Gives the mouse to the overlay while the pointer is on something of it that takes clicks, and back to the game after.
pub fn point(app: AppHandle) {
    std::thread::spawn(move || {
        let mut taking = false;
        loop {
            let state = app.state::<Overlay>();
            let zones = state.zones.lock().unwrap_or_else(|p| p.into_inner()).clone();
            let window = app.get_webview_window(OVERLAY);
            if state.editing.load(SeqCst) != NONE || window.is_none() || zones.is_empty() && !taking {
                taking = false;
                std::thread::sleep(LOOK);
                continue;
            }
            let (left, top, ..) = *state.place.lock().unwrap_or_else(|p| p.into_inner());
            let mut at = POINT::default();
            let inside = unsafe { GetCursorPos(&mut at) }.is_ok() && within(&zones, at.x - left, at.y - top);
            if inside != taking && let Some(w) = window {
                taking = inside;
                let _ = w.set_ignore_cursor_events(!inside);
            }
            std::thread::sleep(POINT_LOOK);
        }
    });
}

fn within(zones: &[[i32; 4]], x: i32, y: i32) -> bool {
    zones.iter().any(|z| (z[0]..z[2]).contains(&x) && (z[1]..z[3]).contains(&y))
}

/// The title Windows keeps for the window in front. Nothing is asked of the game itself.
fn game_in_front() -> bool {
    let mut text = [0u16; 64];
    let n = unsafe { GetWindowTextW(GetForegroundWindow(), &mut text) };
    is_game(&String::from_utf16_lossy(&text[..n.max(0) as usize]))
}

fn is_game(title: &str) -> bool {
    // A browser tab about the game starts the same way, but ends with the browser's name.
    GAME.iter().any(|g| title.starts_with(g)) && !title.contains(" - ") && !title.contains(" — ")
}

/// Shows and hides the overlay as the game comes and goes.
pub fn watch(app: AppHandle) {
    std::thread::spawn(move || {
        let mut shown = false;
        let mut seen = Instant::now();
        loop {
            let state = app.state::<Overlay>();
            let front = game_in_front();
            let wanted = state.editing.load(SeqCst) != NONE
                || state.on.load(SeqCst) && (front || !state.only_in_game.load(SeqCst));
            if wanted && let Some(w) = overlay(&app) {
                if front {
                    place(&app, &w);
                }
                if !shown {
                    place(&app, &w);
                    let _ = w.show();
                    // Windows can drop a window behind a game that just took the screen.
                    let _ = w.set_always_on_top(true);
                }
            } else if !wanted && shown && let Some(w) = app.get_webview_window(OVERLAY) {
                let _ = w.hide();
            }
            shown = wanted;
            if wanted || front || app.state::<Arc<Engine>>().live() {
                seen = Instant::now();
            } else if state.sleep.load(SeqCst)
                && seen.elapsed() > SLEEP
                && let Some(w) = app.get_webview_window(OVERLAY)
            {
                // It holds the most memory of all, for a game that is not there.
                let _ = w.destroy();
                *state.place.lock().unwrap_or_else(|p| p.into_inner()) = Default::default();
            }
            std::thread::sleep(LOOK);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{is_game, within};

    #[test]
    fn a_zone_takes_the_mouse_inside_its_edges() {
        let zones = [[10, 10, 20, 20], [0, 50, 5, 60]];
        assert!(within(&zones, 10, 19) && within(&zones, 4, 50));
        assert!(!within(&zones, 20, 10) && !within(&zones, 9, 10) && !within(&[], 0, 0));
    }

    #[test]
    fn the_game_is_told_from_a_page_about_it() {
        assert!(is_game("AION 2 l Someone") && is_game("AION2"));
        assert!(!is_game("AION 2 guide - Google Chrome") && !is_game("Plume") && !is_game(""));
    }
}
