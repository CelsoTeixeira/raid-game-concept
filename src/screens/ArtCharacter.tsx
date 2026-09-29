import { ART_CELL, artLayers, type ArtLook, type ArtOutfit } from "../art";
import type { Sex } from "../sim/names";

/** Stacks the layered character sheets. `scale` should be a whole number to keep pixels crisp. */
export function ArtCharacter({ sex, look, outfit, scale }: { sex: Sex; look: ArtLook; outfit: ArtOutfit; scale: number }) {
  const width = ART_CELL.width * scale;
  const height = ART_CELL.height * scale;
  return (
    <span className="art-character" style={{ width, height }} aria-hidden="true">
      {artLayers(sex, look, outfit).map((layer) => (
        <span
          className="art-layer"
          key={layer.url}
          style={{
            backgroundImage: `url(${layer.url})`,
            backgroundSize: `${layer.cols * width}px ${layer.rows * height}px`,
            backgroundPosition: `-${layer.col * width}px -${layer.row * height}px`,
          }}
        />
      ))}
    </span>
  );
}
