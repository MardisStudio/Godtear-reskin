import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { wrap } from "./math";
import { faceSrc, type Face } from "./roster";
import { textFrame } from "./Table";

const TAP_PX = 12;
const SWIPE_AT = 0.22;
const GLIDE_MS = 420;
const CARD_RATIO = 1429 / 2000;

type Slot = "champion" | "ultimate" | "follower";

const SLOTS: Slot[] = ["champion", "ultimate", "follower"];

const BLANK = { champion: false, ultimate: false, follower: false };

type Flips = typeof BLANK;

function slotDelta(slot: Slot) {
  if (slot === "champion") {
    return -1;
  }

  if (slot === "follower") {
    return 1;
  }

  return 0;
}

function pair(slot: Slot): { front: Face; back: Face } {
  if (slot === "champion") {
    return { front: "champion-clash", back: "champion-plot" };
  }

  if (slot === "follower") {
    return { front: "follower-clash", back: "follower-plot" };
  }

  return { front: "ultimate", back: "identity" };
}

export function Trio({
  ids,
  index,
  spin,
  direction,
  onStep,
  onRead,
}: {
  ids: string[];
  index: number;
  spin: number;
  direction: number;
  onStep: (direction: number) => void;
  onRead: (src: string, from: DOMRect) => void;
}) {
  const champId = ids[index];
  const [seen, setSeen] = useState(champId);
  const [flips, setFlips] = useState<Flips>(BLANK);
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [slide, setSlide] = useState(0);
  const [live, setLive] = useState(false);
  const slideRef = useRef(0);
  const gapRef = useRef(1);
  const settling = useRef(false);
  const glideTimer = useRef(0);
  const glideRef = useRef<(target: number) => void>(() => {});
  const spinSeen = useRef(spin);
  const drag = useRef({
    id: -1,
    x: 0,
    y: 0,
    lastX: 0,
    lastT: 0,
    vx: 0,
    moved: false,
  });

  slideRef.current = slide;

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
      window.clearTimeout(glideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (spin === spinSeen.current) {
      return;
    }

    spinSeen.current = spin;

    if (settling.current) {
      return;
    }

    const dir = Math.sign(direction);

    if (dir === 0) {
      return;
    }

    glideRef.current(dir);
  }, [direction, spin]);

  const faceUp = seen === champId ? flips : BLANK;

  if (seen !== champId) {
    setSeen(champId);
    setFlips(BLANK);
  }

  const lift = box.h * 0.08 + 12;
  const cardH = Math.max(1, (box.h - lift) * 0.96);
  const cardW = cardH * CARD_RATIO;
  const spacing = cardW * 0.62;
  const gap = Math.max(box.w * 0.92, cardW * 2.5);
  gapRef.current = gap;

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || settling.current) {
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
    setLive(true);
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

    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > TAP_PX) {
      return;
    }

    const next = Math.max(-1.15, Math.min(1.15, -dx / gapRef.current));
    slideRef.current = next;
    setSlide(next);
  }

  function glide(target: number) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (target === 0 || reduce) {
      if (target !== 0) {
        onStep(target);
      }

      setLive(true);
      setSlide(0);
      slideRef.current = 0;
      requestAnimationFrame(() => setLive(false));
      return;
    }

    settling.current = true;
    setLive(false);
    setSlide(target);
    slideRef.current = target;
    window.clearTimeout(glideTimer.current);
    glideTimer.current = window.setTimeout(() => {
      onStep(target);
      setLive(true);
      setSlide(0);
      slideRef.current = 0;
      settling.current = false;
      requestAnimationFrame(() => setLive(false));
    }, GLIDE_MS);
  }

  glideRef.current = glide;

  function finish(clientX: number, clientY: number) {
    const info = drag.current;
    drag.current.id = -1;
    setLive(false);

    const dx = clientX - info.x;
    const dy = clientY - info.y;

    if (!info.moved && Math.hypot(dx, dy) < TAP_PX) {
      const hit = document.elementFromPoint(clientX, clientY);
      const card = hit?.closest("[data-slot]");
      const zone = hit?.closest("[data-zone]")?.getAttribute("data-zone");
      setSlide(0);
      slideRef.current = 0;

      if (!card || card.getAttribute("data-page") !== "0") {
        return;
      }

      const slot = card.getAttribute("data-slot") as Slot;

      if (zone === "text") {
        const src = card.getAttribute("data-src") ?? "";
        onRead(src, textFrame(card.getBoundingClientRect()));
        return;
      }

      setFlips((current) => ({ ...current, [slot]: !current[slot] }));
      return;
    }

    if (Math.abs(dy) > Math.abs(dx)) {
      glide(0);
      return;
    }

    const speed = -info.vx;
    let target = 0;

    if (slideRef.current > SWIPE_AT || (speed > 0.45 && slideRef.current > 0.04)) {
      target = 1;
    } else if (slideRef.current < -SWIPE_AT || (speed < -0.45 && slideRef.current < -0.04)) {
      target = -1;
    }

    glide(target);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current.id !== event.pointerId) {
      return;
    }

    finish(event.clientX, event.clientY);
  }

  function onPointerCancel() {
    if (drag.current.id === -1) {
      return;
    }

    drag.current.id = -1;
    setLive(false);
    glide(0);
  }

  const pages = [-1, 0, 1];

  return (
    <div
      ref={stageRef}
      className="stage trio-stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {box.h > 0 &&
        pages.map((rel) => {
          const champIndex = wrap(index + rel, ids.length);
          const id = ids[champIndex];

          return (
            <div
              key={id}
              className="trio-page"
              style={{
                transform: `translateX(${(rel - slide) * gap}px)`,
                transition: live ? "none" : `transform ${GLIDE_MS}ms cubic-bezier(.22,.8,.2,1)`,
              }}
            >
              {SLOTS.map((slot) => {
                const delta = slotDelta(slot);
                const faces = pair(slot);
                const flipped = rel === 0 && faceUp[slot];
                const shown = flipped ? faces.back : faces.front;
                const scale = 1.05 - Math.abs(delta) * 0.07;

                return (
                  <div
                    key={slot}
                    className="trio-card"
                    data-slot={slot}
                    data-page={String(rel)}
                    data-src={faceSrc(id, shown)}
                    style={{
                      width: cardW,
                      height: cardH,
                      bottom: lift,
                      zIndex: 10 - Math.abs(delta),
                      transformOrigin: "50% 132%",
                      transform: `translateX(-50%) translateX(${delta * spacing}px) translateY(${Math.abs(delta) * 10 + delta * delta * 4}px) rotate(${delta * 11}deg) scale(${scale})`,
                    }}
                  >
                    <div className={`slot${flipped ? " is-flipped" : ""}${rel === 0 ? "" : " instant"}`}>
                      <div className="flip">
                        <div className="face front">
                          <img src={faceSrc(id, faces.front)} alt="" draggable={false} />
                        </div>
                        <div className="face back">
                          <img src={faceSrc(id, faces.back)} alt="" draggable={false} />
                        </div>
                      </div>
                    </div>
                    <span className="trio-hit art" data-zone="art" />
                    <span className="trio-hit text" data-zone="text" />
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}
