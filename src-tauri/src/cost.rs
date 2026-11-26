//! What Plume costs: the CPU its own process takes. Its pages run in WebView2 and the engine in a process of its own;
//! those are not counted, since the app opens no other process (see `scripts/safety.test.mjs`).

use std::sync::atomic::{AtomicU32, Ordering::SeqCst};
use std::time::{Duration, Instant};
use windows::Win32::Foundation::FILETIME;
use windows::Win32::System::Threading::{GetCurrentProcess, GetProcessTimes};

/// Of all the computer's CPU, in tenths of a percent, over the last look.
pub static CPU: AtomicU32 = AtomicU32::new(0);
pub const EVERY: Duration = Duration::from_secs(5);

/// CPU time of Plume's own process, kernel and user, in 100 ns.
fn used() -> u64 {
    let ticks = |t: FILETIME| (u64::from(t.dwHighDateTime) << 32) | u64::from(t.dwLowDateTime);
    let (mut a, mut b, mut kernel, mut user) = Default::default();
    // SAFETY: the pseudo handle of the current process needs no closing, and the times are only read.
    let ok = unsafe { GetProcessTimes(GetCurrentProcess(), &mut a, &mut b, &mut kernel, &mut user) }.is_ok();
    if ok { ticks(kernel) + ticks(user) } else { 0 }
}

/// Looks every few seconds, and calls `heard` with the share of the CPU in percent.
pub fn watch(heard: impl Fn(f64) + Send + 'static) {
    std::thread::spawn(move || {
        let cores = std::thread::available_parallelism().map_or(1, |n| n.get()) as f64;
        let (mut before, mut at) = (used(), Instant::now());
        loop {
            std::thread::sleep(EVERY);
            let now = used();
            let wall = at.elapsed().as_nanos() as f64 / 100.0;
            let percent = if wall > 0.0 { now.saturating_sub(before) as f64 / wall / cores * 100.0 } else { 0.0 };
            CPU.store((percent * 10.0).round() as u32, SeqCst);
            heard(percent);
            (before, at) = (now, Instant::now());
        }
    });
}

#[cfg(test)]
mod tests {
    #[test]
    fn plume_has_spent_time() {
        let spin: u64 = (0..2_000_000u64).map(std::hint::black_box).sum();
        assert!(spin > 0 && super::used() > 0);
    }
}
