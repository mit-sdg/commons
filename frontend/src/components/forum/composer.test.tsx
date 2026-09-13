import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "@/lib/auth";
import { Composer } from "./composer";

function render(props: Partial<Parameters<typeof Composer>[0]> = {}) {
  return renderToStaticMarkup(
    <AuthProvider>
      <Composer submitLabel="Post reply" onSubmit={() => {}} {...props} />
    </AuthProvider>,
  );
}

describe("a second way to post the same writing", () => {
  test("the ordinary composer offers one submit and no menu", () => {
    const html = render();
    expect(html).toContain("Post reply");
    expect(html).not.toContain("More ways to post");
  });

  test("an alternate submit hangs off the submit, never replacing it", () => {
    const html = render({
      altSubmitLabel: "Post and notify",
      onAltSubmit: () => {},
    });
    expect(html).toContain("Post reply");
    expect(html).toContain("More ways to post");
    // The menu itself is opened on demand, so the ordinary submit is the only
    // thing the closed composer asks anyone to read.
    expect(html).not.toContain("Post and notify");
  });

  test("a label without a handler offers nothing extra to press", () => {
    expect(render({ altSubmitLabel: "Post and notify" })).not.toContain(
      "More ways to post",
    );
  });
});
