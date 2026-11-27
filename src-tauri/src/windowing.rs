//! Plume's own windows: the main one, and one clear window over the game that holds every overlay.

use crate::engine::Engine;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering::SeqCst};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use std::sync::atomic::AtomicIsize;
use windows::Win32::Foundation::{HWND, POINT};
use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MONITOR_DEFAULTTOPRIMARY, MONITORINFO, MonitorFromWindow};
use windows::Win32::UI::WindowsAndMessaging::{
    CURSOR_SHOWING, CURSORINFO, GetCursorInfo, GetCursorPos, GetForegroundWindow, GetWindowTextW, IsWindow,
};

pub const MAIN: &str = "main";
pub const OVERLAY: &str = "overlay";
pub const SECOND: &str = "second";
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
    /// The mouse pointer shows. While the game hides it to turn the camera, nothing of the overlay takes the mouse.
    pub pointer: AtomicBool,
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

/// Left, top, width and height, in points of the screen.
pub type Rect = [i32; 4];

/// Opens the page for another screen, or closes it. `at` is where it was when it closed. True when it opened.
pub fn second(app: &AppHandle, at: Option<Rect>, full: bool) -> bool {
    let state = app.state::<Overlay>();
    let _building = state.building.lock().unwrap_or_else(|p| p.into_inner());
    if let Some(w) = app.get_webview_window(SECOND) {
        let _ = w.close();
        return false;
    }
    let screens: Vec<Rect> = app
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| [m.position().x, m.position().y, m.size().width as i32, m.size().height as i32])
        .collect();
    // The overlay knows the game's screen. Without it, the game's own window says, wherever it is.
    let game = *state.place.lock().unwrap_or_else(|p| p.into_inner());
    let game = if game.2 > 0 {
        (game.0, game.1)
    } else if let Some(screen) = game_window().and_then(screen_of) {
        (screen.0, screen.1)
    } else {
        app.primary_monitor().ok().flatten().map_or((0, 0), |m| (m.position().x, m.position().y))
    };
    let built = WebviewWindowBuilder::new(app, SECOND, WebviewUrl::App("second.html".into()))
        .title("Plume second screen")
        .min_inner_size(360.0, 280.0)
        .decorations(false)
        // The page shows it once there is something to see.
        .visible(false)
        .build();
    let Ok(w) = built.inspect_err(|e| eprintln!("{e}")) else { return false };
    let [x, y, width, height] = spot(&screens, game, at);
    let _ = w.set_position(PhysicalPosition::new(x, y));
    let _ = w.set_size(PhysicalSize::new(width as u32, height as u32));
    if full {
        let _ = w.maximize();
    }
    true
}

/// Where the page for another screen is now, and whether it fills it. Nothing while it is down.
pub fn second_at(app: &AppHandle) -> Option<(Rect, bool)> {
    let w = app.get_webview_window(SECOND)?;
    if w.is_minimized().unwrap_or(true) {
        return None;
    }
    let (at, size) = (w.outer_position().ok()?, w.inner_size().ok()?);
    Some(([at.x, at.y, size.width as i32, size.height as i32], w.is_maximized().unwrap_or(false)))
}

/// Where it was, while there is still a screen there. Else in the middle of a screen that is not the game's, if there is one.
fn spot(screens: &[Rect], game: (i32, i32), at: Option<Rect>) -> Rect {
    let on = |s: &Rect, x: i32, y: i32| (s[0]..s[0] + s[2]).contains(&x) && (s[1]..s[1] + s[3]).contains(&y);
    if let Some(a) = at.filter(|a| a[2] > 0 && a[3] > 0 && screens.iter().any(|s| on(s, a[0] + a[2] / 2, a[1] + a[3] / 2))) {
        return a;
    }
    let other = screens.iter().find(|s| !on(s, game.0, game.1)).or(screens.first());
    let [x, y, width, height] = other.copied().unwrap_or([0, 0, 1280, 800]);
    let (w, h) = (width * 4 / 5, height * 4 / 5);
    [x + (width - w) / 2, y + (height - h) / 2, w, h]
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
        // Leaving edit mode hides nothing here: the overlay itself is in front then, which the watcher counts as the
        // game, and it hides the overlay on its next look if it is not wanted.
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
    let Some(now) = screen_of(unsafe { GetForegroundWindow() }) else { return };
    let state = app.state::<Overlay>();
    let mut last = state.place.lock().unwrap_or_else(|p| p.into_inner());
    if *last != now {
        *last = now;
        let _ = w.set_position(PhysicalPosition::new(now.0, now.1));
        let _ = w.set_size(PhysicalSize::new(now.2 as u32, now.3 as u32));
    }
}

/// The screen a window is on: left, top, width and height.
fn screen_of(window: HWND) -> Option<(i32, i32, i32, i32)> {
    let mut info = MONITORINFO { cbSize: size_of::<MONITORINFO>() as u32, ..Default::default() };
    let found = unsafe { GetMonitorInfoW(MonitorFromWindow(window, MONITOR_DEFAULTTOPRIMARY), &mut info) };
    let r = info.rcMonitor;
    found.as_bool().then_some((r.left, r.top, r.right - r.left, r.bottom - r.top))
}

/// The game's window as last seen in front. Other programs' windows are never searched: see scripts/safety.test.mjs.
static GAME_WINDOW: AtomicIsize = AtomicIsize::new(0);

/// The game's window, in front or not, while the one last seen in front is still there and still the game's.
fn game_window() -> Option<HWND> {
    let w = HWND(GAME_WINDOW.load(SeqCst) as *mut _);
    (!w.is_invalid() && unsafe { IsWindow(Some(w)) }.as_bool() && is_game(&title(w))).then_some(w)
}

fn title(w: HWND) -> String {
    let mut text = [0u16; 64];
    let n = unsafe { GetWindowTextW(w, &mut text) };
    String::from_utf16_lossy(&text[..n.max(0) as usize])
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
            let shown = pointer_shown();
            if state.pointer.swap(shown, SeqCst) != shown {
                let _ = app.emit_to(OVERLAY, "pointer", shown);
            }
            let mut at = POINT::default();
            let inside = shown && unsafe { GetCursorPos(&mut at) }.is_ok() && within(&zones, at.x - left, at.y - top);
            if inside != taking && let Some(w) = window {
                taking = inside;
                let _ = w.set_ignore_cursor_events(!inside);
            }
            std::thread::sleep(POINT_LOOK);
        }
    });
}

/// Whether Windows shows a mouse pointer. Asks Windows only, never the game. True when it cannot tell.
fn pointer_shown() -> bool {
    let mut info = CURSORINFO { cbSize: size_of::<CURSORINFO>() as u32, ..Default::default() };
    if unsafe { GetCursorInfo(&mut info) }.is_err() {
        return true;
    }
    info.flags.0 & CURSOR_SHOWING.0 != 0 && !info.hCursor.is_invalid()
}

fn within(zones: &[[i32; 4]], x: i32, y: i32) -> bool {
    zones.iter().any(|z| (z[0]..z[2]).contains(&x) && (z[1]..z[3]).contains(&y))
}

/// The title Windows keeps for the window in front. Nothing is asked of the game itself.
fn game_in_front() -> bool {
    let w = unsafe { GetForegroundWindow() };
    let game = is_game(&title(w));
    if game {
        GAME_WINDOW.store(w.0 as isize, SeqCst);
    }
    game
}

/// Whether Plume's overlay window is the one in front.
fn ours_in_front(app: &AppHandle) -> bool {
    let front = unsafe { GetForegroundWindow() };
    app.get_webview_window(OVERLAY).and_then(|w| w.hwnd().ok()).is_some_and(|w| w.0 == front.0)
}

fn is_game(title: &str) -> bool {
    // A browser tab about the game starts the same way, but ends with the browser's name.
    GAME.iter().any(|g| title.starts_with(g)) && !title.contains(" - ") && !title.contains(" — ")
}

/// Shows and hides the overlay as the game comes and goes.
pub fn watch(app: AppHandle) {
    std::thread::spawn(move || {
        let mut seen = Instant::now();
        let mut was_front = false;
        // The game counts as new when it was not in front for as long as the overlays sleep.
        let (mut gone, mut front_at) = (true, Instant::now());
        loop {
            let state = app.state::<Overlay>();
            // The overlay in front is over the game: just after edit mode, or a click on one of its buttons.
            let front = game_in_front() || ours_in_front(&app);
            // Whether it is seen now, as Windows says: anything may have hidden it.
            let shown = app.get_webview_window(OVERLAY).is_some_and(|w| w.is_visible().unwrap_or(false));
            if front {
                if gone {
                    crate::game_came(&app);
                }
                (gone, front_at) = (false, Instant::now());
            } else if front_at.elapsed() > SLEEP && !app.state::<Arc<Engine>>().live() {
                // While the engine hears the game, it is the same session: you were only in another window.
                gone = true;
            }
            let wanted = state.editing.load(SeqCst) != NONE
                || state.on.load(SeqCst) && (front || !state.only_in_game.load(SeqCst));
            if wanted && let Some(w) = overlay(&app) {
                if front {
                    place(&app, &w);
                }
                if !shown || front && !was_front {
                    place(&app, &w);
                    let _ = w.show();
                    // Windows can drop a window behind a game that just took the screen, so on top again each time.
                    let _ = w.set_always_on_top(true);
                }
            } else if !wanted && shown && let Some(w) = app.get_webview_window(OVERLAY) {
                let _ = w.hide();
            } else if !wanted && app.state::<Arc<Engine>>().live() && app.get_webview_window(OVERLAY).is_none() {
                // The overlay page also keeps what the game says: loot, your characters, your Closet. While the game is heard
                // it runs, hidden, even with the overlays off.
                let _ = overlay(&app);
            }
            was_front = front;
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
    use super::{is_game, spot, within};

    #[test]
    fn a_zone_takes_the_mouse_inside_its_edges() {
        let zones = [[10, 10, 20, 20], [0, 50, 5, 60]];
        assert!(within(&zones, 10, 19) && within(&zones, 4, 50));
        assert!(!within(&zones, 20, 10) && !within(&zones, 9, 10) && !within(&[], 0, 0));
    }

    #[test]
    fn the_second_page_goes_beside_the_game_and_back_to_where_it_was() {
        let screens = [[0, 0, 1920, 1080], [1920, 0, 1000, 1000]];
        assert_eq!(spot(&screens, (0, 0), None), [2020, 100, 800, 800]);
        assert_eq!(spot(&screens, (1920, 0), None), [192, 108, 1536, 864]);
        let was = [1930, 20, 400, 300];
        assert_eq!(spot(&screens, (0, 0), Some(was)), was);
        // Its screen is gone.
        assert_eq!(spot(&screens[..1], (0, 0), Some(was)), [192, 108, 1536, 864]);
        assert_eq!(spot(&[], (0, 0), None)[2], 1024);
    }

    #[test]
    fn the_game_is_told_from_a_page_about_it() {
        assert!(is_game("AION 2 l Someone") && is_game("AION2"));
        assert!(!is_game("AION 2 guide - Google Chrome") && !is_game("Plume") && !is_game(""));
    }
}
