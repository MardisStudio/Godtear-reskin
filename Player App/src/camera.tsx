import { useRef, type PointerEvent as ReactPointerEvent } from "react";

const TAP_PX = 12;

export const ZOOM_MS = 480;

export type Cam = { s: number; x: number; y: number };

export const REST_CAM: Cam = { s: 1, x: 0, y: 0 };

const EDGE = 12;

export function camFor(frame: DOMRect, viewW: number, viewH: number, cardBottom = 0): Cam {
  let scale = Math.min((viewW * 0.94) / frame.width, (viewH * 0.9) / frame.height);
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const below = cardBottom - cy;

  if (below > 0) {
    scale = Math.min(scale, (viewH / 2 - EDGE) / below);
  }

  return {
    s: scale,
    x: viewW / 2 - cx * scale,
    y: viewH / 2 - cy * scale,
  };
}

export function mixCam(from: Cam, to: Cam, amount: number): Cam {
  return {
    s: from.s + (to.s - from.s) * amount,
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}

export function camCss(cam: Cam) {
  return `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})`;
}

export function ZoomCatch({
  onScrub,
  onDrop,
  onTap,
}: {
  onScrub: (dx: number) => void;
  onDrop: (dx: number, vx: number) => void;
  onTap: () => void;
}) {
  const drag = useRef({ id: -1, x: 0, y: 0, lastX: 0, lastT: 0, vx: 0, moved: false });

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Released before capture, still track the gesture.
    }

    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastT: performance.now(),
      vx: 0,
      moved: false,
    };
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

    onScrub(dx);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current.id !== event.pointerId) {
      return;
    }

    const info = drag.current;
    drag.current.id = -1;
    const dx = event.clientX - info.x;

    if (!info.moved) {
      onTap();
      return;
    }

    onDrop(dx, info.vx);
  }

  function onPointerCancel() {
    if (drag.current.id === -1) {
      return;
    }

    drag.current.id = -1;
    onDrop(0, 0);
  }

  return (
    <div
      className="zoom-catch"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
  );
}
