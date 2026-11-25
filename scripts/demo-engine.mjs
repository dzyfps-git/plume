// Speaks the engine's protocol with a made-up fight. For looking at the pages and for `npm run bench`.
import { createInterface } from "node:readline";
import { demoEntries, demoFight, demoNear, demoSaved, demoSkills } from "../src/live/demo.ts";

const say = (message) => console.log(JSON.stringify(message));
let begun = Date.now() - 60_000;
let watched;

say({ t: "state", protocol: 1, version: "demo", live: true, late: false, devices: 0 });

say({ t: "entries", ...demoEntries() });

const now = () => demoFight(Date.now() - begun);
function fight() {
  say({ t: "fight", ...now() });
}
let timer = setInterval(fight, 250);
setInterval(() => say({ t: "near", ...demoNear(Date.now() - begun, Date.now()) }), 250);
// Your casts, a monster's blows, and a kill now and then.
[[0, "Heart Gore", 12_000], [2, "Ambush", 18_000], [4, "Whirling Edge", 8_000]].forEach(([skill, name, every]) =>
  setInterval(() => say({ t: "happened", what: "cast", at: Date.now(), skill, name, job: "", amount: 0 }), every),
);
setInterval(() => say({ t: "happened", what: "blow", at: Date.now(), skill: 101, name: "Thunder Stomp", job: "", amount: 0 }), 16_000);
setInterval(() => {
  say({ t: "happened", what: "kill", at: Date.now(), skill: 0, name: "Rival", job: "", amount: 0 });
  say({ t: "happened", what: "points", at: Date.now(), skill: 0, name: "", job: "", amount: 180 });
}, 25_000);
setInterval(() => {
  const row = now().rows.find((r) => r.id === watched);
  if (row) say({ t: "skills", id: row.id, skills: demoSkills(row.damage) });
}, 500);

/** A few finished fights: three tries at a boss in one dungeon run, and training. */
const ago = (minutes) => Date.now() - minutes * 60_000;
const run = ago(60);
[
  ["demo_5", { ms: 60_000, dummy: true, seed: 5, skill: 0.8, start: ago(110) }],
  ["demo_4", { ms: 60_000, dummy: true, seed: 9, start: ago(105) }],
  ["demo_3", { ms: 121_000, seed: 3, skill: 0.7, start: ago(50), run }],
  ["demo_2", { ms: 141_000, seed: 4, skill: 0.8, start: ago(40), run }],
  ["demo_1", { ms: 172_000, seed: 6, skill: 0.95, killed: true, start: ago(30), run }],
].forEach(([id, options]) => say({ t: "saved", ...demoSaved(id, options) }));
say({ t: "reads", hits: 5_120, taken: 210, health: 900, buffs: 340, stats: 61, targetHealth: true, stagger: true, you: true, zone: true, skills: 44, unnamed: 0 });

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
