import { useCallback, useRef, useState } from "react";

export interface UsePanelResizeOptions {
  /** localStorage key for persistence */
  storageKey: string;
  /** default percentage (0–100) */
  defaultPercent?: number;
  minPercent?: number;
  maxPercent?: number;
}

/**
 * Drag-to-resize a split panel, returning a percentage (0–100).
 * Pass the container element that defines the total size along the drag axis.
 */
export function usePanelResize({
  storageKey,
  defaultPercent = 50,
  minPercent = 20,
  maxPercent = 80,
}: UsePanelResizeOptions) {
  const [percent, setPercent] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved != null) {
        const n = Number(saved);
        if (!Number.isNaN(n) && n >= minPercent && n <= maxPercent) return n;
      }
    } catch {
      /* ignore */
    }
    return defaultPercent;
  });

  const percentRef = useRef(percent);
  percentRef.current = percent;

  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const startDrag = useCallback(
    (e: React.PointerEvent, container: HTMLElement | null, axis: "x" | "y") => {
      if (!container) return;
      e.preventDefault();
      e.stopPropagation();

      const startPos = axis === "x" ? e.clientX : e.clientY;
      const startPercent = percentRef.current;
      const size = axis === "x" ? container.getBoundingClientRect().width : container.getBoundingClientRect().height;
      if (size <= 0) return;

      draggingRef.current = true;
      setDragging(true);
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        if (!draggingRef.current) return;
        const delta = (axis === "x" ? ev.clientX : ev.clientY) - startPos;
        const next = Math.min(
          maxPercent,
          Math.max(minPercent, startPercent + (delta / size) * 100),
        );
        percentRef.current = next;
        setPercent(next);
      };

      const onUp = () => {
        draggingRef.current = false;
        setDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        try {
          localStorage.setItem(storageKey, String(percentRef.current));
        } catch {
          /* ignore */
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [storageKey, minPercent, maxPercent],
  );

  const reset = useCallback(() => {
    setPercent(defaultPercent);
    percentRef.current = defaultPercent;
    try {
      localStorage.setItem(storageKey, String(defaultPercent));
    } catch {
      /* ignore */
    }
  }, [defaultPercent, storageKey]);

  return { percent, setPercent, dragging, startDrag, reset };
}
