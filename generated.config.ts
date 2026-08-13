import { httpWire } from "@mit-sdg/sync-engine-http/tooling";
import { assembleCommons } from "./src/assembly/application.ts";
import { commonsHttpPolicy } from "./src/assembly/http-policy.ts";

const policy = commonsHttpPolicy("http://127.0.0.1:3000");

export default {
  assemble: assembleCommons,
  directory: new URL("./generated/", import.meta.url),
  specification: "commons.md",
  title: "Commons",
  wire: "wire.ts",
  wireName: "CommonsWire",
  vocabulary: { module: new URL("./src/vocabulary.ts", import.meta.url) },
  projections: [httpWire({ policy, name: "CommonsWireHttp" })],
};
