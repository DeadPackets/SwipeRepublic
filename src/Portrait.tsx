import { memo } from "react";
import type { World } from "./game";

const appearances: Record<string, number> = {
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
  image,
}: {
  image?: string;
  character?: number;
  portrait?: number | null;
  tone?: World["tone"];
  appearance?: World["characters"][number]["appearance"];
}) {
  const tile =
    appearance === "human"
      ? (portrait ?? character) % 6
      : (appearances[appearance] ?? character % 6);
  if (image)
    return (
      <div className="portrait" aria-hidden="true">
        <img
          className="generated-portrait"
          src={image}
          alt=""
          draggable={false}
          decoding="async"
        />
      </div>
    );
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
