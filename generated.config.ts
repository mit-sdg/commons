import { assembleCommons } from "./src/assembly/application.ts";
import { commonsHttpFloor } from "./src/assembly/http-floor.ts";

export default {
  assemble: assembleCommons,
  directory: new URL("./generated/", import.meta.url),
  specification: "commons.md",
  title: "Commons",
  wire: "wire.ts",
  wireName: "CommonsWire",
  wireVocabulary: { from: "../src/concepts/index.ts", export: "vocabulary" },
  httpFloor: commonsHttpFloor("http://127.0.0.1:3000"),
};
