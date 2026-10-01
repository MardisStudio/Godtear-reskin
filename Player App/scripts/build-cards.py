"""Resize the master PNGs into public/cards for the phone app."""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "cards"
KINDS = {
    "Champion clash": "champion-clash",
    "Champion plot": "champion-plot",
    "Follower clash": "follower-clash",
    "Follower plot": "follower-plot",
    "Identity + Ultimate": "ultimate",
    "Identity": "identity",
}


def main() -> None:
    jobs: list[tuple[str, str]] = []

    for path in sorted(ROOT.glob("*.png")):
        name, kind = path.name.replace("@2x.png", "").split(" — ")
        slug = name.lower().replace(" ", "-")
        dest = OUT / slug
        dest.mkdir(parents=True, exist_ok=True)
        jobs.append((str(path), str(dest / f"{KINDS[kind]}.webp")))

    running: list[subprocess.Popen[bytes]] = []

    for src, dst in jobs:
        running.append(
            subprocess.Popen(
                [
                    "cwebp",
                    "-q",
                    "84",
                    "-metadata",
                    "none",
                    "-alpha_q",
                    "100",
                    "-resize",
                    "1200",
                    "0",
                    src,
                    "-o",
                    dst,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
        )

        if len(running) >= 6:
            wait(running.pop(0))

    for proc in running:
        wait(proc)

    print(f"wrote {len(jobs)} cards")


def wait(proc: subprocess.Popen[bytes]) -> None:
    err = proc.stderr.read() if proc.stderr else b""
    code = proc.wait()

    if code != 0:
        raise SystemExit(err.decode())


if __name__ == "__main__":
    main()
