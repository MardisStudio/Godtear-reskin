import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { buzz } from "./haptic";
import { fanOffset, wrap } from "./math";

export type FanItem = {
  key: string;
  src: string;
  alt: string;
};

const TAP_PX = 12;
const SHOW = 3.35;
const STEP = 0.42;
const CARD_RATIO = 1429 / 2000;

export function Fan({
  items,
  index,
  onIndex,
  onActivate,
  activateOnSide,
  dimSides,
}: {
  items: FanItem[];
  index: number;
  onIndex: (index: number) => void;
  onActivate: (index: number) => void;
  activateOnSide: boolean;
  dimSides: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [shift, setShift] = useState(0);
  const [dragging, setDragging] = useState(false);
  const shiftRef = useRef(0);
  const indexRef = useRef(index);
  const spacingRef = useRef(1);
  const tickRef = useRef(index);
  const settleTimer = useRef(0);
  const settling = useRef(false);
  const drag = useRef({
    id: -1,
    x: 0,
    y: 0,
    lastX: 0,
    lastT: 0,
    vx: 0,
    moved: false,
  });

  indexRef.current = index;
  shiftRef.current = shift;

  useEffect(() => {
    const el = stageRef.current;

    if (!el) {
      return;
    }

    const apply = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    const block = (event: TouchEvent) => event.preventDefault();
    el.addEventListener("touchmove", block, { passive: false });

    return () => {
      observer.disconnect();
      el.removeEventListener("touchmove", block);
      window.clearTimeout(settleTimer.current);
    };
  }, []);

  const TITLE = 36;
  const lift = TITLE + 4;
  const cardH = Math.max(1, box.h - lift - 8);
  const cardW = cardH * CARD_RATIO;
  const radius = Math.max(cardW * 3.05, 1);
  const titleStep = Math.max(cardW * 1.05, 1);
  spacingRef.current = radius * STEP;

  const count = items.length;
  const cursor = index + shift;
  const spin = -shift * STEP;
  const glide = dragging ? "none" : "transform 560ms cubic-bezier(.22,.8,.2,1)";
  const titleEase = dragging ? "none" : "opacity 560ms cubic-bezier(.22,.8,.2,1)";

  function commit(steps: number) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      if (steps !== 0) {
        onIndex(wrap(indexRef.current + steps, count));
      }

      setDragging(true);
      setShift(0);
      requestAnimationFrame(() => setDragging(false));
      return;
    }

    if (steps === 0) {
      setDragging(false);
      setShift(0);
      return;
    }

    settling.current = true;
    setDragging(false);
    setShift(steps);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      onIndex(wrap(indexRef.current + steps, count));
      setDragging(true);
      setShift(0);
      settling.current = false;
      requestAnimationFrame(() => setDragging(false));
    }, 560);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || settling.current) {
      return;
    }

    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Released before capture, still track the gesture.
    }

    tickRef.current = indexRef.current;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastT: performance.now(),
      vx: 0,
      moved: false,
    };
    setDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current.id !== event.pointerId) {
      return;
    }

    const now = performance.now();
    const dt = now - drag.current.lastT;

    if (dt > 0 && dt < 80) {
      const instant = (event.clientX - drag.current.lastX) / dt;
      drag.current.vx = drag.current.vx * 0.55 + instant * 0.45;
    }

    drag.current.lastX = event.clientX;
    drag.current.lastT = now;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;

    if (Math.hypot(dx, dy) > TAP_PX) {
      drag.current.moved = true;
    }

    const nextShift = (drag.current.x - event.clientX) / spacingRef.current;
    const landed = wrap(Math.round(indexRef.current + nextShift), count);

    if (landed !== tickRef.current) {
      tickRef.current = landed;
      buzz("tick");
    }

    setShift(nextShift);
  }

  function finish(clientX: number, clientY: number) {
    const info = drag.current;
    drag.current.id = -1;
    setDragging(false);

    const dx = clientX - info.x;
    const dy = clientY - info.y;

    if (!info.moved && Math.hypot(dx, dy) < TAP_PX) {
      const node = document.elementFromPoint(clientX, clientY)?.closest("[data-index]");

      if (node) {
        const picked = Number(node.getAttribute("data-index"));
        const delta = fanOffset(picked, indexRef.current, count);
        buzz("tap");

        if (activateOnSide || Math.abs(delta) < 0.55) {
          onActivate(picked);
          setShift(0);
        } else {
          commit(Math.round(delta));
        }
      }

      return;
    }

    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 28) {
      setShift(0);
      return;
    }

    const flick = Math.max(-3, Math.min(3, (-info.vx * 170) / spacingRef.current));
    const steps = Math.max(-3, Math.min(3, Math.round(shiftRef.current + flick)));

    if (steps !== 0) {
      buzz("snap");
    }

    commit(steps);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current.id !== event.pointerId) {
      return;
    }

    finish(event.clientX, event.clientY);
  }

  function onPointerCancel() {
    drag.current.id = -1;
    setDragging(false);
    setShift(0);
  }

  return (
    <div
      ref={stageRef}
      className="stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {box.h > 0 && (
        <div
          className="wheel"
          style={{
            bottom: lift + cardH / 2 - radius,
            transform: `rotate(${spin}rad)`,
            transition: glide,
          }}
        >
          {items.map((item, itemIndex) => {
            const visual = fanOffset(itemIndex, cursor, count);

            if (Math.abs(visual) > SHOW) {
              return null;
            }

            const dist = Math.abs(visual);
            const opacity = dimSides
              ? dist < 2.15
                ? Math.max(0.22, 1 - dist * 0.34)
                : Math.max(0, 0.27 * (1 - (dist - 2.15) / 1.15))
              : Math.max(0, Math.min(1, (SHOW - dist) / 0.55));
            const slot = fanOffset(itemIndex, index, count) * STEP;

            return (
              <div
                key={item.key}
                className="spoke"
                style={{
                  transform: `rotate(${slot}rad)`,
                  transition: glide,
                }}
              >
                <button
                  type="button"
                  className="fan-card"
                  data-index={itemIndex}
                  data-src={item.src}
                  aria-label={item.alt}
                  aria-current={Math.abs(visual) < 0.5 ? "true" : undefined}
                  tabIndex={-1}
                  style={{
                    width: cardW,
                    height: cardH,
                    top: -radius,
                    opacity,
                    zIndex: Math.round(100 - dist * 12),
                    pointerEvents: opacity < 0.25 ? "none" : "auto",
                    transform: "translate(-50%, -50%)",
                    transition: dragging ? "none" : "opacity 420ms ease",
                  }}
                >
                  <img src={item.src} alt="" draggable={false} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {box.h > 0 && (
        <div
          className="title-row"
          style={{
            transform: `translateX(${-shift * titleStep}px)`,
            transition: glide,
          }}
        >
          {items.map((item, itemIndex) => {
            const slot = fanOffset(itemIndex, index, count);

            if (Math.abs(slot) > 3) {
              return null;
            }

            const visual = fanOffset(itemIndex, cursor, count);

            return (
              <p
                key={item.key}
                className="spoke-title is-focus"
                style={{
                  left: slot * titleStep,
                  opacity: Math.max(0, 1 - Math.abs(visual)),
                  zIndex: Math.round((1 - Math.abs(visual)) * 10),
                  transition: titleEase,
                }}
              >
                {item.alt}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
