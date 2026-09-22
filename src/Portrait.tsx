import { memo } from "react";
import type { World } from "./game";
import { WorldGraphic } from "./WorldGraphic";

export const Portrait = memo(function Portrait({ character }: { character: World["characters"][number] }) {
  return (
    <div className="portrait" aria-hidden="true">
      <WorldGraphic graphic={character.silhouette} />
    </div>
  );
});
