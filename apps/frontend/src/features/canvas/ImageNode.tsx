import { useCardEntrance } from "../../hooks/UseCardEntrance";
import { ImageLightbox } from "./ImageLightbox";
import { DocumentPress } from "./DocumentPress";
import { memo, useRef, useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { geometryLimits } from "@pluribus/core/canvas/domain";

export type ImageNode = Node<
  {
    name: string;
    aiDescription?: string | null;
    url: string | null;
    editable: boolean;
  },
  "image"
>;

export const ImageCard = memo(function ImageCard({
  data,
}: NodeProps<ImageNode>) {
  const entrance = useCardEntrance();
  const frame = useRef<HTMLDivElement>(null);
  const press = useRef(new DocumentPress());
  const click = useRef(false);
  const [open, setOpen] = useState(false);
  return (
    <section
      style={entrance}
      className="canvas-card canvas-image-card"
      aria-label={`Image: ${data.name}`}
    >
      <NodeResizer
        isVisible={data.editable}
        minWidth={180}
        minHeight={160}
        maxWidth={geometryLimits.maxSize}
        maxHeight={geometryLimits.maxSize}
      />
      <div
        ref={frame}
        className="canvas-image-frame"
        role={data.url ? "button" : undefined}
        tabIndex={data.url ? 0 : undefined}
        aria-label={`Open image: ${data.name}`}
        onPointerDown={(event) => {
          click.current = false;
          press.current.begin(
            event.pointerId,
            { x: event.clientX, y: event.clientY },
            event.button !== 0 || event.shiftKey,
          );
        }}
        onPointerMove={(event) =>
          press.current.move(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          })
        }
        onPointerUp={(event) => {
          click.current = press.current.release(
            event.pointerId,
            { x: event.clientX, y: event.clientY },
            event.shiftKey,
          );
        }}
        onPointerCancel={() => {
          press.current.cancel();
          click.current = false;
        }}
        onClick={() => {
          if (click.current && data.url) setOpen(true);
          click.current = false;
        }}
        onKeyDown={(event) => {
          if (data.url && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }
        }}
      >
        {data.url ? (
          <img
            src={data.url}
            alt={data.aiDescription || data.name}
            draggable={false}
          />
        ) : (
          <span>Image unavailable</span>
        )}
      </div>
      {open && data.url && frame.current && (
        <ImageLightbox
          url={data.url}
          name={data.name}
          origin={frame.current}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
});
