import { memo } from "react";
import type { World } from "./game";
import { WorldGraphic } from "./WorldGraphic";

export const Portrait = memo(function Portrait({
  character,
  image,
}: {
  character: World["characters"][number];
  image?: string;
}) {
  return (
    <div className="character-silhouette" aria-hidden="true">
      {character.silhouette ? (
        <WorldGraphic graphic={character.silhouette} />
      ) : image ? (
        <img src={image} alt="" draggable={false} decoding="async" />
      ) : (
        <span className="character-seal">
          {character.name
            .split(/\s+/)
            .map((word) => word[0])
            .slice(0, 2)
            .join("")}
        </span>
      )}
    </div>
  );
});
