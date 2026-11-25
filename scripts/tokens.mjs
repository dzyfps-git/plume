// Makes src/house/tokens.css from House's tokens.json. Run `npm run tokens` after a new tokens.json.
import { readFileSync, writeFileSync } from "node:fs";

export function css(t) {
  const { themes, tokens } = t.color;
  const value = (v, theme) => (typeof v === "string" ? v : v[theme]);
  const shared = [
    ...Object.entries(t.type.families).map(([name, v]) => [`font-${name}`, v]),
    ...[t.spacing, t.radius, t.size].flatMap((g) => g.tokens.map((x) => [x.name, x.value])),
  ];
  const block = (head, rows) => `${head} {\n${rows.map(([n, v]) => `  --${n}: ${v};`).join("\n")}\n}\n`;
  const themed = themes.map(({ id }, i) =>
    block(
      i === 0 ? `:root, [data-theme="${id}"]` : `[data-theme="${id}"]`,
      [...tokens, ...t.shadow.tokens].map((x) => [x.name, value(x.value, id)]),
    ),
  );
  return `/* Made from tokens.json by scripts/tokens.mjs. Do not edit. */\n${block(":root", shared)}${themed.join("")}`;
}

if (process.argv[1]?.endsWith("tokens.mjs")) {
  writeFileSync("src/house/tokens.css", css(JSON.parse(readFileSync("src/house/tokens.json", "utf8"))));
}
