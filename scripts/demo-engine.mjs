// Speaks the engine's protocol with a made-up fight. For looking at the pages and for `npm run bench`.
import { createInterface } from "node:readline";
import { demoFight, demoSkills } from "../src/live/demo.ts";

const say = (message) => console.log(JSON.stringify(message));
let begun = Date.now() - 60_000;
let watched;

say({ t: "state", protocol: 1, version: "demo", live: true, late: false, devices: 0 });

const now = () => demoFight(Date.now() - begun);
function fight() {
  say({ t: "fight", ...now() });
}
let timer = setInterval(fight, 250);
setInterval(() => {
  const row = now().rows.find((r) => r.id === watched);
  if (row) say({ t: "skills", id: row.id, skills: demoSkills(row.damage) });
}, 500);

/** A few finished fights, the last a minute ago. */
[["Stormbound Warden", 172_000, true, false], ["Stormbound Warden", 141_000, false, false], ["Training dummy", 60_000, false, true], ["Training dummy", 60_000, false, true]].forEach(
  ([target, ms, killed, dummy], i) => {
    const { rows } = demoFight(ms);
    const mine = dummy ? rows.filter((r) => r.you) : rows;
    const total = mine.reduce((sum, r) => sum + r.damage, 0);
    const curve = Array.from({ length: ms / 1000 }, (_, s) => demoFight((s + 1) * 1000).rows.find((r) => r.you).damage);
    say({
      t: "saved", id: `demo_${i}`, target, code: dummy ? -2 : -1, start: Date.now() - (i + 1) * 1_000_000 - ms, ms, total,
      maxHp: 43_000_000, killed, dummy, dungeon: 0, curve,
      rows: mine.map((r) => ({ ...r, skills: demoSkills(r.damage) })),
    });
  },
);

createInterface({ input: process.stdin })
  .on("line", (line) => {
    const command = JSON.parse(line);
    if (command.cmd === "rate") {
      clearInterval(timer);
      timer = setInterval(fight, command.ms);
    } else if (command.cmd === "watch") watched = command.id;
    else if (command.cmd === "reset") begun = Date.now();
    else if (command.cmd === "stop") process.exit(0);
  })
  .on("close", () => process.exit(0));
