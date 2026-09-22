import { useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
export function ImageLightbox({
  url,
  name,
  origin,
  onClose,
}: {
  url: string;
  name: string;
  origin: HTMLElement;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const closing = useRef(false);
  const duration = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240;
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const rect = origin.getBoundingClientRect();
    const target = image.current!;
    const animation = target.animate(
      [
        {
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          borderRadius: "16px",
        },
      ],
      {
        duration: duration(),
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "forwards",
      },
    );
    animation.finished
      .then(() => {
        dialog.current?.close();
        onClose();
        origin.focus({ preventScroll: true });
      })
      .catch(() => {});
  }, [origin, onClose]);
  useLayoutEffect(() => {
    const modal = dialog.current!;
    const target = image.current!;
    modal.showModal();
    const fit = () => {
      const ratio = target.naturalWidth / target.naturalHeight;
      if (!Number.isFinite(ratio) || !ratio) return;
      const width = Math.min(
        window.innerWidth - 48,
        (window.innerHeight - 48) * ratio,
      );
      const height = width / ratio;
      Object.assign(target.style, {
        left: `${(window.innerWidth - width) / 2}px`,
        top: `${(window.innerHeight - height) / 2}px`,
        width: `${width}px`,
        height: `${height}px`,
      });
    };
    const open = () => {
      fit();
      const rect = origin.getBoundingClientRect();
      target.animate(
        [
          {
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            borderRadius: "16px",
          },
          {
            left: target.style.left,
            top: target.style.top,
            width: target.style.width,
            height: target.style.height,
            borderRadius: "0px",
          },
        ],
        { duration: duration(), easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    };
    if (target.complete && target.naturalWidth) open();
    else target.addEventListener("load", open, { once: true });
    window.addEventListener("resize", fit);
    return () => {
      target.removeEventListener("load", open);
      window.removeEventListener("resize", fit);
      modal.close();
    };
  }, [origin]);
  return createPortal(
    <dialog
      ref={dialog}
      className="image-lightbox"
      aria-label={name}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) close();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <img ref={image} src={url} alt={name} draggable={false} />
    </dialog>,
    document.body,
  );
}
