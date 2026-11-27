// What leaves Plume, and only when you ask: your own result as text, a picture, or a file.
import type { Saved } from "../../live/types.ts";
import { clock, short } from "../../ui/format.ts";
import { label } from "../meter/logic.ts";

const cell = (value: string | number) => {
  const text = String(value);
  // A spreadsheet takes a leading = + - @ as a formula. Only text can be one.
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

/** Your fights, one a line. */
export function csv(fights: readonly Saved[]): string {
  const head = ["Started", "Target", "Seconds", "Killed", "Your damage", "Your damage a second", "Share percent", "Deaths", "Damage taken", "Players", "Combat Power"];
  const lines = fights.map((f) => [
    new Date(f.start).toISOString(), f.target, Math.round(f.ms / 1000), f.killed ? "yes" : "no", f.you?.damage ?? 0, Math.round(f.you?.dps ?? 0),
    Math.round(((f.you?.damage ?? 0) / Math.max(1, f.total)) * 1000) / 10, f.you?.deaths ?? 0, f.you?.taken ?? 0, f.players, f.you?.power ?? 0,
  ]);
  return [head, ...lines].map((line) => line.map(cell).join(",")).join("\r\n");
}

export const bytes = (text: string) => new TextEncoder().encode(text);
export const fileName = (fight: Saved) => `${fight.target} ${new Date(fight.start).toISOString().slice(0, 16).replace(/[T:]/g, "-")}`;

/** The report as a picture. Other players are numbered, never named. */
export async function picture(fight: Saved, color: (job: string) => string): Promise<Uint8Array> {
  const rows = fight.rows ?? (fight.you ? [fight.you] : []);
  const [width, top, line] = [760, 118, 34];
  const height = top + rows.length * line + 34;
  const canvas = new OffscreenCanvas(width * 2, height * 2);
  const c = canvas.getContext("2d")!;
  c.scale(2, 2);
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const font = (size: number, weight = 400) => (c.font = `${weight} ${size}px "Segoe UI Variable Text", "Segoe UI", sans-serif`);
  const text = (words: string, x: number, y: number, fill: string, align: CanvasTextAlign = "left") => {
    c.fillStyle = fill;
    c.textAlign = align;
    c.fillText(words, x, y);
  };
  c.fillStyle = token("--surface-base");
  c.fillRect(0, 0, width, height);
  c.textBaseline = "middle";
  font(22, 600);
  text(fight.target, 24, 36, token("--text"));
  font(14);
  text(`${clock(fight.ms)}${fight.dummy ? "" : fight.killed ? ", killed" : ", not killed"}`, 24, 64, token("--text-muted"));
  font(26, 600);
  text(short(fight.you?.dps ?? 0), width - 24, 36, token("--accent"), "right");
  font(14);
  text("you, a second", width - 24, 64, token("--text-muted"), "right");
  const most = Math.max(1, ...rows.map((r) => r.damage));
  rows.forEach((r, i) => {
    const y = top + i * line;
    c.fillStyle = token("--hover-base");
    c.beginPath();
    c.roundRect(24, y - 15, width - 48, line - 4, 6);
    c.fill();
    c.globalAlpha = 0.55;
    c.fillStyle = color(r.job);
    c.beginPath();
    c.roundRect(24, y - 15, Math.max(6, (width - 48) * (r.damage / most)), line - 4, 6);
    c.fill();
    c.globalAlpha = 1;
    font(15, r.you ? 700 : 500);
    text(label(r, true, i + 1), 36, y, token("--text"));
    font(14);
    text(`${short(r.damage)}   ${r.share.toFixed(1)}%   ${short(r.dps)}`, width - 36, y, token("--text"), "right");
  });
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await blob.arrayBuffer());
}
