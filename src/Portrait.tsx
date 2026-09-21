import { memo } from "react";
import type { World } from "./game";

const appearances = {
  fox: 6,
  bird: 7,
  deer: 8,
  bear: 9,
  beaver: 10,
  robot: 11,
  alien: 12,
};

export const Portrait = memo(function Portrait({
  character = 0,
  tone = "earth",
  appearance = "human",
  portrait,
}: {
  character?: number;
  portrait?: number | null;
  tone?: World["tone"];
  appearance?: World["characters"][number]["appearance"];
}) {
  const tile =
    appearance === "human"
      ? (portrait ?? character) % 6
      : appearances[appearance];
  return (
    <div className={`portrait portrait-${tone}`} aria-hidden="true">
      <div
        className="portrait-art"
        style={{
          backgroundPosition: `${((tile % 4) * 100) / 3}% ${(Math.floor(tile / 4) * 100) / 3}%`,
        }}
      />
    </div>
  );
});
