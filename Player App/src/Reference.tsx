import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const DISMISS_PX = 72;

const SKILLS: { icon: string; text: string }[] = [
  { icon: "/reference/self.svg", text: "The skill affects the champion or follower unit using the skill." },
  { icon: "/reference/friendly.svg", text: "The skill affects a friendly champion or follower unit." },
  { icon: "/reference/area.svg", text: "The skill affects the models or hexes described in the skill." },
  { icon: "/reference/passive.svg", text: "The skill is passive for the champion or follower." },
  { icon: "/reference/enemy.svg", text: "The skill targets an enemy champion or follower." },
  {
    icon: "/reference/range.svg",
    text: "The maximum number of hexes away a model can be and still be affected by this skill.",
  },
  { icon: "/reference/hit.svg", text: "The number of dice rolled to hit your target." },
  { icon: "/reference/damage.svg", text: "The number of dice rolled to damage your target." },
];

const STATS: { icon: string; name: string; text: string }[] = [
  {
    icon: "/reference/speed.svg",
    name: "Speed:",
    text: "The number of hexes the model may move with an advance action.",
  },
  {
    icon: "/reference/dodge.svg",
    name: "Dodge:",
    text: "The number an enemy needs on its hit roll when it targets this model with a skill.",
  },
  {
    icon: "/reference/protection.svg",
    name: "Protection:",
    text: "The amount of damage that is ignored each time this model suffers damage.",
  },
  {
    icon: "/reference/health.svg",
    name: "Health:",
    text: "The number of wounds a model can have before it is knocked out.",
  },
];

const LADDER: { lead: string; value: string }[] = [
  { lead: "Knock out an enemy champion", value: "4 steps (+1 for Duelists)" },
  { lead: "Knock out a small enemy follower", value: "1 step (+1 for Marauders)" },
  { lead: "Knock out a large enemy follower", value: "2 steps (+1 for Marauders)" },
  { lead: "A claim action during plot phase", value: "1 step (+1 for Tacticians)" },
  {
    lead: "Have a friendly banner on an objective hex on the end phase",
    value: "4 steps (+1 for Sentinels)",
  },
];

export function Reference({
  open,
  lift,
  onClose,
}: {
  open: boolean;
  lift: number;
  onClose: () => void;
}) {
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ id: -1, y: 0 });

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, open]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !open) {
      return;
    }

    event.stopPropagation();
    drag.current = { id: event.pointerId, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current.id !== event.pointerId) {
      return;
    }

    setPull(Math.max(0, event.clientY - drag.current.y));
  }

  function finish(clientY: number) {
    const dy = clientY - drag.current.y;
    drag.current.id = -1;
    setDragging(false);
    setPull(0);

    if (dy > DISMISS_PX) {
      onClose();
    }
  }

  const y = open ? `${pull}px` : `calc(100% - ${lift}px)`;
  const interactive = open || lift > 0;

  return (
    <div
      className={`reference${dragging ? " dragging" : ""}`}
      style={{ transform: `translateY(${y})`, pointerEvents: interactive ? "auto" : "none" }}
      role="dialog"
      aria-label="Quick reference"
      aria-hidden={!open}
      data-open={open ? "true" : "false"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        if (drag.current.id === event.pointerId) {
          finish(event.clientY);
        }
      }}
      onPointerCancel={() => {
        drag.current.id = -1;
        setDragging(false);
        setPull(0);
      }}
    >
      <div className="reference-bg" aria-hidden="true">
        <img className="reference-tex overlay" src="/reference/texture-overlay.png" alt="" draggable={false} />
        <img className="reference-tex dodge" src="/reference/texture-dodge.png" alt="" draggable={false} />
        <div className="reference-multiply" />
        <div className="reference-rings" />
      </div>
      <div className="reference-grid" style={{ pointerEvents: interactive ? "auto" : "none" }}>
        <section className="reference-col">
          <h2>Skills</h2>
          {SKILLS.map((skill) => (
            <div className="ref-row" key={skill.icon}>
              <img className="ref-icon" src={skill.icon} alt="" draggable={false} />
              <p>{skill.text}</p>
            </div>
          ))}
        </section>
        <section className="reference-col">
          <h2>Stat Icons</h2>
          {STATS.map((stat) => (
            <div className="ref-row" key={stat.name}>
              <img className="ref-icon" src={stat.icon} alt="" draggable={false} />
              <div>
                <p className="ref-name">{stat.name}</p>
                <p>{stat.text}</p>
              </div>
            </div>
          ))}
        </section>
        <section className="reference-col">
          <h2>Actions</h2>
          <p className="ref-kicker">Champion or follower unit</p>
          <p>
            <span className="ref-label">Advance:</span> Move the champion or each follower a number of hexes up to its
            speed.
          </p>
          <p>
            <span className="ref-label">Skill:</span> Use a skill from the model's card.
          </p>
          <div className="ref-rule" />
          <p className="ref-kicker">Champion only</p>
          <p>
            <span className="ref-label">Ultimate Skill:</span> Use the champion's ultimate skill.
          </p>
          <p>
            <span className="ref-label">Claim:</span> Place the champion's banner model in an adjacent empty objective
            hex.
          </p>
          <p>
            <span className="ref-label">Rally:</span> Clear a champion's wounds after it is knocked out.
          </p>
          <div className="ref-rule" />
          <p className="ref-kicker">Follower only</p>
          <p>
            <span className="ref-label">Recruit:</span> Return a follower model to the battlefield after it is knocked
            out
          </p>
        </section>
        <section className="reference-col">
          <h2>Battle Ladder Steps</h2>
          {LADDER.map((step) => (
            <p key={step.value}>
              {step.lead}
              <strong className="ref-step">{step.value}</strong>
            </p>
          ))}
        </section>
      </div>
    </div>
  );
}
