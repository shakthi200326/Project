import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FaGreaterThan, FaLessThan } from "react-icons/fa";

/**
 * Shared sub-module tab navigation.
 *  - No visible scrollbar / moving line.
 *  - "<" and ">" buttons (react-icons FaLessThan / FaGreaterThan).
 *  - Mouse wheel, touchpad two-finger swipe and click-drag scroll the strip horizontally.
 *  - The active tab (aria-selected / data-active / aria-current) is kept in view.
 *
 * <TabStrip>        - just the scrolling strip (use when you render your own < > buttons)
 * <ScrollableTabs>  - strip + built-in < > scroll buttons
 */
export const TAB_ARROW_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs transition-all hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-zinc-800";

const HIDE_SCROLLBAR = "tab-strip-clean " +
  "overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const ACTIVE_SELECTOR =
  '[aria-selected="true"],[data-active="true"],[aria-current="page"],[aria-current="true"]';

export const TabStrip = forwardRef(function TabStrip(
  { children, className = "", onScrollState, role = "tablist", ...rest },
  ref
) {
  const stripRef = useRef(null);
  const lastActive = useRef(null);
  const drag = useRef({ down: false, moved: false, startX: 0, startLeft: 0 });
  useImperativeHandle(ref, () => stripRef.current);

  const report = useCallback(() => {
    const el = stripRef.current;
    if (!el || !onScrollState) return;
    onScrollState({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, [onScrollState]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return undefined;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(report) : null;
    ro?.observe(el);
    window.addEventListener("resize", report);

    // Wheel / touchpad: map vertical wheel to horizontal scroll (needs non-passive listener).
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      const before = el.scrollLeft;
      el.scrollLeft += delta;
      if (el.scrollLeft !== before) e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", report);
      el.removeEventListener("wheel", onWheel);
    };
  }, [report]);

  // Keep the active tab visible whenever it changes.
  useEffect(() => {
    const el = stripRef.current;
    const active = el?.querySelector(ACTIVE_SELECTOR);
    if (el && active && active !== lastActive.current) {
      const left = active.offsetLeft - el.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
      el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
    lastActive.current = active || null;
    report();
  });

  const onMouseDown = (e) => {
    if (e.button !== 0 || !stripRef.current) return;
    drag.current = { down: true, moved: false, startX: e.clientX, startLeft: stripRef.current.scrollLeft };
  };
  const onMouseMove = (e) => {
    const d = drag.current;
    if (!d.down) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 5) d.moved = true;
    if (d.moved) stripRef.current.scrollLeft = d.startLeft - dx;
  };
  const endDrag = () => {
    drag.current.down = false;
    // a click (if any) fires right after mouseup; clear the flag afterwards so it never blocks later clicks
    setTimeout(() => {
      drag.current.moved = false;
    }, 0);
  };
  const onClickCapture = (e) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <div
      {...rest}
      ref={stripRef}
      role={role}
      onScroll={report}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onClickCapture={onClickCapture}
      className={`${className} ${HIDE_SCROLLBAR}`}
    >
      {children}
    </div>
  );
});

export function ScrollableTabs({
  children,
  className = "",
  stripClassName = "flex items-center gap-2",
  role = "tablist",
  ...rest
}) {
  const stripRef = useRef(null);
  const [state, setState] = useState({ left: false, right: false });
  // Only update when something really changed, otherwise every render re-triggers the strip's
  // scroll check and causes an endless render loop (UI hangs).
  const setScrollState = useCallback(
    (next) => setState((prev) => (prev.left === next.left && prev.right === next.right ? prev : next)),
    []
  );

  const scrollByDir = (dir) => {
    const el = stripRef.current;
    el?.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: "smooth" });
  };

  const overflowing = state.left || state.right;

  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      {overflowing && (<button
        type="button"
        onClick={() => scrollByDir(-1)}
        disabled={!state.left}
        aria-label="Scroll tabs left"
        title="Previous"
        className={TAB_ARROW_CLASS}
      >
        <FaLessThan className="h-3 w-3" />
      </button>)}
      <TabStrip
        {...rest}
        ref={stripRef}
        role={role}
        onScrollState={setScrollState}
        className={`min-w-0 flex-1 ${stripClassName}`}
      >
        {children}
      </TabStrip>
      {overflowing && (<button
        type="button"
        onClick={() => scrollByDir(1)}
        disabled={!state.right}
        aria-label="Scroll tabs right"
        title="Next"
        className={TAB_ARROW_CLASS}
      >
        <FaGreaterThan className="h-3 w-3" />
      </button>)}
    </div>
  );
}

export default ScrollableTabs;
