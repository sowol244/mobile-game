extends Resource

# Stage 1-1 timing and encounter data mirrored from survivor-run/game.js.
const BOSS_WARNING_AT := 62.0
const BOSS_START_AT := 64.0
const BOSS_MAX_HP := 350.0
const PLAYER_START_HP := 100.0
const WAVES := [
	{"start": 0.6, "interval": 1.45, "kinds": ["walker", "walker", "walker", "walker", "walker"], "lanes": [1, 0, 1, 2, 0]},
	{"start": 8.35, "interval": 1.32, "kinds": ["walker", "walker", "walker", "walker", "walker", "walker"], "lanes": [0, 2, 0, 2, 1, 1]},
	{"start": 16.25, "interval": 1.18, "kinds": ["walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker"], "lanes": [1, 0, 2, 1, 0, 2, 1, 0, 2]},
	{"start": 28.2, "interval": 0.86, "kinds": ["walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "runner", "runner"], "lanes": [0, 2, 1, 0, 0, 0, 2, 2, 1, 1, 1, 2, 0, 2]},
	{"start": 40.25, "interval": 0.78, "kinds": ["walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker", "walker"], "lanes": [0, 2, 1, 0, 2, 1, 0, 1, 2, 0, 2, 1, 0, 2, 1]},
	{"start": 55.0, "interval": 0.65, "kinds": ["walker", "walker", "walker", "walker", "runner", "walker", "walker", "walker", "walker", "walker"], "lanes": [1, 0, 2, 1, 0, 2, 1, 0, 2, 1]},
]
