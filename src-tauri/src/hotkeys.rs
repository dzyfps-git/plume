//! Keys that work over the game. Windows hands them over through `RegisterHotKey`: nothing is hooked or watched.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Mutex, OnceLock};
use windows::Win32::Foundation::{LPARAM, WPARAM};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    HOT_KEY_MODIFIERS, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT, RegisterHotKey, UnregisterHotKey,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetMessageW, MSG, PM_NOREMOVE, PeekMessageW, PostThreadMessageW, WM_APP, WM_HOTKEY,
};

type Wanted = (Vec<(String, String)>, Sender<Vec<String>>);

/// This one comes again and again while it is held, which is how it is known to be held: no key is watched.
const HELD: &str = "peek";

static THREAD: AtomicU32 = AtomicU32::new(0);
static WANTED: OnceLock<Mutex<Option<Wanted>>> = OnceLock::new();

/// "Ctrl+Alt+F9" as Windows takes it. A key with no modifier is refused: the game would lose it.
pub fn parse(text: &str) -> Option<(HOT_KEY_MODIFIERS, u32)> {
    let mut parts: Vec<&str> = text.split('+').map(str::trim).collect();
    let key = parts.pop()?.to_ascii_uppercase();
    let mut modifiers = HOT_KEY_MODIFIERS(0);
    for part in &parts {
        modifiers |= match part.to_ascii_lowercase().as_str() {
            "ctrl" => MOD_CONTROL,
            "alt" => MOD_ALT,
            "shift" => MOD_SHIFT,
            _ => return None,
        };
    }
    let code = match key.as_bytes() {
        [c] if c.is_ascii_uppercase() || c.is_ascii_digit() => u32::from(*c),
        [b'F', ..] => match key[1..].parse::<u32>().ok()? {
            n @ 1..=24 => 0x6F + n,
            _ => return None,
        },
        _ => match key.as_str() {
            "HOME" => 0x24,
            "END" => 0x23,
            "PAGEUP" => 0x21,
            "PAGEDOWN" => 0x22,
            "INSERT" => 0x2D,
            "DELETE" => 0x2E,
            _ => return None,
        },
    };
    (modifiers.0 & (MOD_CONTROL.0 | MOD_ALT.0) != 0).then_some((modifiers, code))
}

/// Starts the thread that owns the keys. `pressed` gets the name of the action.
pub fn start(pressed: impl Fn(&str) + Send + 'static) {
    let (ready, started) = mpsc::channel();
    std::thread::spawn(move || unsafe {
        let mut m = MSG::default();
        // Makes the thread's message queue before anyone posts to it.
        let _ = PeekMessageW(&mut m, None, 0, 0, PM_NOREMOVE);
        THREAD.store(GetCurrentThreadId(), Ordering::SeqCst);
        let _ = ready.send(());
        let mut actions: Vec<String> = Vec::new();
        while GetMessageW(&mut m, None, 0, 0).as_bool() {
            match m.message {
                WM_HOTKEY => {
                    if let Some(action) = actions.get(m.wParam.0) {
                        pressed(action);
                    }
                }
                WM_APP => {
                    for id in 0..actions.len() {
                        let _ = UnregisterHotKey(None, id as i32);
                    }
                    let wanted = WANTED.get().and_then(|w| w.lock().unwrap_or_else(|p| p.into_inner()).take());
                    let Some((keys, answer)) = wanted else { continue };
                    actions = keys.iter().map(|(action, _)| action.clone()).collect();
                    let mut taken = Vec::new();
                    for (id, (action, key)) in keys.iter().enumerate().filter(|(_, (_, key))| !key.is_empty()) {
                        let registered = parse(key)
                            .is_some_and(|(mods, code)| {
                                let mods = if action == HELD { mods } else { mods | MOD_NOREPEAT };
                                RegisterHotKey(None, id as i32, mods, code).is_ok()
                            });
                        if !registered {
                            taken.push(action.clone());
                        }
                    }
                    let _ = answer.send(taken);
                }
                _ => {}
            }
        }
    });
    let _ = started.recv();
}

/// Takes the place of every key. Gives back the actions whose key is refused or another app's.
pub fn set(keys: Vec<(String, String)>) -> Vec<String> {
    let (answer, result) = mpsc::channel();
    let slot = WANTED.get_or_init(|| Mutex::new(None));
    *slot.lock().unwrap_or_else(|p| p.into_inner()) = Some((keys, answer));
    let thread = THREAD.load(Ordering::SeqCst);
    if unsafe { PostThreadMessageW(thread, WM_APP, WPARAM(0), LPARAM(0)) }.is_err() {
        return Vec::new();
    }
    result.recv_timeout(std::time::Duration::from_secs(2)).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_are_read_and_unsafe_ones_refused() {
        assert_eq!(parse("Ctrl+Alt+F9"), Some((MOD_CONTROL | MOD_ALT, 0x78)));
        assert_eq!(parse("alt + shift + d"), Some((MOD_ALT | MOD_SHIFT, 0x44)));
        assert_eq!(parse("Ctrl+1"), Some((MOD_CONTROL, 0x31)));
        for bad in ["", "F9", "Shift+A", "Ctrl+", "Ctrl+F25", "Ctrl+Nope", "Win+A", "Ctrl+é"] {
            assert_eq!(parse(bad), None, "{bad}");
        }
    }

    #[test]
    fn a_key_can_be_set_and_taken_back() {
        start(|_| ());
        assert_eq!(set(vec![("a".into(), "Ctrl+Alt+Shift+F23".into())]), Vec::<String>::new());
        assert_eq!(set(vec![("a".into(), "F9".into())]), ["a"]);
        assert_eq!(set(Vec::new()), Vec::<String>::new());
    }
}
