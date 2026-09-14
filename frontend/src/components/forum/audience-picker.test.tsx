import { expect, test } from "bun:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "@/lib/auth";
import { ProfilesProvider } from "@/lib/profiles";
import {
  AudienceChips,
  AudienceFilter,
  type AudienceOption,
  AudiencePicker,
  audiencePresentation,
} from "./audience-picker";

function option(
  identity: string,
  kind = "group",
  label = "Project team",
): AudienceOption {
  return { identity, kind, label, holder: `${kind}:${identity}` };
}

function render(children: ReactNode) {
  return renderToStaticMarkup(
    <AuthProvider>
      <ProfilesProvider>{children}</ProfilesProvider>
    </AuthProvider>,
  );
}

for (const kind of ["group", "section"]) {
  test(`${kind} collisions stay distinguishable in the selection, preview, and filter`, () => {
    const options = [option("a12bc3-one", kind), option("f98de4-two", kind)];
    for (const selected of options) {
      const label = `Project team · ${selected.identity.slice(0, 6)}`;
      const holders = [selected.holder];
      const surfaces = [
        <AudiencePicker
          key="picker"
          selected={holders}
          options={options}
          disabled={false}
          onChange={() => {}}
          onRefresh={() => {}}
          error={null}
          loading={false}
        />,
        <AudienceChips key="chips" holders={holders} options={options} />,
        <AudienceFilter
          key="filter"
          value={selected.holder}
          options={options}
          onChange={() => {}}
        />,
      ];
      for (const surface of surfaces) expect(render(surface)).toContain(label);
    }
  });
}

test("unique names remain plain, including equal names of different kinds", () => {
  const options = [option("a12bc3-one"), option("f98de4-two", "section")];
  for (const selected of options) {
    expect(audiencePresentation(selected, options).label).toBe("Project team");
    const html = render(
      <AudienceChips holders={[selected.holder]} options={options} />,
    );
    expect(html).toContain("Project team");
    expect(html).not.toContain(" · ");
  }
});

test("private audience labels show selected recipients without an administrator annotation", () => {
  for (const kind of ["account", "group", "section"]) {
    const selected = option("selected-recipient", kind, "Selected recipient");
    const holders = [selected.holder];
    const html = render(
      <AudienceChips holders={holders} options={[selected]} />,
    );
    expect(html).toContain("Selected recipient");
    expect(html).not.toContain("and administrators");
    expect(holders).toEqual([selected.holder]);
  }
});

test("standing and empty audiences have no administrator annotation", () => {
  for (const identity of ["everyone", "staff"]) {
    const selected = option(
      identity,
      "standing",
      identity === "staff" ? "Staff" : "Everyone",
    );
    const html = render(
      <AudienceChips holders={[selected.holder]} options={[selected]} />,
    );
    expect(html).not.toContain("and administrators");
  }
  expect(render(<AudienceChips holders={[]} options={[]} />)).not.toContain(
    "and administrators",
  );
});

test("duplicate names extend a shared identity prefix only as far as needed", () => {
  const options = [option("abcdef1-rest"), option("abcdef2-rest")];
  expect(audiencePresentation(options[0], options).label).toBe(
    "Project team · abcdef1",
  );
  expect(audiencePresentation(options[1], options).label).toBe(
    "Project team · abcdef2",
  );
});
