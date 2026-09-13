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
  test("the ordinary composer offers one submit", () => {
    const html = render();
    expect(html).toContain("Post reply");
    expect(html).not.toContain("Post and notify");
  });

  test("an alternate submit appears beside it, never instead of it", () => {
    const html = render({
      altSubmitLabel: "Post and notify",
      onAltSubmit: () => {},
    });
    expect(html).toContain("Post reply");
    expect(html).toContain("Post and notify");
    expect(html.indexOf("Post and notify")).toBeLessThan(
      html.indexOf("Post reply"),
    );
  });

  test("a label without a handler offers nothing extra to press", () => {
    expect(render({ altSubmitLabel: "Post and notify" })).not.toContain(
      "Post and notify",
    );
  });
});
