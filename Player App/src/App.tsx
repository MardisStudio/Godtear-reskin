import { useEffect, useRef, useState } from "react";
import { Fan, type FanItem } from "./Fan";
import { wrap } from "./math";
import { CHAMPIONS, SET, faceSrc, type Side } from "./roster";
import { Table, Zoom } from "./Table";
import { Trio } from "./Trio";

type ZoomShot = { src: string; from: DOMRect };

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
  const [askLeave, setAskLeave] = useState(false);
  const [veil, setVeil] = useState<"open" | "close" | null>(null);
  const [spin, setSpin] = useState(0);
  const spinDir = useRef(1);
  const veilTimer = useRef(0);
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

  useEffect(() => () => window.clearTimeout(veilTimer.current), []);

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
          setZoom(null);
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

      if (session.screen === "play" || zoom || askLeave) {
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
    setZoom(null);
    setSession((current) => ({
      ...current,
      screen: "play",
      championSide: "clash",
      followerSide: "clash",
      ultimateUsed: false,
    }));
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
      <div className="app" data-screen={session.screen}>
        {session.screen !== "play" && (
          <div className={`picker${veil ? ` veil-${veil}` : ""}`}>
            {session.screen === "set" && (
              <button type="button" className="close" aria-label="Close" onClick={closeSet}>
                ×
              </button>
            )}
            <div className="nameplate">
              <p className="who" key={champion.id}>{champion.name}</p>
            </div>
            {session.screen === "roster" ? (
              <Fan
                items={rosterItems}
                index={session.rosterIndex}
                onIndex={(rosterIndex) => setSession((current) => ({ ...current, rosterIndex }))}
                onActivate={openSet}
                onRead={(src, from) => setZoom({ src, from })}
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
                onRead={(src, from) => setZoom({ src, from })}
              />
            )}
            <div className={session.screen === "set" ? "dock" : "dock quiet"}>
              {session.screen === "set" && (
                <button type="button" className="confirm" onClick={confirm}>
                  Confirm selection
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
            onZoom={(src, from) => setZoom({ src, from })}
            onLeave={() => setAskLeave(true)}
          />
        )}
        {zoom && <Zoom src={zoom.src} from={zoom.from} onClose={() => setZoom(null)} />}
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
