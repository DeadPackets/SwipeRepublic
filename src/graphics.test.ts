import { test, expect } from "bun:test";
import { graphicSchema } from "./game";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { WorldGraphic } from "./WorldGraphic";
const curve = {
  d: "M10 90 C10 40 30 10 50 10 Q90 10 90 90 Z",
  fill: "#42535a",
};
test("vector paths render as bounded curved shapes", () => {
  expect(graphicSchema.safeParse([curve]).success).toBe(true);
  expect(
    renderToStaticMarkup(createElement(WorldGraphic, { graphic: [curve] })),
  ).toContain("<path");
});
test("generated paths reject markup, out-of-bounds numbers and incomplete commands", () => {
  for (const d of [
    "M0 0L101 10Z",
    "M0 0L-1 10Z",
    "M0 0 C10 20Z",
    "M0 0 <script>alert(1)</script>Z",
    "M0 0 L10 20",
    "M0 0 Q20 30 40 50Z url(https://x)",
    "M0 0 L1e4 0Z",
  ]) {
    expect(graphicSchema.safeParse([{ ...curve, d }]).success).toBe(
      false,
    );
  }
});
