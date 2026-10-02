import { useEffect, useRef, useState } from "react";
import { REST_CAM, ZOOM_MS, ZoomCatch, camCss, camFor, mixCam, type Cam } from "./camera";
import { Fan, type FanItem } from "./Fan";
import { buzz } from "./haptic";
import { wrap } from "./math";
import { CHAMPIONS, SET, faceSrc, type Side } from "./roster";
import { Table, type ZoomShot } from "./Table";
import { Trio } from "./Trio";

const SAVE_KEY = "godtear-player";

type Screen = "roster" | "set" | "play";

type Save = {
  championId: string;
  screen: "roster" | "play";
  championSide: Side;
  followerSide: Side;
  ultimateUsed: boolean;
};

type Session = {
  screen: Screen;
  rosterIndex: number;
  championSide: Side;
  followerSide: Side;
  ultimateUsed: boolean;
};

function asSide(value: unknown): Side {
  return value === "plot" ? "plot" : "clash";
}

function readSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);

    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw) as Partial<Save>;

    if (!data.championId || !CHAMPIONS.some((champion) => champion.id === data.championId)) {
      return null;
    }

    return {
      championId: data.championId,
      screen: data.screen === "play" ? "play" : "roster",
      championSide: asSide(data.championSide),
      followerSide: asSide(data.followerSide),
      ultimateUsed: Boolean(data.ultimateUsed),
    };
  } catch {
    return null;
  }
}

function initialSession(): Session {
  const saved = readSave();
  const rosterIndex = saved
    ? CHAMPIONS.findIndex((champion) => champion.id === saved.championId)
    : 0;

  return {
    screen: saved?.screen === "play" ? "play" : "roster",
    rosterIndex: rosterIndex >= 0 ? rosterIndex : 0,
    championSide: saved?.championSide ?? "clash",
    followerSide: saved?.followerSide ?? "clash",
    ultimateUsed: saved?.screen === "play" ? Boolean(saved.ultimateUsed) : false,
  };
}

const OPEN_MS = 260;
const CLOSE_MS = 260;

export function App() {
  const [session, setSession] = useState(initialSession);
  const [zoom, setZoom] = useState<ZoomShot | null>(null);
  const [cam, setCam] = useState<Cam>(REST_CAM);
  const [camLive, setCamLive] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const [veil, setVeil] = useState<"open" | "close" | null>(null);
  const [exit, setExit] = useState(false);
  const [spin, setSpin] = useState(0);
  const spinDir = useRef(1);
  const veilTimer = useRef(0);
  const zoomTimer = useRef(0);
  const closingZoom = useRef(false);
  const champion = CHAMPIONS[session.rosterIndex];

  useEffect(() => {
    const save: Save = {
      championId: champion.id,
      screen: session.screen === "play" ? "play" : "roster",
      championSide: session.championSide,
      followerSide: session.followerSide,
      ultimateUsed: session.screen === "play" && session.ultimateUsed,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [champion.id, session]);

  useEffect(() => {
    const near = [-1, 0, 1].map(
      (offset) => CHAMPIONS[wrap(session.rosterIndex + offset, CHAMPIONS.length)].id,
    );

    for (const id of near) {
      for (const face of SET) {
        const image = new Image();
        image.src = faceSrc(id, face);
      }
    }
  }, [session.rosterIndex]);

  useEffect(
    () => () => {
      window.clearTimeout(veilTimer.current);
      window.clearTimeout(zoomTimer.current);
    },
    [],
  );

  useEffect(() => {
    const lock = () => {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (value: string) => Promise<void>;
      };
      orientation.lock?.("landscape").catch(() => {});
    };

    window.addEventListener("pointerdown", lock, { once: true });
    return () => window.removeEventListener("pointerdown", lock);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (event.defaultPrevented) {
          return;
        }

        if (zoom) {
          closeZoom();
          return;
        }

        if (askLeave) {
          setAskLeave(false);
          return;
        }

        if (session.screen === "set") {
          closeSet();
          return;
        }

        if (session.screen === "play") {
          setAskLeave(true);
        }

        return;
      }

      if (zoom) {
        if (event.key === "ArrowRight") {
          shiftZoom(1);
        } else if (event.key === "ArrowLeft") {
          shiftZoom(-1);
        }

        return;
      }

      if (session.screen === "play" || askLeave) {
        return;
      }

      if (event.key === "ArrowRight") {
        step(1);
      } else if (event.key === "ArrowLeft") {
        step(-1);
      } else if (event.key === "Enter") {
        if (session.screen === "roster") {
          openSet(session.rosterIndex);
        } else {
          confirm();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [askLeave, session.rosterIndex, session.screen, veil, zoom]);

  function viewSize() {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  function openZoom(shot: ZoomShot) {
    if (closingZoom.current || shot.cards.length === 0) {
      return;
    }

    const view = viewSize();
    const index = Math.max(0, Math.min(shot.cards.length - 1, shot.index));
    window.clearTimeout(zoomTimer.current);
    setZoom({ ...shot, index });
    setCamLive(false);
    setCam(camFor(shot.cards[index].from, view.w, view.h, shot.cards[index].bottom));
    buzz("tap");
  }

  function shiftZoom(direction: number) {
    if (!zoom || closingZoom.current) {
      return;
    }

    const index = Math.max(0, Math.min(zoom.cards.length - 1, zoom.index + direction));

    if (index === zoom.index) {
      return;
    }

    const view = viewSize();
    setCamLive(false);
    setZoom({ ...zoom, index });
    setCam(camFor(zoom.cards[index].from, view.w, view.h, zoom.cards[index].bottom));
    buzz("tick");
  }

  function scrubZoom(dx: number) {
    if (!zoom || closingZoom.current) {
      return;
    }

    const view = viewSize();
    const here = camFor(zoom.cards[zoom.index].from, view.w, view.h, zoom.cards[zoom.index].bottom);
    let amount = -dx / view.w;
    const nextIndex = zoom.index + (amount >= 0 ? 1 : -1);

    if (nextIndex < 0 || nextIndex >= zoom.cards.length) {
      amount *= 0.35;
    }

    const clamped = Math.max(-1, Math.min(1, amount));
    const neighbor = zoom.index + (clamped >= 0 ? 1 : -1);

    setCamLive(true);

    if (neighbor < 0 || neighbor >= zoom.cards.length) {
      setCam({ ...here, x: here.x + dx * 0.25 });
      return;
    }

    const next = zoom.cards[neighbor];
    setCam(mixCam(here, camFor(next.from, view.w, view.h, next.bottom), Math.abs(clamped)));
  }

  function dropZoom(dx: number, vx: number) {
    if (!zoom || closingZoom.current) {
      return;
    }

    const width = window.innerWidth;
    let direction = 0;

    if (dx < -width * 0.16 || (vx < -0.45 && dx < -12)) {
      direction = 1;
    } else if (dx > width * 0.16 || (vx > 0.45 && dx > 12)) {
      direction = -1;
    }

    if (direction === 0) {
      const view = viewSize();
      setCamLive(false);
      setCam(camFor(zoom.cards[zoom.index].from, view.w, view.h, zoom.cards[zoom.index].bottom));
      return;
    }

    shiftZoom(direction);
  }

  function closeZoom() {
    if (!zoom || closingZoom.current) {
      return;
    }

    closingZoom.current = true;
    setCamLive(false);
    setCam(REST_CAM);
    buzz("tap");
    window.clearTimeout(zoomTimer.current);
    zoomTimer.current = window.setTimeout(() => {
      closingZoom.current = false;
      setZoom(null);
    }, ZOOM_MS);
  }

  function step(direction: number) {
    if (session.screen === "set") {
      if (veil) {
        return;
      }

      spinDir.current = direction;
      setSpin((n) => n + 1);
      return;
    }

    setSession((current) => ({
      ...current,
      rosterIndex: wrap(current.rosterIndex + direction, CHAMPIONS.length),
    }));
  }

  function openSet(index: number) {
    if (veil) {
      return;
    }

    setZoom(null);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setSession((current) => ({ ...current, screen: "set", rosterIndex: index }));
      return;
    }

    setVeil("open");
    window.clearTimeout(veilTimer.current);
    veilTimer.current = window.setTimeout(() => {
      setVeil(null);
      setSession((current) => ({ ...current, screen: "set", rosterIndex: index }));
    }, OPEN_MS);
  }

  function closeSet() {
    if (veil) {
      return;
    }

    setZoom(null);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setSession((current) => ({ ...current, screen: "roster" }));
      return;
    }

    setVeil("close");
    window.clearTimeout(veilTimer.current);
    veilTimer.current = window.setTimeout(() => {
      setVeil(null);
      setSession((current) => ({ ...current, screen: "roster" }));
    }, CLOSE_MS);
  }

  function confirm() {
    if (veil || exit) {
      return;
    }

    setZoom(null);
    buzz("tap");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const enterPlay = () => {
      setExit(false);
      setSession((current) => ({
        ...current,
        screen: "play",
        championSide: "clash",
        followerSide: "clash",
        ultimateUsed: false,
      }));
    };

    if (reduce) {
      enterPlay();
      return;
    }

    setExit(true);
    window.clearTimeout(veilTimer.current);
    veilTimer.current = window.setTimeout(enterPlay, CLOSE_MS);
  }

  function returnToRoster() {
    setZoom(null);
    setAskLeave(false);
    setSession((current) => ({
      ...current,
      screen: "roster",
      championSide: "clash",
      followerSide: "clash",
      ultimateUsed: false,
    }));
  }

  const rosterItems: FanItem[] = CHAMPIONS.map((entry) => ({
    key: entry.id,
    src: faceSrc(entry.id, "ultimate"),
    alt: entry.name,
  }));

  return (
    <>
      <div className="gate">
        <p className="mark">God Tear</p>
        <p>Turn your phone sideways</p>
      </div>
      <div className="app" data-screen={session.screen} data-zoomed={zoom ? "true" : "false"}>
        <div
          className="world"
          style={{
            transform: camCss(cam),
            transition: camLive ? "none" : `transform ${ZOOM_MS}ms cubic-bezier(0.22, 0.8, 0.2, 1)`,
          }}
        >
        {session.screen !== "play" && (
          <div className={`picker${veil ? ` veil-${veil}` : ""}${exit ? " exit" : ""}`}>
            {session.screen === "set" && (
              <button
                type="button"
                className="close"
                aria-label="Close"
                onClick={() => {
                  buzz("tap");
                  closeSet();
                }}
              >
                ×
              </button>
            )}
            {session.screen === "roster" ? (
              <Fan
                items={rosterItems}
                index={session.rosterIndex}
                onIndex={(rosterIndex) => setSession((current) => ({ ...current, rosterIndex }))}
                onActivate={openSet}
                activateOnSide={false}
                dimSides
              />
            ) : (
              <Trio
                ids={CHAMPIONS.map((entry) => entry.id)}
                index={session.rosterIndex}
                spin={spin}
                direction={spinDir.current}
                onStep={(direction) =>
                  setSession((current) => ({
                    ...current,
                    rosterIndex: wrap(current.rosterIndex + direction, CHAMPIONS.length),
                  }))
                }
                onZoom={openZoom}
              />
            )}
            <div className={session.screen === "set" ? "dock" : "dock quiet"}>
              {session.screen === "set" && (
                <button type="button" className="confirm" onClick={confirm}>
                  Pick {champion.name}
                </button>
              )}
            </div>
          </div>
        )}
        {session.screen === "play" && (
          <Table
            championId={champion.id}
            championSide={session.championSide}
            followerSide={session.followerSide}
            ultimateUsed={session.ultimateUsed}
            onChampionSide={(championSide) => setSession((current) => ({ ...current, championSide }))}
            onFollowerSide={(followerSide) => setSession((current) => ({ ...current, followerSide }))}
            onUltimateUsed={(ultimateUsed) => setSession((current) => ({ ...current, ultimateUsed }))}
            onZoom={openZoom}
            onLeave={() => setAskLeave(true)}
          />
        )}
        </div>
        {zoom && <ZoomCatch onScrub={scrubZoom} onDrop={dropZoom} onTap={closeZoom} />}
        {askLeave && (
          <div className="shade">
            <div className="dialog" role="dialog" aria-labelledby="leave-title">
              <h2 id="leave-title">Return to character selection?</h2>
              <p>The ultimate resets if you leave.</p>
              <div className="dialog-actions">
                <button type="button" className="ghost" onClick={() => setAskLeave(false)} autoFocus>
                  Stay
                </button>
                <button type="button" className="confirm" onClick={returnToRoster}>
                  Return
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
