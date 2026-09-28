import type { SpriteFrame } from "../appearance";

/** Layered character sheet frames. Tiles are 16px with a 1px margin; `size` is the drawn tile size. */
export function SpriteStack({ frames, size }: { frames: SpriteFrame[]; size: number }) {
  const scale = size / 16;
  const layerStyle = { width: size, height: size, backgroundSize: `${918 * scale}px ${203 * scale}px` };
  return (
    <span className="member-preview" style={{ width: size, height: size }} aria-hidden="true">
      {frames.map((frame, index) => (
        <span
          className="member-sprite-layer"
          key={`${frame.col}-${frame.row}-${index}`}
          style={{ ...layerStyle, backgroundPosition: `-${frame.col * 17 * scale}px -${frame.row * 17 * scale}px` }}
        />
      ))}
    </span>
  );
}
