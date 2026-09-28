import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { NOINDEX, NoindexMeta } from "./noindex-meta";

/**
 * The single-writer invariant for `meta[name=robots]`.
 *
 * `applySeoMetadata` on every public page finds the *first* `meta[name=robots]` and
 * overwrites it. `NoindexMeta` used to render a `<meta>` element in JSX, which React
 * hoists into `<head>`, so the document ended up with two tags on the one key written
 * by two components — and which one `querySelector` found first depended on the order
 * the effects happened to run. Public pages shipped `index, follow` and
 * `noindex, nofollow` side by side.
 *
 * The reproduction below therefore has to involve *two components racing in effects*.
 * A test that sets the tag by hand after render passes against both the old and the new
 * implementation and proves nothing; `PageThatDeclaresItsOwn` stands in for a marketing
 * page calling `applySeoMetadata` from a passive effect, which is what actually happens.
 */

function robotsTags(): HTMLMetaElement[] {
  return Array.from(document.head.querySelectorAll<HTMLMetaElement>('meta[name="robots"]'));
}

function upsertRobots(content: string) {
  let element = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", "robots");
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

/** Stands in for a public page's own `applySeoMetadata`, which runs in a passive effect. */
function PageThatDeclaresItsOwn() {
  useEffect(() => {
    upsertRobots("index, follow");
  }, []);
  return <p>page</p>;
}

function at(pathname: string) {
  window.history.replaceState(null, "", pathname);
}

afterEach(() => {
  cleanup();
  for (const tag of robotsTags()) tag.remove();
  at("/");
});

describe("NoindexMeta", () => {
  it("keeps the signed-in app out of the index", () => {
    at("/settings");
    render(<NoindexMeta />);

    expect(robotsTags()).toHaveLength(1);
    expect(robotsTags()[0].getAttribute("content")).toBe(NOINDEX);
  });

  it("leaves no tag behind for a page that declares its own policy", () => {
    at("/");
    render(<NoindexMeta />);

    expect(robotsTags()).toHaveLength(0);
  });

  it("treats a nested public document as public", () => {
    at("/legal/cookies-policy");
    render(<NoindexMeta />);
    expect(robotsTags()).toHaveLength(0);
  });

  // The regression. Against the old JSX-rendering implementation this produced two tags
  // on the key: the page's passive effect created one, then the blanket's state update
  // committed and React hoisted a second.
  it("leaves exactly one tag when a public page declares its own policy", () => {
    at("/platform");
    render(
      <>
        <NoindexMeta />
        <PageThatDeclaresItsOwn />
      </>,
    );

    expect(robotsTags()).toHaveLength(1);
    expect(robotsTags()[0].getAttribute("content")).toBe("index, follow");
  });

  it("does not contribute a React-rendered meta element", () => {
    // The structural half of the fix: if the blanket renders a <meta> in JSX again, it
    // is back to being a second writer on the key regardless of effect ordering.
    at("/settings");
    const { container } = render(<NoindexMeta />);

    expect(container.querySelectorAll("meta")).toHaveLength(0);
  });
});

