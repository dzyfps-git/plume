const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const full = (n: number) => whole.format(n);

/** 950, 12.4K, 1.98M, 2.10B: three figures, so a column never jumps. */
export function short(n: number): string {
  for (const [size, unit] of [[1e9, "B"], [1e6, "M"], [1e3, "K"]] as const) {
    if (n >= size * 0.9995) {
      const v = n / size;
      return `${v.toFixed(v < 9.995 ? 2 : v < 99.95 ? 1 : 0)}${unit}`;
    }
  }
  return String(Math.round(n));
}

/** 0:07, 1:23, 1:02:05 */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const two = (n: number) => String(n).padStart(2, "0");
  return s < 3600 ? `${Math.floor(s / 60)}:${two(s % 60)}` : `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;
}

export const percent = (part: number, all: number) => (all > 0 ? `${Math.round((part / all) * 100)}%` : "0%");

/** "Today", "Yesterday", or the day. */
export function day(at: number, now = Date.now()): string {
  const start = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((start(now) - start(at)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export const time = (at: number) => new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
