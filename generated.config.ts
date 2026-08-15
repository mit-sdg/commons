import { httpWire } from "@mit-sdg/sync-engine-http/tooling";
import type { Db } from "mongodb";
import { assembleCommons } from "./src/assembly/application.ts";
import { commonsHttpPolicy } from "./src/assembly/http-policy.ts";
import { mongoImplementations } from "./src/concepts.ts";

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
  design: {
    version: 1,
    documents: [
      new URL("./design/types.md", import.meta.url),
      new URL("./design/compositions/Access.md", import.meta.url),
      new URL("./design/compositions/Course.md", import.meta.url),
      new URL("./design/compositions/Forum.md", import.meta.url),
    ],
  },
  projections: [httpWire({ policy, name: "CommonsWireHttp" })],
};
