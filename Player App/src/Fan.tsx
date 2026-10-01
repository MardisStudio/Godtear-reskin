import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { fanOffset, wrap } from "./math";
import { TEXT_BOTTOM, TEXT_TOP } from "./roster";

export type FanItem = {
  key: string;
  src: string;
  alt: string;
};

const TAP_PX = 12;
const WINDOW = 2.55;
const CARD_RATIO = 1429 / 2000;

export function Fan({
  items,
  index,
  onIndex,
  onActivate,
  onRead,
  activateOnSide,
  dimSides,
}: {
  items: FanItem[];
  index: number;
  onIndex: (index: number) => void;
  onActivate: (index: number) => void;
  onRead: (src: string, from: DOMRect) => void;
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
    };
  }, []);

  const lift = box.h * 0.16 + 28;
  const cardH = Math.max(1, (box.h - lift) * 0.9);
  const cardW = cardH * CARD_RATIO;
  const spacing = Math.max(1, cardW * 0.56);
  spacingRef.current = spacing;

  const count = items.length;
  const cursor = index + shift;

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
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

    setShift((drag.current.x - event.clientX) / spacingRef.current);
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
        const spot = document.elementFromPoint(clientX, clientY)?.closest("[data-zone]");

        if (spot?.getAttribute("data-zone") === "text" && Math.abs(delta) < 0.55) {
          const card = node.getBoundingClientRect();
          onRead(node.getAttribute("data-src") ?? "", new DOMRect(
            card.left,
            card.top + card.height * TEXT_TOP,
            card.width,
            card.height * (TEXT_BOTTOM - TEXT_TOP),
          ));
          setShift(0);
          return;
        }

        if (activateOnSide || Math.abs(delta) < 0.55) {
          onActivate(picked);
        } else {
          onIndex(picked);
        }
      }

      setShift(0);
      return;
    }

    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 28) {
      setShift(0);
      return;
    }

    const flick = Math.max(-3, Math.min(3, (-info.vx * 170) / spacingRef.current));
    const next = wrap(Math.round(indexRef.current + shiftRef.current + flick), count);
    setShift(0);
    onIndex(next);
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
      {box.h > 0 &&
        items.map((item, itemIndex) => {
          const delta = fanOffset(itemIndex, cursor, count);

          if (Math.abs(delta) > WINDOW) {
            return null;
          }

          const opacity = dimSides
            ? Math.max(0.32, 1 - Math.abs(delta) * 0.34)
            : Math.max(0, Math.min(1, (WINDOW - Math.abs(delta)) / 0.5));
          const scale = 1.03 - Math.min(0.22, Math.abs(delta) * 0.06);

          return (
            <button
              key={item.key}
              type="button"
              className="fan-card"
              data-index={itemIndex}
              data-src={item.src}
              aria-label={item.alt}
              aria-current={Math.abs(delta) < 0.5 ? "true" : undefined}
              tabIndex={-1}
              style={{
                width: cardW,
                height: cardH,
                bottom: lift,
                opacity,
                zIndex: Math.round(100 - Math.abs(delta) * 12),
                pointerEvents: opacity < 0.25 ? "none" : "auto",
                transformOrigin: "50% 132%",
                transform: `translateX(-50%) translateX(${delta * spacing}px) translateY(${Math.abs(delta) * 6 + delta * delta}px) rotate(${delta * 12}deg) scale(${scale})`,
                transition: dragging
                  ? "none"
                  : "transform 460ms cubic-bezier(.22,.8,.2,1), opacity 280ms linear",
              }}
            >
              <img src={item.src} alt="" draggable={false} />
              <span
                className="fan-text"
                data-zone="text"
                style={{ top: `${TEXT_TOP * 100}%`, bottom: `${(1 - TEXT_BOTTOM) * 100}%` }}
              />
            </button>
          );
        })}
    </div>
  );
}
