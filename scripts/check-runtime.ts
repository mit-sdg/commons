// Exercise dependency loading in Bun, which runs the deployed backend.
// The Node test runner cannot detect Bun-specific import failures.
import "mongodb";
import "sanitize-html";

console.log("Bun backend dependency imports passed.");
