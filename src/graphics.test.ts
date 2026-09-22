import { test, expect } from "bun:test";
import { graphicSchema, vectorGraphicSchema } from "./game";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { WorldGraphic } from "./WorldGraphic";
const curve = {
  d: "M10 90 C10 40 30 10 50 10 Q90 10 90 90 Z",
  fill: "#42535a",
};
const polygon = {
  points: [
    [10, 10],
    [90, 10],
    [50, 90],
  ],
  fill: "#42535a",
};
test("vector paths support bounded curved portraits and old polygon saves", () => {
  expect(vectorGraphicSchema.safeParse([curve]).success).toBe(true);
  expect(graphicSchema.safeParse([polygon]).success).toBe(true);
  expect(vectorGraphicSchema.safeParse([polygon]).success).toBe(false);
  const pathMarkup = renderToStaticMarkup(
    createElement(WorldGraphic, { graphic: [curve] }),
  );
  expect(pathMarkup).toContain("<path");
  expect(
    renderToStaticMarkup(createElement(WorldGraphic, { graphic: [polygon] })),
  ).toContain("<polygon");
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
    expect(vectorGraphicSchema.safeParse([{ ...curve, d }]).success).toBe(
      false,
    );
  }
});
