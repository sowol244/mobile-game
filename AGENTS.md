# Repository instructions

## Lux & Umbra progress and save rules

- Never clear `lux-progress` or `lux-top` because stage content changed. Preserve stars, unlocks, fastest times, local run records, and online leaderboard records.
- Give stage objects a positive integer `revision` when their playable layout, shard route, hazard placement, or puzzle rules change. Omitted revisions mean revision 1. Increment only the stages that actually changed.
- Keep old progress. Show `개편됨` when a saved stage revision is older than the current stage revision; clear the marker after that stage is completed on the current revision. Preserve the stage's best-ever stars and time.
- Keep local ranking rows and label a row `개편 전` when it belongs to an older revision. Do not erase ranking rows during a stage revision.
- The existing record code carries cleared stages and shard stars, not fastest times or local per-run ranking rows. Keep this limitation clear in any save-code UI. Online progress rankings are stored separately when the player registers a nickname.
- After each 5th stage clear (5, 10, 15, ...), show the player a dismissible backup-code prompt before the next stage can start. Include copy and continue-later actions.
