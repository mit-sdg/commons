import { httpWire } from "@mit-sdg/sync-engine-http/tooling";
import type { Db } from "mongodb";
import { assembleCommons } from "./src/assembly/application.ts";
import { commonsHttpPolicy } from "./src/assembly/http-policy.ts";
import { mongoImplementations } from "./src/vocabulary.ts";

const policy = commonsHttpPolicy("http://127.0.0.1:3000");
// Assembly inspects protocols without executing concept methods; no connection is opened.
const artifactDatabase = { collection: () => ({}) } as unknown as Db;

export default {
  assemble: () => assembleCommons(mongoImplementations(artifactDatabase)),
  directory: new URL("./generated/", import.meta.url),
  specification: "commons.md",
  title: "Commons",
  wire: "wire.ts",
  wireName: "CommonsWire",
  vocabulary: { module: new URL("./src/vocabulary.ts", import.meta.url) },
  projections: [httpWire({ policy, name: "CommonsWireHttp" })],
};
