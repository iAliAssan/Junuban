import { useEffect, type RefObject } from "react";

/**
 * Closes an open popover/menu on Escape or on a click outside `ref`'s
 * element. Shared by SortMenu and FilterPanel rather than each
 * reimplementing the same dismiss logic.
 */
export function useDismissiblePopover(
  ref: RefObject<HTMLElement>,
  open: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    function onPointerDown(e: PointerEvent) {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
