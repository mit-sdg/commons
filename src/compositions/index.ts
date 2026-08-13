import * as Access from "./Access.ts";
import * as Course from "./Course.ts";
import * as Forum from "./Forum.ts";

export const composition = {
  Access: { spec: Access.spec, ...Access.compositions },
  Course: { spec: Course.spec, ...Course.compositions },
  Forum: { spec: Forum.spec, ...Forum.compositions },
};
