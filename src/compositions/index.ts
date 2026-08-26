import * as Access from "./Access.ts";
import * as Course from "./Course.ts";
import * as Forum from "./Forum.ts";
import * as Live from "./Live.ts";
import * as Tasks from "./Tasks.ts";

export const composition = {
  Access: Access.compositions,
  Course: Course.compositions,
  Forum: Forum.compositions,
  Live: Live.compositions,
  Tasks: Tasks.compositions,
};
