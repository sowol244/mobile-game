# Repository instructions

## Save data and stage revisions

- Preserve Lightshade progress, stars, unlocks, fastest times, local run records, and online records. Do not clear saved values when stage content changes.
- Give a stage a positive integer `revision` when its playable layout, shard route, hazards, or puzzle rules change. An omitted revision means 1. Increment only changed stages.
- If saved progress is from an older stage revision, show `개편됨` until that stage is completed again. Preserve best-ever stars and time.
- Keep local ranking rows and label older rows `개편 전`; do not erase them when stage revisions change.
- Progress codes contain cleared stages and shard stars, but not fastest times or local per-run ranking rows. Keep that limitation clear in the save-code UI.
- After each fifth stage clear, offer a dismissible backup-code prompt before the next stage starts.

## General

- Keep game names, folder names, game IDs, icons, online score settings, and shared status configuration in sync.
- Preserve player saves and online records during game renames. Migrate stored identifiers before removing old keys.
- Finished changes should be committed and pushed to `main`.
