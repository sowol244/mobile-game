#!/usr/bin/env python3
"""Style and cache-bust a Godot Web export in a target folder."""

from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path


ASSET_SUFFIXES = (
    ".wasm",
    ".pck",
    ".js",
    ".png",
    ".html",
    ".audio.worklet.js",
    ".audio.position.worklet.js",
)

CSS = """
/* DEAD ROUTE WEB SHELL */
html, body {
  width: 100%;
  height: 100%;
  background: #101512;
}
body {
  display: grid;
  place-items: center;
  background: radial-gradient(ellipse at center, #252d28 0%, #101512 72%);
}
#canvas {
  width: min(100vw, 56.25dvh);
  height: min(100dvh, 177.7778vw);
  max-width: 100vw;
  max-height: 100dvh;
  aspect-ratio: 9 / 16;
  background: #202925;
  box-shadow: 0 18px 70px rgba(0, 0, 0, .58), 0 0 0 1px rgba(218, 194, 145, .2);
}
#status {
  z-index: 2;
  background: radial-gradient(ellipse at center, #28312c 0%, #101512 72%);
}
#status-splash {
  display: none;
}
#status::before {
  content: "DEAD ROUTE";
  color: #f0e7d2;
  font: 700 1.4rem/1.2 system-ui, sans-serif;
  letter-spacing: .22em;
  position: absolute;
  top: calc(50% - 2.2rem);
}
#status::after {
  content: "STAGE 1-1  ·  CLOSED HIGHWAY";
  color: #c4b28d;
  font: 600 .7rem/1.2 system-ui, sans-serif;
  letter-spacing: .16em;
  position: absolute;
  top: calc(50% + .2rem);
}
#status-progress {
  display: block;
  bottom: calc(50% - 3.1rem);
  width: min(62vw, 240px);
  height: 4px;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  accent-color: #c6814b;
}
#status-progress::-webkit-progress-bar { background: #343a34; }
#status-progress::-webkit-progress-value { background: #d19a5c; }
#status-progress::-moz-progress-bar { background: #d19a5c; }
#status-notice {
  max-width: min(32rem, calc(100vw - 3rem));
  font-family: system-ui, sans-serif;
}
"""


def package(directory: Path) -> str:
    index_path = directory / "index.html"
    html = index_path.read_text(encoding="utf-8")
    script_match = re.search(r'<script src="([^"]+\.js)">', html)
    if not script_match:
        raise SystemExit(f"Godot JavaScript bundle was not found in {index_path}")
    old_base = Path(script_match.group(1)).stem
    payloads = sorted(
        path for path in directory.iterdir()
        if path.is_file() and path != index_path and path.name.startswith(old_base + ".")
    )
    if not payloads:
        raise SystemExit(f"No exported files for {old_base!r} were found in {directory}")

    digest = hashlib.sha256()
    for payload in payloads:
        with payload.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
    build_id = digest.hexdigest()[:10]
    new_base = f"dead-route-1-1-{build_id}"

    for payload in payloads:
        new_path = directory / f"{new_base}{payload.name[len(old_base):]}"
        payload.replace(new_path)
    html = html.replace(old_base + ".", new_base + ".")
    html = html.replace(f'"executable":"{old_base}"', f'"executable":"{new_base}"')
    html = re.sub(r"<title>.*?</title>", "<title>DEAD ROUTE 1-1 · CLOSED HIGHWAY</title>", html, count=1)
    html = html.replace(
        '<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0">',
        '<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, viewport-fit=cover">',
    )
    if "DEAD ROUTE WEB SHELL" not in html:
        html = html.replace("</style>", CSS + "\n\t\t</style>", 1)
    html = "\n".join(line.rstrip() for line in html.splitlines()).rstrip() + "\n"
    index_path.write_text(html, encoding="utf-8")

    current_names = {f"{new_base}{path.name[len(old_base):]}" for path in payloads}
    for path in directory.iterdir():
        if path.name == "index.html" or path.name in current_names or not path.is_file():
            continue
        if path.name.startswith(("dead-route-", "index.")) and path.name.endswith(ASSET_SUFFIXES):
            path.unlink()
    return new_base


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export_directory", type=Path, help="Folder containing Godot's index.html and generated bundles")
    args = parser.parse_args()
    print(package(args.export_directory.resolve()))


if __name__ == "__main__":
    main()
