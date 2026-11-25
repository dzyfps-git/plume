//! Starting with Windows: one line in your own part of the registry, and only once you turn it on.

use windows::Win32::Foundation::ERROR_FILE_NOT_FOUND;
use windows::Win32::System::Registry::{HKEY_CURRENT_USER, REG_SZ, RegDeleteKeyValueW, RegSetKeyValueW};
use windows::core::{PCWSTR, w};

/// Told to Plume by Windows as it starts, so that no window opens.
pub const HIDDEN: &str = "--hidden";
const RUN: PCWSTR = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Run");

pub fn set(on: bool) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    write(w!("Plume"), on.then(|| format!("\"{}\" {HIDDEN}", exe.display())))
}

fn write(name: PCWSTR, line: Option<String>) -> Result<(), String> {
    let done = match line {
        Some(line) => {
            let text: Vec<u16> = line.encode_utf16().chain([0]).collect();
            let bytes = size_of_val(text.as_slice()) as u32;
            unsafe { RegSetKeyValueW(HKEY_CURRENT_USER, RUN, name, REG_SZ.0, Some(text.as_ptr().cast()), bytes) }
        }
        None => match unsafe { RegDeleteKeyValueW(HKEY_CURRENT_USER, RUN, name) } {
            ERROR_FILE_NOT_FOUND => return Ok(()),
            other => other,
        },
    };
    done.ok().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn taking_away_what_is_not_there_is_fine() {
        assert_eq!(write(w!("Plume test, never there"), None), Ok(()));
    }
}
