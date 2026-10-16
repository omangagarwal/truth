import { mkdir, readFile, writeFile } from "node:fs/promises";

const source = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
const firstLine = source.slice(0, source.indexOf("\n"));
const match = firstLine.match(/^const page = (.*);$/);
if (!match) throw new Error("Could not find the embedded SignalCheck page in worker/index.js");

const html = JSON.parse(match[1]);
await mkdir(new URL("../public", import.meta.url), { recursive: true });
await writeFile(new URL("../public/index.html", import.meta.url), html);
console.log("Built public/index.html from the shared SignalCheck page.");
