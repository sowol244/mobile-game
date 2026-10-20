# Repository handoff

## Project

- GitHub Pages site: `https://sowol244.github.io/mobile-game/`
- `index.html` is the game selection page and shared status manager.
- Each game runs from its own static HTML folder without a build step.
- Game titles, folders, IDs, and icons currently use these names:
  - `lumagrid/` — LumaGrid
  - `gravibreak/` — GraviBreak
  - `lightshade/` — Lightshade
  - `arena-duel/` — 아레나 결투
  - `meteor-dodge/` — 스타 슈터
  - `super-jump/` — 교행이의 모험
  - `sudoku/` — 숫자 정원

## Data and deployment

- Shared online scores and game status use the Supabase project configured in `index.html` and `online-scoreboard.js`.
- LumaGrid uses the shared score table. Its existing browser saves and high scores are preserved when the game ID changes.
- Each game keeps browser saves under its current game prefix. Rename migrations copy existing values and remove the previous browser keys.
- GitHub Pages publishes from the `main` branch.
- Preserve player progress and records when updating levels, names, or storage identifiers; see `AGENTS.md`.
