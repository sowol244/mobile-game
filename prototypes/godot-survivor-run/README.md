# Survivor Run — Godot web prototype

A small Godot 4 / GDScript comparison build. It keeps the existing browser game intact and reuses only four lightweight character images from it.

## Run in Godot

1. Open `project.godot` in Godot 4.3 or newer.
2. Press **F6** or **F5** to run the portrait prototype.
3. Drag left or right with touch or the mouse. On PC, use **← / →** or **A / D**. The player fires automatically; survive for 35 seconds.

## Export for the web

1. Install export templates matching the Godot editor version from **Editor → Manage Export Templates**.
2. Open **Project → Export** and use the included **Web** preset to export a release build to a new folder.
3. Serve that folder over HTTP (for example, run `python -m http.server 8000` from the exported folder) and open `http://localhost:8000` in a browser. A local web server is needed for WebAssembly builds; opening the exported HTML with `file://` is not sufficient.
4. For a mobile comparison, open the hosted URL in a phone browser in portrait orientation and compare loading time, first interaction, character readability, touch response, and frame smoothness against `survivor-run/`.

The project uses Godot's GL Compatibility renderer for WebGL 2 and includes no audio, plugins, or imported content packs. The four source WEBP images total 256.33 KiB. A Godot 4.7.2 release export measured 40,703,680 bytes (38.82 MiB), including a 39,514,754-byte WebAssembly runtime. That build is a temporary local artifact; browser play verification and site deployment are still pending.
