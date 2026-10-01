import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Reference } from "./Reference";
import { TEXT_BOTTOM, TEXT_TOP, faceSrc, type Side } from "./roster";

const HOLD_MS = 520;
const TAP_PX = 12;
const LEAVE_PX = 92;
const SHEET_PX = 72;

const CARD_TALL = 2000 / 1429;

export function textFrame(card: DOMRect) {
  return new DOMRect(
    card.left,
    card.top + card.height * TEXT_TOP,
    card.width,
    card.height * (TEXT_BOTTOM - TEXT_TOP),
  );
}

export function Zoom({ src, from, onClose }: { src: string; from: DOMRect; onClose: () => void }) {
  const shot = useRef<HTMLDivElement>(null);
  const slice = TEXT_BOTTOM - TEXT_TOP;
  const aspect = 1 / (slice * CARD_TALL);

  useLayoutEffect(() => {
    const el = shot.current;

    if (!el) {
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const end = el.getBoundingClientRect();
    const sx = from.width / end.width;
    const sy = from.height / end.height;

    if (reduce || !Number.isFinite(sx) || sx <= 0) {
      return;
    }

    const dx = from.left - end.left;
    const dy = from.top - end.top;
    el.style.transition = "none";
    el.style.transformOrigin = "top left";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    void el.offsetWidth;
    requestAnimationFrame(() => {
      el.style.transition = "transform 340ms cubic-bezier(0.2, 0.8, 0.2, 1)";
      el.style.transform = "none";
    });
  }, [from]);

  return (
    <div
      className="zoom"
      role="dialog"
      aria-label="Card text"
      onPointerDown={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div ref={shot} className="zoom-shot" style={{ ["--frame" as string]: String(aspect) }}>
        <img src={src} alt="" draggable={false} style={{ marginTop: `${-(TEXT_TOP * CARD_TALL * 100)}%` }} />
      </div>
    </div>
  );
}

export function Table({
  championId,
  championSide,
  followerSide,
  ultimateUsed,
  onChampionSide,
  onFollowerSide,
  onUltimateUsed,
  onZoom,
  onLeave,
}: {
  championId: string;
  championSide: Side;
  followerSide: Side;
  ultimateUsed: boolean;
  onChampionSide: (side: Side) => void;
  onFollowerSide: (side: Side) => void;
  onUltimateUsed: (used: boolean) => void;
  onZoom: (src: string, from: DOMRect) => void;
  onLeave: () => void;
}) {
  const [shake, setShake] = useState(false);
  const [holding, setHolding] = useState(false);
  const [pull, setPull] = useState(0);
  const [lift, setLift] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pullRef = useRef(0);
  const drag = useRef({ id: -1, x: 0, y: 0 });

  useEffect(() => {
    const block = (event: TouchEvent) => event.preventDefault();
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, []);

  function tapUltimate() {
    if (ultimateUsed) {
      setShake(true);
      window.setTimeout(() => setShake(false), 320);
      return;
    }

    onUltimateUsed(true);
  }

  function undoUltimate() {
    setHolding(false);
    onUltimateUsed(false);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current.id !== event.pointerId) {
      return;
    }

    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;

    if ((dy < -TAP_PX && -dy > Math.abs(dx)) || dy > TAP_PX) {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }

    if (dy < -TAP_PX && -dy > Math.abs(dx)) {
      setPull(0);
      pullRef.current = 0;
      setLift(-dy);
      return;
    }

    setLift(0);
    const next = dy > 0 ? dy : 0;
    pullRef.current = next;
    setPull(next);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current.id !== event.pointerId) {
      return;
    }

    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current.id = -1;
    pullRef.current = 0;
    setPull(0);
    setLift(0);

    if (-dy > SHEET_PX && -dy > Math.abs(dx) * 1.35) {
      setSheetOpen(true);
      return;
    }

    if (dy > LEAVE_PX && dy > Math.abs(dx) * 1.35) {
      onLeave();
    }
  }

  function onPointerCancel() {
    drag.current.id = -1;
    pullRef.current = 0;
    setPull(0);
    setLift(0);
  }

  return (
    <div
      className={`table-screen${pull > 0 ? " pulling" : ""}`}
      style={{ transform: `translateY(${Math.min(pull, 140) * 0.28}px)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="table">
        <Card
          front={faceSrc(championId, "champion-clash")}
          back={faceSrc(championId, "champion-plot")}
          flipped={championSide === "plot"}
          artLabel="Flip champion"
          textLabel="Read champion text"
          onArt={() => onChampionSide(championSide === "clash" ? "plot" : "clash")}
          onText={onZoom}
        />
        <Card
          front={faceSrc(championId, "ultimate")}
          back={faceSrc(championId, "identity")}
          flipped={ultimateUsed}
          shake={shake}
          holding={holding}
          artLabel={ultimateUsed ? "Ultimate spent" : "Use ultimate"}
          textLabel="Read ultimate text"
          onArt={tapUltimate}
          onHold={ultimateUsed ? undoUltimate : undefined}
          onHoldStart={ultimateUsed ? () => setHolding(true) : undefined}
          onHoldEnd={() => setHolding(false)}
          onText={onZoom}
        />
        <Card
          front={faceSrc(championId, "follower-clash")}
          back={faceSrc(championId, "follower-plot")}
          flipped={followerSide === "plot"}
          artLabel="Flip follower"
          textLabel="Read follower text"
          onArt={() => onFollowerSide(followerSide === "clash" ? "plot" : "clash")}
          onText={onZoom}
        />
      </div>
      <p className="hint">
        {ultimateUsed
          ? "Hold the ultimate picture to undo · swipe up for rules"
          : "Tap a picture to flip · tap text to read · swipe up for rules"}
      </p>
      {pull > 28 && (
        <div className="pull-pill">{pull > LEAVE_PX ? "Release to return" : "Swipe down to return"}</div>
      )}
      {lift > 16 && !sheetOpen && (
        <div className="pull-pill up">{lift > SHEET_PX ? "Release for rules" : "Swipe up for rules"}</div>
      )}
      <Reference open={sheetOpen} lift={lift} onClose={() => setSheetOpen(false)} />
    </div>
  );
}

function Card({
  front,
  back,
  flipped,
  shake,
  holding,
  artLabel,
  textLabel,
  onArt,
  onHold,
  onHoldStart,
  onHoldEnd,
  onText,
}: {
  front: string;
  back: string;
  flipped: boolean;
  shake?: boolean;
  holding?: boolean;
  artLabel: string;
  textLabel: string;
  onArt: () => void;
  onHold?: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  onText: (src: string, from: DOMRect) => void;
}) {
  const className = ["slot", flipped ? "is-flipped" : "", shake ? "shake" : "", holding ? "holding" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="flip">
        <Face
          src={front}
          side="front"
          hidden={flipped}
          artLabel={artLabel}
          textLabel={textLabel}
          onArt={onArt}
          onHold={onHold}
          onHoldStart={onHoldStart}
          onHoldEnd={onHoldEnd}
          onText={(from) => onText(front, from)}
        />
        <Face
          src={back}
          side="back"
          hidden={!flipped}
          artLabel={artLabel}
          textLabel={textLabel}
          onArt={onArt}
          onHold={onHold}
          onHoldStart={onHoldStart}
          onHoldEnd={onHoldEnd}
          onText={(from) => onText(back, from)}
        />
      </div>
    </div>
  );
}

function Face({
  src,
  side,
  hidden,
  artLabel,
  textLabel,
  onArt,
  onHold,
  onHoldStart,
  onHoldEnd,
  onText,
}: {
  src: string;
  side: "front" | "back";
  hidden: boolean;
  artLabel: string;
  textLabel: string;
  onArt: () => void;
  onHold?: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  onText: (from: DOMRect) => void;
}) {
  return (
    <div className={`face ${side}`} inert={hidden} aria-hidden={hidden}>
      <img src={src} alt="" draggable={false} />
      <Press
        className="hit art"
        label={artLabel}
        onTap={onArt}
        onHold={onHold}
        onHoldStart={onHoldStart}
        onHoldEnd={onHoldEnd}
      />
      <Press
        className="hit text"
        label={textLabel}
        onTap={(el) => onText(textFrame(el.closest(".face")!.getBoundingClientRect()))}
      />
    </div>
  );
}

function Press({
  className,
  label,
  onTap,
  onHold,
  onHoldStart,
  onHoldEnd,
}: {
  className: string;
  label: string;
  onTap: (el: HTMLButtonElement) => void;
  onHold?: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
}) {
  const state = useRef({ x: 0, y: 0, held: false, timer: 0 });

  function clearTimer() {
    window.clearTimeout(state.current.timer);
    state.current.timer = 0;
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        state.current.x = event.clientX;
        state.current.y = event.clientY;
        state.current.held = false;
        clearTimer();

        if (!onHold) {
          return;
        }

        onHoldStart?.();
        state.current.timer = window.setTimeout(() => {
          state.current.held = true;
          onHold();
        }, HOLD_MS);
      }}
      onPointerMove={(event) => {
        const dx = event.clientX - state.current.x;
        const dy = event.clientY - state.current.y;

        if (Math.hypot(dx, dy) > TAP_PX) {
          clearTimer();
          onHoldEnd?.();
        }
      }}
      onPointerUp={(event) => {
        clearTimer();
        onHoldEnd?.();
        const dx = event.clientX - state.current.x;
        const dy = event.clientY - state.current.y;

        if (state.current.held || Math.hypot(dx, dy) > TAP_PX) {
          return;
        }

        onTap(event.currentTarget);
      }}
      onPointerCancel={() => {
        clearTimer();
        onHoldEnd?.();
      }}
    />
  );
}
