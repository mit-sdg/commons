import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const frontend = join(import.meta.dirname, "..", "frontend");
const standaloneFrontend = join(frontend, ".next", "standalone", "frontend");

if (!existsSync(join(standaloneFrontend, "server.js"))) {
  throw new Error("commons: the frontend standalone server was not produced by the build.");
}

function copyRuntimeDirectory(name: string) {
  const source = join(frontend, name);
  if (!existsSync(source)) return;
  const destination = join(standaloneFrontend, name);
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

copyRuntimeDirectory(".next/static");
copyRuntimeDirectory("public");
