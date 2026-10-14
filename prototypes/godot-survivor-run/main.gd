extends Node2D

const PLAYER_IDLE: Texture2D = preload("res://assets/player-back-a.webp")
const PLAYER_RUN: Texture2D = preload("res://assets/player-back-b.webp")
const WALKER_IDLE: Texture2D = preload("res://assets/zombie-walker.webp")
const WALKER_RUN: Texture2D = preload("res://assets/zombie-walker-run.webp")
const RUNNER_IDLE: Texture2D = preload("res://assets/zombie-runner.webp")
const RUNNER_RUN: Texture2D = preload("res://assets/zombie-runner-run.webp")
const BOSS_IDLE: Texture2D = preload("res://assets/zombie-brute.webp")
const BOSS_ATTACK: Texture2D = preload("res://assets/zombie-brute-attack.webp")
const SUPPORT_IDLE: Texture2D = preload("res://assets/support-survivor.webp")
const SUPPORT_RUN: Texture2D = preload("res://assets/support-survivor-run.webp")
const BACKDROP: Texture2D = preload("res://assets/roadside-backdrop.webp")
const RAPID_ICON: Texture2D = preload("res://assets/reward-rapidfire.svg")
const SUPPORT_ICON: Texture2D = preload("res://assets/reward-support.svg")
const UPGRADE_ICON: Texture2D = preload("res://assets/reward-upgrade.svg")
const ROCKET_ICON: Texture2D = preload("res://assets/reward-rocket.svg")
const EXPLOSIVE_ICON: Texture2D = preload("res://assets/reward-explosive.svg")
const HEAL_ICON: Texture2D = preload("res://assets/reward-heal.svg")
const DRONE_ICON: Texture2D = preload("res://assets/reward-drone.svg")
const WEAPON_ICON: Texture2D = preload("res://assets/reward-weapon.svg")
const ROCKET_TEXTURE: Texture2D = preload("res://assets/rocket-projectile.svg")

const STAGE1_CONFIG = preload("res://stage1_config.gd")
const BOSS_WARNING_AT: float = STAGE1_CONFIG.BOSS_WARNING_AT
const BOSS_START_AT: float = STAGE1_CONFIG.BOSS_START_AT
const WAVES: Array = STAGE1_CONFIG.WAVES
const PLAYER_FIRE_INTERVAL := 0.25
const PLAYER_MOVE_SPEED := 300.0
const PLAYER_BASE_Y_RATIO := 0.84
const DEFENSE_LINE_Y_RATIO := 0.95
const MAX_PASS_DAMAGE_PER_SECOND := 14.0
const DIRECT_HIT_INVULNERABILITY := 0.85

enum RunState { TITLE, PLAYING, CLEARED, GAME_OVER }

var _screen_size := Vector2(360.0, 640.0)
var _player_visual: AnimatedSprite2D
var _camera_offset := Vector2.ZERO
var _state: RunState = RunState.TITLE
var _elapsed := 0.0
var _hp := STAGE1_CONFIG.PLAYER_START_HP
var _kills := 0
var _score := 0
var _barrels_broken := 0
var _player_x := 180.0
var _player_target_x := 180.0
var _player_y := 538.0
var _player_anim_time := 0.0
var _fire_timer := 0.12
var _world_scroll := 0.0
var _dragging := false
var _drag_origin_x := 0.0
var _drag_origin_player_x := 0.0
var _invulnerable := 0.0
var _pass_damage_window := -1
var _pass_damage_taken := 0.0
var _damage_multiplier := 1.0
var _permanent_rapid_fire := false
var _rapid_fire_time := 0.0
var _companion_time := 0.0
var _companion_fire_timer := 0.0
var _rocket_ammo := 0
var _rocket_timer := 0.0
var _wave_index := 0
var _wave_spawned := 0
var _rapidfire_spawned := false
var _choice_spawned := false
var _first_explosive_spawned := false
var _rocket_barrel_spawned := false
var _second_explosive_spawned := false
var _obstacle_spawned := false
var _boss: Dictionary = {}
var _boss_warning_shown := false
var _boss_alert_time := 0.0
var _message := ""
var _message_time := 0.0
var _shake := 0.0
var _muzzle_flash := 0.0
var _player_recoil := 0.0
var _zombies: Array = []
var _barrels: Array = []
var _obstacles: Array = []
var _bullets: Array = []
var _missiles: Array = []
var _particles: Array = []
var _effects: Array = []


func _ready() -> void:
	randomize()
	get_viewport().size_changed.connect(_on_viewport_resized)
	_setup_player_animation()
	_on_viewport_resized()
	set_process(true)


func _on_viewport_resized() -> void:
	var old_width := _screen_size.x
	_screen_size = get_viewport_rect().size
	if _screen_size.x <= 0.0 or _screen_size.y <= 0.0:
		_screen_size = Vector2(360.0, 640.0)
	if old_width > 0.0:
		var ratio := _screen_size.x / old_width
		_player_x *= ratio
		_player_target_x *= ratio
	_player_y = _screen_size.y * PLAYER_BASE_Y_RATIO
	_clamp_player()
	queue_redraw()


func _process(delta: float) -> void:
	delta = minf(delta, 0.04)
	_world_scroll += delta * 120.0
	if _message_time > 0.0:
		_message_time = maxf(0.0, _message_time - delta)
	if _shake > 0.0:
		_shake = maxf(0.0, _shake - delta)
	if _state == RunState.PLAYING:
		_update_run(delta)
	_camera_offset = Vector2(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * _shake * 15.0 if _shake > 0.0 else Vector2.ZERO
	_sync_player_animation()
	queue_redraw()


func _update_run(delta: float) -> void:
	_elapsed += delta
	_player_anim_time += delta
	_invulnerable = maxf(0.0, _invulnerable - delta)
	_rapid_fire_time = maxf(0.0, _rapid_fire_time - delta)
	_muzzle_flash = maxf(0.0, _muzzle_flash - delta)
	_player_recoil = maxf(0.0, _player_recoil - delta)
	if Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A):
		_player_target_x -= PLAYER_MOVE_SPEED * delta
	if Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D):
		_player_target_x += PLAYER_MOVE_SPEED * delta
	_clamp_player_target()
	_player_x = lerpf(_player_x, _player_target_x, 1.0 - exp(-13.0 * delta))

	_spawn_waves()
	_spawn_scripted_objects()
	_update_boss(delta)
	_update_zombies(delta)
	_update_barrels(delta)
	_update_obstacles(delta)
	_update_support(delta)
	_update_bullets(delta)
	_update_missiles(delta)
	_update_particles(delta)
	_update_effects(delta)
	if _hp <= 0.0:
		_state = RunState.GAME_OVER
		_dragging = false
		_show_message("RUN OVER", 2.0)


func _spawn_waves() -> void:
	while _wave_index < WAVES.size():
		var wave: Dictionary = WAVES[_wave_index]
		var kinds: Array = wave["kinds"]
		if _wave_spawned >= kinds.size():
			_wave_index += 1
			_wave_spawned = 0
			continue
		var spawn_at := float(wave["start"]) + _wave_spawned * float(wave["interval"])
		if _elapsed < spawn_at:
			break
		_spawn_zombie(str(kinds[_wave_spawned]), int(wave["lanes"][_wave_spawned]))
		_wave_spawned += 1


func _spawn_zombie(kind: String, lane: int) -> void:
	if _living_zombie_count() >= 40:
		return
	var y := _screen_size.y * randf_range(0.15, 0.185)
	var hp := 15.0 if kind == "runner" else 20.0
	_zombies.append({
		"kind": kind, "lane": lane, "x": _lane_x(y, lane), "y": y,
		"hp": hp, "max_hp": hp, "speed": _screen_size.y * (0.42 if kind == "runner" else 0.26) * (1.0 + minf(0.2, _elapsed / 500.0)),
		"phase": randf() * TAU, "dead": false, "dying": 0.0, "flash": 0.0,
		"recoil_x": 0.0, "recoil_y": 0.0, "applied_damage": false,
	})


func _living_zombie_count() -> int:
	var count := 0
	for zombie in _zombies:
		if not zombie["dead"]:
			count += 1
	return count


func _spawn_barrel(lane: int, kind: String, hp: float, permanent: bool = false, offer: int = -1) -> void:
	var y := _screen_size.y * (0.17 if kind == "explosive" else 0.18)
	_barrels.append({
		"lane": lane, "kind": kind, "x": _lane_x(y, lane), "y": y,
		"hp": hp, "max_hp": hp, "permanent": permanent, "offer": offer,
		"dead": false, "flash": 0.0, "shake": 0.0,
	})


func _spawn_scripted_objects() -> void:
	if _elapsed >= 8.0 and not _rapidfire_spawned:
		_rapidfire_spawned = true
		_spawn_barrel(1, "rapidfire", 35.0, true)
	if _elapsed >= 16.0 and not _choice_spawned:
		_choice_spawned = true
		_spawn_barrel(0, "companion", 40.0, false, 1)
		_spawn_barrel(2, "upgrade", 45.0, false, 1)
	if _elapsed >= 41.5 and not _first_explosive_spawned:
		_first_explosive_spawned = true
		_spawn_barrel(0, "explosive", 30.0)
	if _elapsed >= 42.5 and not _rocket_barrel_spawned:
		_rocket_barrel_spawned = true
		_spawn_barrel(1, "rocket", 100.0)
	if _elapsed >= 45.0 and not _second_explosive_spawned:
		_second_explosive_spawned = true
		_spawn_barrel(2, "explosive", 30.0)
	if _elapsed >= 52.0 and not _obstacle_spawned:
		_obstacle_spawned = true
		_obstacles.append({"lane": 1, "x": _lane_x(_screen_size.y * 0.20, 1), "y": _screen_size.y * 0.20, "passed": false, "dead": false})


func _update_zombies(delta: float) -> void:
	for index in range(_zombies.size() - 1, -1, -1):
		var zombie: Dictionary = _zombies[index]
		if zombie["dead"]:
			zombie["dying"] = float(zombie["dying"]) - delta
			if float(zombie["dying"]) <= 0.0:
				_zombies.remove_at(index)
			continue
		zombie["flash"] = maxf(0.0, float(zombie["flash"]) - delta)
		zombie["recoil_x"] = float(zombie["recoil_x"]) * exp(-delta * 8.0)
		zombie["recoil_y"] = float(zombie["recoil_y"]) * exp(-delta * 8.0)
		zombie["y"] = float(zombie["y"]) + (float(zombie["speed"]) - float(zombie["recoil_y"])) * delta
		zombie["x"] = _lane_x(float(zombie["y"]), int(zombie["lane"])) + sin(_elapsed * 2.1 + float(zombie["phase"])) * 3.0 + float(zombie["recoil_x"])
		var contact_distance := 13.0 if zombie["kind"] == "runner" else 16.0
		if float(zombie["y"]) >= _player_y - 24.0 and absf(float(zombie["x"]) - _player_x) < contact_distance + 20.0:
			_resolve_zombie_contact(zombie, float(10.0 if zombie["kind"] == "runner" else 9.0), "contact")
		elif float(zombie["y"]) >= _screen_size.y * DEFENSE_LINE_Y_RATIO:
			var window := int(floor(_elapsed))
			if window != _pass_damage_window:
				_pass_damage_window = window
				_pass_damage_taken = 0.0
			var requested := minf(float(3.0 if zombie["kind"] == "runner" else 2.0), MAX_PASS_DAMAGE_PER_SECOND - _pass_damage_taken)
			if requested > 0.0:
				_apply_player_damage(requested, "breach")
				_pass_damage_taken += requested
			_spawn_effect("breach", Vector2(float(zombie["x"]), _screen_size.y * DEFENSE_LINE_Y_RATIO), 0.38, Color("#edb35f"))
			zombie["dead"] = true
			zombie["dying"] = 0.08


func _resolve_zombie_contact(zombie: Dictionary, damage: float, source: String) -> void:
	if bool(zombie["dead"]) or bool(zombie["applied_damage"]):
		return
	zombie["applied_damage"] = true
	zombie["dead"] = true
	zombie["dying"] = 0.35
	if _invulnerable <= 0.0:
		_apply_player_damage(damage, source)
	_spawn_particles(Vector2(float(zombie["x"]), float(zombie["y"]) - 24.0), Color("#bf5548"), 8, 120.0)


func _update_barrels(delta: float) -> void:
	for barrel in _barrels:
		if barrel["dead"]:
			continue
		barrel["y"] = float(barrel["y"]) + _screen_size.y * 0.19 * delta
		barrel["x"] = _lane_x(float(barrel["y"]), int(barrel["lane"]))
		barrel["flash"] = maxf(0.0, float(barrel["flash"]) - delta)
		barrel["shake"] = maxf(0.0, float(barrel["shake"]) - delta)
		if float(barrel["y"]) >= _player_y - 28.0:
			barrel["dead"] = true


func _update_obstacles(delta: float) -> void:
	for obstacle in _obstacles:
		if obstacle["dead"]:
			continue
		obstacle["y"] = float(obstacle["y"]) + _screen_size.y * 0.18 * delta
		obstacle["x"] = _lane_x(float(obstacle["y"]), int(obstacle["lane"]))
		if not obstacle["passed"] and float(obstacle["y"]) >= _player_y - 48.0:
			obstacle["passed"] = true
			if _closest_lane(_player_x) == int(obstacle["lane"]):
				_apply_player_damage(16.0, "obstacle")
		if float(obstacle["y"]) > _screen_size.y + 60.0:
			obstacle["dead"] = true


func _update_boss(delta: float) -> void:
	if _elapsed >= BOSS_WARNING_AT and not _boss_warning_shown:
		_boss_warning_shown = true
		_boss_alert_time = 2.2
		_show_message("BOSS INCOMING · MOVE OUT OF THE RED LANE", 2.2)
	if _boss_alert_time > 0.0:
		_boss_alert_time = maxf(0.0, _boss_alert_time - delta)
	if _elapsed >= BOSS_START_AT and _boss.is_empty():
		_boss = {
			"x": _screen_size.x * 0.5, "y": _screen_size.y * 0.44,
			"hp": STAGE1_CONFIG.BOSS_MAX_HP, "max_hp": STAGE1_CONFIG.BOSS_MAX_HP, "phase": 0.0, "attack_timer": 1.65,
			"warning": 0.0, "warning_total": 1.25, "attack_lane": 1,
			"flash": 0.0, "add_timer": 4.2, "death_timer": -1.0,
		}
		_show_message("THE HIGHWAY BRUTE", 2.2)
	if _boss.is_empty():
		return
	if float(_boss["death_timer"]) >= 0.0:
		_boss["death_timer"] = float(_boss["death_timer"]) - delta
		if float(_boss["death_timer"]) <= 0.0:
			_state = RunState.CLEARED
			_show_message("STAGE 1 CLEARED", 3.0)
		return
	_boss["phase"] = float(_boss["phase"]) + delta
	_boss["y"] = _screen_size.y * 0.44 + sin(float(_boss["phase"]) * 1.45) * _screen_size.y * 0.014
	var idle_x := _screen_size.x * 0.5 + sin(float(_boss["phase"]) * 0.74) * _road_half_width(float(_boss["y"])) * 0.92
	idle_x += sin(float(_boss["phase"]) * 1.19) * _road_half_width(float(_boss["y"])) * 0.14
	_boss["x"] = idle_x
	_boss["flash"] = maxf(0.0, float(_boss["flash"]) - delta)
	_boss["add_timer"] = float(_boss["add_timer"]) - delta
	if float(_boss["add_timer"]) <= 0.0:
		_spawn_zombie("walker", 0)
		_spawn_zombie("walker", 2)
		_boss["add_timer"] = 5.2
	if float(_boss["warning"]) > 0.0:
		_boss["warning"] = float(_boss["warning"]) - delta
		var windup := 1.0 - clampf(float(_boss["warning"]) / float(_boss["warning_total"]), 0.0, 1.0)
		var target_x := _lane_x(float(_boss["y"]), int(_boss["attack_lane"]))
		var lunge := clampf((windup - 0.68) / 0.32, 0.0, 1.0)
		_boss["x"] = clampf(lerpf(float(_boss["x"]), target_x, 0.12 + lunge * 0.48), _screen_size.x * 0.14, _screen_size.x * 0.86)
		if float(_boss["warning"]) <= 0.0:
			var slam_y := _screen_size.y * 0.75
			var slam_x := _lane_x(slam_y, int(_boss["attack_lane"]))
			_spawn_effect("slam", Vector2(slam_x, slam_y), 0.62, Color("#df5146"))
			_shake = maxf(_shake, 0.23)
			if _closest_lane(_player_x) == int(_boss["attack_lane"]):
				_apply_player_damage(16.0, "boss")
			_boss["attack_timer"] = 3.05
	else:
		_boss["attack_timer"] = float(_boss["attack_timer"]) - delta
		if float(_boss["attack_timer"]) <= 0.0:
			_boss["attack_lane"] = _closest_lane(_player_x)
			_boss["warning"] = 1.25
			_boss["warning_total"] = 1.25


func _update_support(delta: float) -> void:
	if _state != RunState.PLAYING:
		return
	_fire_timer -= delta
	if _fire_timer <= 0.0:
		_fire_player()
		_fire_timer = PLAYER_FIRE_INTERVAL * (0.77 if _permanent_rapid_fire or _rapid_fire_time > 0.0 else 1.0)
	if _companion_time > 0.0:
		_companion_time = maxf(0.0, _companion_time - delta)
		_companion_fire_timer -= delta
		if _companion_fire_timer <= 0.0:
			var companion_x := clampf(_player_x + (64.0 if _player_x < _screen_size.x * 0.5 else -64.0), _screen_size.x * 0.12, _screen_size.x * 0.88)
			_fire_from(Vector2(companion_x, _player_y - 28.0), 6.0, "companion", false)
			_companion_fire_timer = 0.26
	if _rocket_ammo > 0:
		_rocket_timer -= delta
		if _rocket_timer <= 0.0:
			_fire_rocket()
			_rocket_ammo -= 1
			_rocket_timer = 0.8


func _fire_player() -> void:
	var muzzle := Vector2(_player_x, _player_y - 94.0 + _player_recoil * 50.0)
	_muzzle_flash = 0.075
	_player_recoil = 0.11
	_fire_from(muzzle, 10.0 * _damage_multiplier, "player", true)
	_spawn_particles(muzzle + Vector2(0.0, -4.0), Color("#ffe5a1"), 3, 58.0)


func _fire_from(origin: Vector2, damage: float, owner: String, include_barrels: bool) -> void:
	var target := _find_aim_target(origin, include_barrels)
	var direction := Vector2.UP
	if not target.is_empty():
		direction = (Vector2(float(target["x"]), float(target["y"])) - origin).normalized()
	_bullets.append({"x": origin.x, "y": origin.y, "vx": direction.x * 760.0, "vy": direction.y * 760.0, "damage": damage, "life": 1.25, "owner": owner})


func _find_aim_target(origin: Vector2, include_barrels: bool) -> Dictionary:
	var targets: Array = []
	for zombie in _zombies:
		if not zombie["dead"]:
			targets.append({"x": zombie["x"], "y": float(zombie["y"]) - 26.0, "kind": "zombie", "ref": zombie})
	if include_barrels:
		for barrel in _barrels:
			if not barrel["dead"]:
				targets.append({"x": barrel["x"], "y": barrel["y"], "kind": "barrel", "ref": barrel})
	if not _boss.is_empty() and float(_boss["hp"]) > 0.0 and float(_boss["death_timer"]) < 0.0:
		targets.append({"x": _boss["x"], "y": float(_boss["y"]) + 8.0, "kind": "boss", "ref": _boss})
	var best: Dictionary = {}
	var best_distance := INF
	for candidate in targets:
		var dx := float(candidate["x"]) - origin.x
		var dy := origin.y - float(candidate["y"])
		if dy < 12.0 or absf(dx) > _road_half_width(_player_y) * 1.15:
			continue
		var angle := absf(atan2(dx, dy))
		if angle > deg_to_rad(8.0):
			continue
		var distance := Vector2(dx, dy).length()
		if distance < best_distance:
			best = candidate
			best_distance = distance
	return best


func _update_bullets(delta: float) -> void:
	for index in range(_bullets.size() - 1, -1, -1):
		var bullet: Dictionary = _bullets[index]
		bullet["x"] = float(bullet["x"]) + float(bullet["vx"]) * delta
		bullet["y"] = float(bullet["y"]) + float(bullet["vy"]) * delta
		bullet["life"] = float(bullet["life"]) - delta
		if float(bullet["life"]) <= 0.0 or float(bullet["y"]) < -80.0:
			_bullets.remove_at(index)
			continue
		var owner := str(bullet["owner"])
		var hit := false
		if owner == "player":
			for barrel in _barrels:
				if barrel["dead"]:
					continue
				if Vector2(float(bullet["x"]) - float(barrel["x"]), float(bullet["y"]) - float(barrel["y"])).length() <= 28.0:
					_damage_barrel(barrel, float(bullet["damage"]))
					hit = true
					break
		if not hit:
			for zombie in _zombies:
				if zombie["dead"]:
					continue
				if Vector2(float(bullet["x"]) - float(zombie["x"]), float(bullet["y"]) - float(zombie["y"]) + 24.0).length() <= (24.0 if zombie["kind"] == "runner" else 29.0):
					_damage_zombie(zombie, float(bullet["damage"]), float(bullet["x"]))
					hit = true
					break
		if not hit and not _boss.is_empty() and float(_boss["hp"]) > 0.0 and float(_boss["death_timer"]) < 0.0:
			if Vector2(float(bullet["x"]) - float(_boss["x"]), float(bullet["y"]) - float(_boss["y"])).length() < 75.0:
				_damage_boss(float(bullet["damage"]))
				hit = true
		if hit:
			_bullets.remove_at(index)


func _damage_zombie(zombie: Dictionary, damage: float, source_x: float) -> void:
	zombie["hp"] = float(zombie["hp"]) - damage
	zombie["flash"] = 0.16
	zombie["recoil_x"] = signf(float(zombie["x"]) - source_x) * 20.0
	zombie["recoil_y"] = 110.0
	_spawn_particles(Vector2(float(zombie["x"]), float(zombie["y"]) - 28.0), Color("#ef9c72"), 4, 92.0)
	if float(zombie["hp"]) <= 0.0:
		zombie["dead"] = true
		zombie["dying"] = 0.48
		_kills += 1
		_score += 15 if zombie["kind"] == "runner" else 10
		_spawn_particles(Vector2(float(zombie["x"]), float(zombie["y"]) - 30.0), Color("#c84e43"), 12, 150.0)


func _damage_barrel(barrel: Dictionary, damage: float) -> void:
	barrel["hp"] = float(barrel["hp"]) - damage
	barrel["flash"] = 0.14
	barrel["shake"] = 0.12
	_spawn_particles(Vector2(float(barrel["x"]), float(barrel["y"])), Color("#f3bd68"), 4, 85.0)
	if float(barrel["hp"]) > 0.0:
		return
	barrel["dead"] = true
	_barrels_broken += 1
	_score += 35
	var kind := str(barrel["kind"])
	if kind == "explosive":
		_score -= 15
		_shake = maxf(_shake, 0.20)
		_spawn_effect("explosion", Vector2(float(barrel["x"]), float(barrel["y"])), 0.55, Color("#ed8747"))
		_spawn_particles(Vector2(float(barrel["x"]), float(barrel["y"])), Color("#ed8747"), 28, 180.0)
		_explosion_damage(Vector2(float(barrel["x"]), float(barrel["y"])), _screen_size.x * 0.24)
	else:
		_spawn_particles(Vector2(float(barrel["x"]), float(barrel["y"])), Color("#9f9272"), 11, 100.0)
		_apply_reward(kind, bool(barrel["permanent"]))
	var offer := int(barrel["offer"])
	if offer >= 0:
		for other in _barrels:
			if int(other["offer"]) == offer and other != barrel:
				other["dead"] = true


func _apply_reward(kind: String, permanent: bool) -> void:
	match kind:
		"rapidfire":
			if permanent:
				_permanent_rapid_fire = true
				_show_message("PERMANENT · FIRE RATE +30%", 2.0)
			else:
				_rapid_fire_time = minf(12.0, _rapid_fire_time + (4.0 if _rapid_fire_time > 0.0 else 8.0))
				_show_message("RAPID FIRE · %d SEC" % int(_rapid_fire_time), 2.0)
		"companion":
			_companion_time = minf(20.0, _companion_time + (10.0 if _companion_time > 0.0 else 10.0))
			_companion_fire_timer = 0.12
			_show_message("SUPPORT SURVIVOR JOINED", 2.0)
		"upgrade":
			_damage_multiplier = minf(2.0, _damage_multiplier + 0.25)
			_show_message("DAMAGE +25%", 2.0)
		"rocket":
			_rocket_ammo = mini(6, _rocket_ammo + 3)
			_show_message("ROCKET BARRAGE · 3 LAUNCHES", 2.0)
		"heal":
			_hp = minf(100.0, _hp + 25.0)
			_show_message("FIELD MEDKIT · HP RESTORED", 2.0)
		"drone":
			_show_message("COMBAT DRONE ONLINE", 2.0)
		"weapon":
			_damage_multiplier = minf(2.0, _damage_multiplier + 0.35)
			_show_message("WEAPON UPGRADED", 2.0)


func _explosion_damage(center: Vector2, radius: float) -> void:
	for zombie in _zombies:
		if not zombie["dead"] and Vector2(float(zombie["x"]), float(zombie["y"]) - 24.0).distance_to(center) <= radius:
			_damage_zombie(zombie, 65.0, center.x)
	if not _boss.is_empty() and float(_boss["hp"]) > 0.0 and Vector2(float(_boss["x"]), float(_boss["y"])).distance_to(center) < radius * 0.85:
		_damage_boss(65.0)
	for other in _barrels:
		if other["dead"] or other["kind"] != "explosive":
			continue
		if Vector2(float(other["x"]), float(other["y"])).distance_to(center) <= radius:
			other["dead"] = true
			_barrels_broken += 1
			_score += 20
			_spawn_effect("explosion", Vector2(float(other["x"]), float(other["y"])), 0.5, Color("#ed8747"))


func _damage_boss(damage: float) -> void:
	if _boss.is_empty() or float(_boss["death_timer"]) >= 0.0:
		return
	_boss["hp"] = maxf(0.0, float(_boss["hp"]) - damage)
	_boss["flash"] = 0.14
	_spawn_particles(Vector2(float(_boss["x"]) + randf_range(-28.0, 28.0), float(_boss["y"]) + randf_range(-18.0, 26.0)), Color("#d9c49a"), 7, 115.0)
	if float(_boss["hp"]) <= 0.0:
		_boss["death_timer"] = 1.15
		_boss["warning"] = 0.0
		_score += 500
		_shake = 0.35
		_spawn_effect("explosion", Vector2(float(_boss["x"]), float(_boss["y"]) + 35.0), 0.9, Color("#e7a25d"))
		_spawn_particles(Vector2(float(_boss["x"]), float(_boss["y"]) + 35.0), Color("#e7a25d"), 42, 210.0)
		for zombie in _zombies:
			if not zombie["dead"]:
				zombie["dead"] = true
				zombie["dying"] = 0.32
		for barrel in _barrels:
			barrel["dead"] = true
		for obstacle in _obstacles:
			obstacle["dead"] = true
		_bullets.clear()
		_missiles.clear()
		_rocket_ammo = 0
		_show_message("HIGHWAY BRUTE DOWN", 1.5)


func _fire_rocket() -> void:
	var alive: Array = []
	for zombie in _zombies:
		if not zombie["dead"]:
			alive.append(zombie)
	var target := Vector2(_lane_x(_screen_size.y * 0.42, 1), _screen_size.y * 0.42)
	if not alive.is_empty():
		var center := Vector2.ZERO
		for zombie in alive:
			center += Vector2(float(zombie["x"]), float(zombie["y"]))
		target = center / alive.size()
	elif not _boss.is_empty() and float(_boss["hp"]) > 0.0:
		target = Vector2(float(_boss["x"]), float(_boss["y"]) + 25.0)
	var start_x := clampf(target.x + randf_range(-22.0, 22.0), 18.0, _screen_size.x - 18.0)
	_missiles.append({"x": start_x, "y": -46.0, "start_x": start_x, "target": target, "elapsed": 0.0, "travel": 0.52, "radius": maxf(48.0, _road_half_width(target.y) * 0.45)})
	_spawn_effect("rocket_target", target, 0.52, Color("#e94f43"))


func _update_missiles(delta: float) -> void:
	for index in range(_missiles.size() - 1, -1, -1):
		var missile: Dictionary = _missiles[index]
		missile["elapsed"] = float(missile["elapsed"]) + delta
		var progress := clampf(float(missile["elapsed"]) / float(missile["travel"]), 0.0, 1.0)
		var target: Vector2 = missile["target"]
		missile["x"] = lerpf(float(missile["start_x"]), target.x, progress)
		missile["y"] = lerpf(-46.0, target.y, progress)
		if progress >= 1.0:
			_spawn_effect("explosion", target, 0.72, Color("#ff9b51"))
			_spawn_particles(target, Color("#f39b4f"), 34, 210.0)
			for zombie in _zombies:
				if not zombie["dead"] and Vector2(float(zombie["x"]), float(zombie["y"])).distance_to(target) <= float(missile["radius"]):
					_damage_zombie(zombie, 80.0, target.x)
			if not _boss.is_empty() and float(_boss["hp"]) > 0.0 and Vector2(float(_boss["x"]), float(_boss["y"])).distance_to(target) <= float(missile["radius"]) + 44.0:
				_damage_boss(80.0)
			_missiles.remove_at(index)


func _apply_player_damage(amount: float, source: String) -> void:
	if _state != RunState.PLAYING:
		return
	if source != "breach" and _invulnerable > 0.0:
		return
	_hp = maxf(0.0, _hp - amount)
	if source != "breach":
		_invulnerable = DIRECT_HIT_INVULNERABILITY
	_shake = maxf(_shake, 0.16)
	_spawn_particles(Vector2(_player_x, _player_y - 58.0), Color("#ff554b"), 16, 190.0)
	_effects.append({"kind": "damage_text", "position": Vector2(_player_x, _player_y - 64.0), "life": 0.82, "total": 0.82, "color": Color("#ff7767"), "text": "-%d HP" % int(amount)})


func _spawn_particles(position: Vector2, color: Color, count: int, speed: float) -> void:
	for _index in range(count):
		var direction := Vector2.from_angle(randf_range(0.0, TAU))
		_particles.append({"position": position, "velocity": direction * randf_range(speed * 0.25, speed), "life": randf_range(0.18, 0.48), "total": 0.48, "radius": randf_range(1.4, 3.8), "color": color, "kind": "spark"})
	if _particles.size() > 220:
		_particles = _particles.slice(_particles.size() - 220)


func _spawn_effect(kind: String, position: Vector2, duration: float, color: Color) -> void:
	_effects.append({"kind": kind, "position": position, "life": duration, "total": duration, "color": color})


func _update_particles(delta: float) -> void:
	for index in range(_particles.size() - 1, -1, -1):
		var particle: Dictionary = _particles[index]
		particle["position"] = Vector2(particle["position"]) + Vector2(particle["velocity"]) * delta
		particle["velocity"] = Vector2(particle["velocity"]) * (1.0 - delta * 1.8) + Vector2(0.0, 90.0 * delta)
		particle["life"] = float(particle["life"]) - delta
		if float(particle["life"]) <= 0.0:
			_particles.remove_at(index)


func _update_effects(delta: float) -> void:
	for index in range(_effects.size() - 1, -1, -1):
		var effect: Dictionary = _effects[index]
		effect["life"] = float(effect["life"]) - delta
		if float(effect["life"]) <= 0.0:
			_effects.remove_at(index)


func _show_message(text: String, duration: float) -> void:
	_message = text
	_message_time = duration


func _lane_x(y: float, lane: int) -> float:
	return _screen_size.x * 0.5 + float(lane - 1) * _road_half_width(y) * 0.58


func _closest_lane(x: float) -> int:
	var nearest := 0
	var best := INF
	for lane in range(3):
		var distance := absf(_lane_x(_player_y, lane) - x)
		if distance < best:
			best = distance
			nearest = lane
	return nearest


func _road_half_width(y: float) -> float:
	var depth := clampf((y - _screen_size.y * 0.13) / (_screen_size.y * 0.84), 0.0, 1.0)
	return _screen_size.x * (0.23 + depth * 0.21)


func _clamp_player_target() -> void:
	var reach := _road_half_width(_player_y) * 0.88
	_player_target_x = clampf(_player_target_x, _screen_size.x * 0.5 - reach, _screen_size.x * 0.5 + reach)


func _clamp_player() -> void:
	_clamp_player_target()
	var reach := _road_half_width(_player_y) * 0.88
	_player_x = clampf(_player_x, _screen_size.x * 0.5 - reach, _screen_size.x * 0.5 + reach)


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			_handle_press(event.position)
		else:
			_dragging = false
	elif event is InputEventScreenDrag and _dragging:
		_update_drag(event.position.x)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_handle_press(event.position)
		else:
			_dragging = false
	elif event is InputEventMouseMotion and _dragging:
		_update_drag(event.position.x)
	elif event is InputEventKey and event.pressed and not event.echo:
		if _state != RunState.PLAYING and (event.keycode == KEY_ENTER or event.keycode == KEY_SPACE):
			_start_run()


func _handle_press(position: Vector2) -> void:
	if _state != RunState.PLAYING:
		if _start_button_rect().has_point(position):
			_start_run()
		return
	_dragging = true
	_drag_origin_x = position.x
	_drag_origin_player_x = _player_x


func _update_drag(screen_x: float) -> void:
	_player_target_x = _drag_origin_player_x + screen_x - _drag_origin_x
	_clamp_player_target()


func _start_run() -> void:
	_state = RunState.PLAYING
	_elapsed = 0.0
	_hp = STAGE1_CONFIG.PLAYER_START_HP
	_kills = 0
	_score = 0
	_barrels_broken = 0
	_player_x = _screen_size.x * 0.5
	_player_target_x = _player_x
	_player_y = _screen_size.y * PLAYER_BASE_Y_RATIO
	_fire_timer = 0.12
	_invulnerable = 0.0
	_pass_damage_window = -1
	_pass_damage_taken = 0.0
	_damage_multiplier = 1.0
	_permanent_rapid_fire = false
	_rapid_fire_time = 0.0
	_companion_time = 0.0
	_companion_fire_timer = 0.0
	_rocket_ammo = 0
	_rocket_timer = 0.0
	_wave_index = 0
	_wave_spawned = 0
	_rapidfire_spawned = false
	_choice_spawned = false
	_first_explosive_spawned = false
	_rocket_barrel_spawned = false
	_second_explosive_spawned = false
	_obstacle_spawned = false
	_boss.clear()
	_boss_warning_shown = false
	_boss_alert_time = 0.0
	_message = ""
	_message_time = 0.0
	_zombies.clear()
	_barrels.clear()
	_obstacles.clear()
	_bullets.clear()
	_missiles.clear()
	_particles.clear()
	_effects.clear()
	_dragging = false


func _start_button_rect() -> Rect2:
	return Rect2(_screen_size.x * 0.5 - 112.0, _screen_size.y * 0.62, 224.0, 58.0)


func _draw() -> void:
	draw_set_transform(_camera_offset, 0.0, Vector2.ONE)
	_draw_background()
	_draw_entities()
	_draw_boss()
	_draw_missiles()
	_draw_bullets()
	_draw_support()
	_draw_player()
	_draw_particles()
	_draw_effects()
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if _state == RunState.PLAYING:
		_draw_hud()
		if _message_time > 0.0:
			_draw_message()
	else:
		_draw_menu()


func _draw_background() -> void:
	draw_rect(Rect2(Vector2.ZERO, _screen_size), Color("#303c39"))
	draw_texture_rect(BACKDROP, Rect2(0.0, 0.0, _screen_size.x, _screen_size.y), false, Color(0.78, 0.84, 0.78, 0.72))
	var horizon := _screen_size.y * 0.13
	draw_rect(Rect2(0.0, 0.0, _screen_size.x, horizon + 4.0), Color(0.14, 0.20, 0.19, 0.56))
	var top_half := _road_half_width(horizon)
	var bottom_half := _road_half_width(_screen_size.y)
	var shoulder := PackedVector2Array([
		Vector2(_screen_size.x * 0.5 - top_half - 11.0, horizon), Vector2(_screen_size.x * 0.5 + top_half + 11.0, horizon),
		Vector2(_screen_size.x * 0.5 + bottom_half + 20.0, _screen_size.y), Vector2(_screen_size.x * 0.5 - bottom_half - 20.0, _screen_size.y),
	])
	draw_colored_polygon(shoulder, Color("#887d63"))
	var road := PackedVector2Array([
		Vector2(_screen_size.x * 0.5 - top_half, horizon), Vector2(_screen_size.x * 0.5 + top_half, horizon),
		Vector2(_screen_size.x * 0.5 + bottom_half, _screen_size.y), Vector2(_screen_size.x * 0.5 - bottom_half, _screen_size.y),
	])
	draw_colored_polygon(road, Color("#4a5355"))
	var road_inner := PackedVector2Array([
		Vector2(_screen_size.x * 0.5 - top_half + 2.0, horizon), Vector2(_screen_size.x * 0.5 + top_half - 2.0, horizon),
		Vector2(_screen_size.x * 0.5 + bottom_half - 3.0, _screen_size.y), Vector2(_screen_size.x * 0.5 - bottom_half + 3.0, _screen_size.y),
	])
	draw_colored_polygon(road_inner, Color("#414a4d"))
	for side in [-1.0, 1.0]:
		draw_line(Vector2(_screen_size.x * 0.5 + side * (top_half - 2.0), horizon), Vector2(_screen_size.x * 0.5 + side * (bottom_half - 4.0), _screen_size.y), Color(0.85, 0.81, 0.67, 0.72), 2.0)
		draw_line(Vector2(_screen_size.x * 0.5 + side * (top_half + 3.0), horizon), Vector2(_screen_size.x * 0.5 + side * (bottom_half + 5.0), _screen_size.y), Color(0.08, 0.10, 0.10, 0.48), 4.0)
	for lane in [-1.0, 1.0]:
		for dash in range(7):
			var y := horizon + fposmod(float(dash) * 139.0 + _world_scroll, _screen_size.y - horizon)
			var half := _road_half_width(y)
			var x: float = _screen_size.x * 0.5 + lane * half * 0.34
			var length := 10.0 + y / _screen_size.y * 24.0
			draw_line(Vector2(x, y), Vector2(x, y + length), Color(0.87, 0.83, 0.70, 0.62), 1.5 + y / _screen_size.y * 1.2)
	for crack in range(8):
		var crack_y := horizon + fposmod(float(crack) * 103.0 + _world_scroll * 0.68, _screen_size.y - horizon)
		var crack_x := _screen_size.x * 0.5 + sin(float(crack) * 7.3) * _road_half_width(crack_y) * 0.47
		draw_line(Vector2(crack_x, crack_y), Vector2(crack_x + 6.0, crack_y + 5.0 + crack_y / _screen_size.y * 8.0), Color(0.15, 0.18, 0.18, 0.35), 1.0)
	_draw_roadside_props(horizon)
	var shade := Color(0.035, 0.045, 0.043, 0.20)
	draw_rect(Rect2(0.0, 0.0, _screen_size.x, _screen_size.y * 0.09), shade)


func _draw_roadside_props(horizon: float) -> void:
	for side in [-1.0, 1.0]:
		for index in range(6):
			var y := horizon + fposmod(float(index) * 113.0 + _world_scroll * 0.73 + (41.0 if side > 0 else 0.0), _screen_size.y - horizon)
			var depth := clampf((y - horizon) / (_screen_size.y - horizon), 0.0, 1.0)
			var scale := 0.18 + depth * 0.77
			var x: float = _screen_size.x * 0.5 + side * (_road_half_width(y) + 14.0 + depth * 11.0)
			if index % 4 == 0:
				_draw_lamp(x, y, scale, side)
			elif index % 4 == 1:
				_draw_road_sign(x, y, scale, side, index)
			elif index % 4 == 2:
				_draw_wreck(x, y, scale * 0.7)
			else:
				_draw_rubble(x, y, scale)


func _draw_lamp(x: float, y: float, scale: float, side: float) -> void:
	var height := 82.0 * scale
	draw_line(Vector2(x, y), Vector2(x - side * height * 0.08, y - height), Color("#252c2b"), 4.0 * scale + 1.0)
	draw_line(Vector2(x - side * height * 0.08, y - height), Vector2(x - side * height * 0.24, y - height * 1.04), Color("#252c2b"), 3.0 * scale + 1.0)
	draw_circle(Vector2(x - side * height * 0.26, y - height * 1.04), 3.0 * scale + 1.2, Color("#efb55f"))


func _draw_road_sign(x: float, y: float, scale: float, side: float, variant: int) -> void:
	var pole_h := 44.0 * scale
	draw_line(Vector2(x, y), Vector2(x + side * 2.0, y - pole_h), Color("#252b29"), 3.0 * scale + 1.0)
	var sign_rect := Rect2(x + side * 2.0 - 13.0 * scale, y - pole_h - 18.0 * scale, 27.0 * scale, 17.0 * scale)
	draw_rect(sign_rect, Color("#a14b3b"))
	draw_rect(sign_rect.grow(-3.0 * scale), Color("#d2c29b"))
	var x0 := sign_rect.position.x + sign_rect.size.x * 0.25
	var x1 := sign_rect.position.x + sign_rect.size.x * 0.75
	var yy := sign_rect.position.y + sign_rect.size.y * 0.25
	draw_line(Vector2(x0, yy), Vector2(x1, yy + sign_rect.size.y * 0.5), Color("#a14b3b"), maxf(1.0, 2.0 * scale))
	if variant % 2 == 0:
		draw_line(Vector2(x1, yy), Vector2(x0, yy + sign_rect.size.y * 0.5), Color("#a14b3b"), maxf(1.0, 2.0 * scale))


func _draw_wreck(x: float, y: float, scale: float) -> void:
	_draw_ellipse(Vector2(x, y + 5.0 * scale), Vector2(34.0, 8.0) * scale, Color(0.02, 0.03, 0.03, 0.42))
	draw_rect(Rect2(x - 32.0 * scale, y - 19.0 * scale, 64.0 * scale, 24.0 * scale), Color("#53666a"))
	draw_colored_polygon(PackedVector2Array([Vector2(x - 18.0 * scale, y - 18.0 * scale), Vector2(x - 10.0 * scale, y - 32.0 * scale), Vector2(x + 12.0 * scale, y - 32.0 * scale), Vector2(x + 22.0 * scale, y - 18.0 * scale)]), Color("#394b4e"))
	draw_colored_polygon(PackedVector2Array([Vector2(x - 7.0 * scale, y - 29.0 * scale), Vector2(x + 10.0 * scale, y - 29.0 * scale), Vector2(x + 17.0 * scale, y - 19.0 * scale), Vector2(x - 14.0 * scale, y - 19.0 * scale)]), Color("#91a5a2"))
	for side in [-1.0, 1.0]:
		draw_circle(Vector2(x + side * 21.0 * scale, y + 2.0 * scale), 5.0 * scale + 1.0, Color("#252a29"))


func _draw_rubble(x: float, y: float, scale: float) -> void:
	draw_colored_polygon(PackedVector2Array([Vector2(x - 20.0 * scale, y), Vector2(x - 14.0 * scale, y - 9.0 * scale), Vector2(x - 7.0 * scale, y - 4.0 * scale), Vector2(x - 2.0 * scale, y - 15.0 * scale), Vector2(x + 8.0 * scale, y - 11.0 * scale), Vector2(x + 20.0 * scale, y - 3.0 * scale), Vector2(x + 17.0 * scale, y + 2.0 * scale)]), Color("#625f55"))
	draw_line(Vector2(x - 4.0 * scale, y - 5.0 * scale), Vector2(x + 5.0 * scale, y - 12.0 * scale), Color("#a49c87"), maxf(1.0, 2.0 * scale))


func _draw_entities() -> void:
	var actors: Array = []
	for zombie in _zombies:
		actors.append({"y": zombie["y"], "kind": "zombie", "data": zombie})
	for barrel in _barrels:
		if not barrel["dead"]:
			actors.append({"y": barrel["y"], "kind": "barrel", "data": barrel})
	for obstacle in _obstacles:
		if not obstacle["dead"]:
			actors.append({"y": obstacle["y"], "kind": "obstacle", "data": obstacle})
	actors.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a["y"]) < float(b["y"]))
	for actor in actors:
		match str(actor["kind"]):
			"zombie": _draw_zombie(actor["data"])
			"barrel": _draw_barrel(actor["data"])
			"obstacle": _draw_obstacle(actor["data"])


func _draw_zombie(zombie: Dictionary) -> void:
	var y := float(zombie["y"])
	var x := float(zombie["x"])
	var depth := clampf(y / _screen_size.y, 0.0, 1.0)
	var is_runner: bool = zombie["kind"] == "runner"
	var is_dead: bool = zombie["dead"]
	var frame := int(_elapsed * (9.0 if is_runner else 6.0) + float(zombie["phase"])) % 2
	var texture: Texture2D = RUNNER_IDLE if is_runner and frame == 0 else RUNNER_RUN if is_runner else WALKER_IDLE if frame == 0 else WALKER_RUN
	var width := (42.0 if is_runner else 52.0) * (0.68 + depth * 0.47)
	var height := (88.0 if is_runner else 100.0) * (0.68 + depth * 0.47)
	var fade := clampf(float(zombie["dying"]) / 0.48, 0.0, 1.0) if is_dead else 1.0
	if is_dead:
		height *= 0.58 + fade * 0.42
		y += (1.0 - fade) * 14.0
	_draw_ellipse(Vector2(x, y - 2.0), Vector2(width * 0.36, 8.0 * (0.65 + depth)), Color(0.02, 0.03, 0.03, 0.46 * fade))
	var tint := Color.WHITE
	if float(zombie["flash"]) > 0.0:
		tint = Color("#ffb1a3")
	tint.a = fade
	draw_texture_rect(texture, Rect2(x - width * 0.5, y - height, width, height), false, tint)
	if float(zombie["hp"]) < float(zombie["max_hp"]):
		var bar := Rect2(x - 18.0 * (0.7 + depth * 0.3), y - height - 7.0, 36.0 * (0.7 + depth * 0.3), 4.0)
		draw_rect(bar, Color("#1b2421"))
		draw_rect(Rect2(bar.position, Vector2(bar.size.x * maxf(0.0, float(zombie["hp"]) / float(zombie["max_hp"])), bar.size.y)), Color("#cf5b4d"))


func _draw_barrel(barrel: Dictionary) -> void:
	var x := float(barrel["x"]) + sin(float(barrel["shake"]) * 90.0) * 2.0
	var y := float(barrel["y"])
	var depth := 0.72 + clampf(y / _screen_size.y, 0.0, 1.0) * 0.42
	var w := 44.0 * depth
	var h := 58.0 * depth
	var kind := str(barrel["kind"])
	var body := Color("#766346")
	var accent := Color("#d8bb79")
	var icon: Texture2D = RAPID_ICON
	match kind:
		"rapidfire":
			body = Color("#70613a"); accent = Color("#e9d17c"); icon = RAPID_ICON
		"companion":
			body = Color("#4d6264"); accent = Color("#a9c6c8"); icon = SUPPORT_ICON
		"upgrade":
			body = Color("#70483f"); accent = Color("#e19a82"); icon = UPGRADE_ICON
		"rocket":
			body = Color("#70472e"); accent = Color("#e7aa65"); icon = ROCKET_ICON
		"explosive":
			body = Color("#713c32"); accent = Color("#ffae60"); icon = EXPLOSIVE_ICON
		"heal":
			body = Color("#536143"); accent = Color("#bdd093"); icon = HEAL_ICON
		"drone":
			body = Color("#4d5050"); accent = Color("#bcb39a"); icon = DRONE_ICON
		"weapon":
			body = Color("#4b5a57"); accent = Color("#c1d0cb"); icon = WEAPON_ICON
	_draw_ellipse(Vector2(x, y + 4.0 * depth), Vector2(w * 0.65, 8.0 * depth), Color(0.02, 0.025, 0.02, 0.45))
	draw_rect(Rect2(x - w * 0.5, y - h * 0.5, w, h), body)
	draw_rect(Rect2(x - w * 0.5, y - h * 0.5, w, h * 0.12), accent)
	draw_rect(Rect2(x - w * 0.5, y + h * 0.37, w, h * 0.12), accent)
	draw_line(Vector2(x - w * 0.33, y - h * 0.31), Vector2(x - w * 0.33, y + h * 0.31), Color(0.11, 0.13, 0.12, 0.72), 2.0 * depth)
	draw_line(Vector2(x + w * 0.33, y - h * 0.31), Vector2(x + w * 0.33, y + h * 0.31), Color(0.11, 0.13, 0.12, 0.72), 2.0 * depth)
	var icon_size := 21.0 * depth
	draw_texture_rect(icon, Rect2(x - icon_size * 0.5, y - icon_size * 0.52, icon_size, icon_size), false, Color.WHITE)
	if bool(barrel["permanent"]):
		_draw_local_center("PERM", x, y - h * 0.5 - 5.0, int(8.0 * depth + 6.0), accent, 46.0 * depth)
	var hp_width := w * 0.94
	var hp_rect := Rect2(x - hp_width * 0.5, y - h * 0.5 - 8.0, hp_width, 3.0)
	draw_rect(hp_rect, Color("#17211d"))
	draw_rect(Rect2(hp_rect.position, Vector2(hp_rect.size.x * maxf(0.0, float(barrel["hp"]) / float(barrel["max_hp"])), hp_rect.size.y)), accent)


func _draw_obstacle(obstacle: Dictionary) -> void:
	var x := float(obstacle["x"])
	var y := float(obstacle["y"])
	var depth := 0.55 + clampf(y / _screen_size.y, 0.0, 1.0) * 0.55
	var w := 66.0 * depth
	var h := 28.0 * depth
	_draw_ellipse(Vector2(x, y + 10.0 * depth), Vector2(w * 0.72, h * 0.45), Color(0.02, 0.02, 0.02, 0.42))
	draw_rect(Rect2(x - w * 0.5, y - h * 0.55, w, h), Color("#575a55"))
	for stripe in range(4):
		var sx := x - w * 0.48 + float(stripe) * w * 0.32
		draw_line(Vector2(sx, y - h * 0.5), Vector2(sx + w * 0.18, y + h * 0.35), Color("#d2a258"), maxf(1.0, 3.0 * depth))


func _draw_boss() -> void:
	if _boss.is_empty():
		return
	var x := float(_boss["x"])
	var y := float(_boss["y"])
	var scale := 1.0 + sin(float(_boss["phase"]) * 2.4) * 0.025
	var width := 148.0 * scale
	var height := 180.0 * scale
	var texture := BOSS_ATTACK if float(_boss["warning"]) > 0.0 else BOSS_IDLE
	_draw_ellipse(Vector2(x, y + height * 0.46), Vector2(width * 0.53, 17.0), Color(0.01, 0.02, 0.02, 0.58))
	var tint := Color("#ffada0") if float(_boss["flash"]) > 0.0 else Color.WHITE
	if float(_boss["death_timer"]) >= 0.0:
		tint.a = clampf(float(_boss["death_timer"]) / 1.15, 0.0, 1.0)
		scale *= 1.0 + (1.15 - float(_boss["death_timer"])) * 0.12
	draw_texture_rect(texture, Rect2(x - width * scale * 0.5, y - height * scale * 0.5, width * scale, height * scale), false, tint)
	if float(_boss["warning"]) > 0.0:
		var lane := int(_boss["attack_lane"])
		var lane_x := _lane_x(_screen_size.y * 0.75, lane)
		var pulse := 0.55 + sin(_elapsed * 20.0) * 0.25
		draw_rect(Rect2(lane_x - 31.0, _screen_size.y * 0.29, 62.0, _screen_size.y * 0.54), Color(0.76, 0.15, 0.11, 0.05 + pulse * 0.08))
		draw_line(Vector2(lane_x - 31.0, _screen_size.y * 0.29), Vector2(lane_x - 31.0, _screen_size.y * 0.83), Color(0.95, 0.28, 0.19, pulse), 2.0)
		draw_line(Vector2(lane_x + 31.0, _screen_size.y * 0.29), Vector2(lane_x + 31.0, _screen_size.y * 0.83), Color(0.95, 0.28, 0.19, pulse), 2.0)
	var hp_box := Rect2(_screen_size.x * 0.18, y - height * 0.68, _screen_size.x * 0.64, 10.0)
	draw_rect(hp_box, Color(0.045, 0.055, 0.05, 0.95))
	draw_rect(Rect2(hp_box.position, Vector2(hp_box.size.x * maxf(0.0, float(_boss["hp"]) / float(_boss["max_hp"])), hp_box.size.y)), Color("#cf5447"))
	_draw_center("HIGHWAY BRUTE", hp_box.position.y - 7.0, 11, Color("#f0e1c4"))


func _draw_missiles() -> void:
	for missile in _missiles:
		var x := float(missile["x"])
		var y := float(missile["y"])
		draw_line(Vector2(x, y - 22.0), Vector2(x, y + 7.0), Color(0.76, 0.82, 0.79, 0.55), 5.0)
		draw_texture_rect(ROCKET_TEXTURE, Rect2(x - 12.0, y - 17.0, 24.0, 36.0), false)
		draw_circle(Vector2(x, y + 13.0), 5.0, Color("#f18a3f"))


func _draw_bullets() -> void:
	for bullet in _bullets:
		var position := Vector2(float(bullet["x"]), float(bullet["y"]))
		var velocity := Vector2(float(bullet["vx"]), float(bullet["vy"]))
		var color := Color("#fff0a7") if bullet["owner"] == "player" else Color("#9ed6d0")
		draw_line(position, position - velocity.normalized() * 18.0, Color(color.r, color.g, color.b, 0.64), 3.0)
		draw_circle(position, 3.2, color)


func _draw_support() -> void:
	if _companion_time > 0.0:
		var side := 1.0 if _player_x < _screen_size.x * 0.5 else -1.0
		var x := clampf(_player_x + side * 63.0, _screen_size.x * 0.12, _screen_size.x * 0.88)
		var y := _player_y + 10.0 + sin(_elapsed * 8.0) * 1.5
		var frame := SUPPORT_IDLE if int(_elapsed * 8.0) % 2 == 0 else SUPPORT_RUN
		draw_texture_rect(frame, Rect2(x - 29.0, y - 101.0, 58.0, 101.0), false)
		_draw_local_center("%d" % int(ceil(_companion_time)), x, y - 104.0, 10, Color("#e6d49a"), 28.0)
	if _rocket_ammo > 0:
		draw_texture_rect(ROCKET_ICON, Rect2(_screen_size.x - 42.0, _screen_size.y * 0.57, 26.0, 26.0), false)
		_draw_text("×%d" % _rocket_ammo, Vector2(_screen_size.x - 13.0, _screen_size.y * 0.57 + 18.0), 12, Color("#f1d19c"))


func _setup_player_animation() -> void:
	var frames := SpriteFrames.new()
	frames.add_animation(&"idle")
	frames.add_frame(&"idle", PLAYER_IDLE)
	frames.set_animation_speed(&"idle", 1.0)
	frames.set_animation_loop(&"idle", true)
	frames.add_animation(&"run")
	frames.add_frame(&"run", PLAYER_IDLE)
	frames.add_frame(&"run", PLAYER_RUN)
	frames.set_animation_speed(&"run", 12.0)
	frames.set_animation_loop(&"run", true)
	_player_visual = AnimatedSprite2D.new()
	_player_visual.name = "PlayerAnimatedSprite"
	_player_visual.sprite_frames = frames
	_player_visual.centered = true
	_player_visual.position = Vector2(_player_x, _player_y - 64.0)
	var source_size := PLAYER_IDLE.get_size()
	_player_visual.scale = Vector2(78.0 / source_size.x, 128.0 / source_size.y)
	_player_visual.play(&"idle")
	_player_visual.visible = false
	add_child(_player_visual)


func _sync_player_animation() -> void:
	if _player_visual == null:
		return
	_player_visual.position = Vector2(_player_x, _player_y - 64.0) + _camera_offset
	_player_visual.rotation = clampf((_player_target_x - _player_x) / 220.0, -0.07, 0.07)
	_player_visual.visible = _state == RunState.PLAYING and not (_invulnerable > 0.0 and int(_invulnerable * 20.0) % 2 == 0)
	_player_visual.modulate = Color("#ffb0a3") if _invulnerable > 0.0 else Color.WHITE
	var desired_animation: StringName = &"run" if absf(_player_target_x - _player_x) > 2.0 else &"idle"
	if _player_visual.animation != desired_animation:
		_player_visual.play(desired_animation)


func _draw_player() -> void:
	if _invulnerable > 0.0 and int(_invulnerable * 20.0) % 2 == 0:
		return
	var lean := clampf((_player_target_x - _player_x) / 220.0, -0.07, 0.07)
	_draw_ellipse(Vector2(_player_x, _player_y - 1.0), Vector2(31.0, 8.0), Color(0.01, 0.02, 0.02, 0.56))
	draw_set_transform(Vector2(_player_x, _player_y) + _camera_offset, lean, Vector2.ONE)
	var gun_y := -90.0 - _player_recoil * 28.0
	draw_line(Vector2(0.0, gun_y), Vector2(1.0, gun_y - 24.0), Color("#353b38"), 7.0)
	draw_line(Vector2(0.0, gun_y), Vector2(1.0, gun_y - 24.0), Color("#a5a290"), 2.0)
	if _muzzle_flash > 0.0:
		draw_circle(Vector2(1.0, gun_y - 27.0), 7.0 + _muzzle_flash * 16.0, Color(1.0, 0.76, 0.34, 0.72))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_particles() -> void:
	for particle in _particles:
		var alpha := clampf(float(particle["life"]) / float(particle["total"]), 0.0, 1.0)
		var color: Color = particle["color"]
		color.a *= alpha
		draw_circle(particle["position"], float(particle["radius"]) * (0.55 + alpha * 0.65), color)


func _draw_effects() -> void:
	for effect in _effects:
		var position: Vector2 = effect["position"]
		var progress := 1.0 - clampf(float(effect["life"]) / float(effect["total"]), 0.0, 1.0)
		var color: Color = effect["color"]
		if effect["kind"] == "explosion":
			color.a = (1.0 - progress) * 0.24
			draw_circle(position, 25.0 + progress * 78.0, color)
			color.a = (1.0 - progress) * 0.9
			draw_arc(position, 18.0 + progress * 58.0, 0.0, TAU, 36, color, 4.0)
		elif effect["kind"] == "slam":
			color.a = (1.0 - progress) * 0.8
			draw_arc(position, 18.0 + progress * 110.0, 0.0, TAU, 40, color, 5.0)
		elif effect["kind"] == "rocket_target":
			color.a = 0.44 + sin(_elapsed * 20.0) * 0.22
			draw_arc(position, 28.0 + progress * 18.0, 0.0, TAU, 36, color, 2.0)
		elif effect["kind"] == "breach":
			color.a = (1.0 - progress) * 0.72
			draw_line(Vector2(position.x - 26.0, position.y), Vector2(position.x + 26.0, position.y), color, 3.0)
		elif effect["kind"] == "damage_text":
			color.a = 1.0 - progress
			_draw_local_center(str(effect["text"]), position.x, position.y - progress * 30.0, 14, color, 88.0)


func _draw_hud() -> void:
	var top := Rect2(10.0, 10.0, _screen_size.x - 20.0, 74.0)
	draw_rect(top, Color(0.045, 0.06, 0.055, 0.86))
	draw_rect(Rect2(top.position, Vector2(top.size.x, 2.0)), Color("#b7a77e"))
	_draw_text("STAGE 1-1 · CLOSED HIGHWAY", Vector2(20.0, 31.0), 12, Color("#ddd7c3"))
	var seconds := int(_elapsed)
	_draw_text("%02d:%02d" % [seconds / 60, seconds % 60], Vector2(_screen_size.x - 20.0, 32.0), 15, Color("#fff1ce"), HORIZONTAL_ALIGNMENT_RIGHT)
	_draw_text("SCORE  %05d" % _score, Vector2(20.0, 58.0), 11, Color("#b8c2b0"))
	_draw_text("KILLS %02d" % _kills, Vector2(_screen_size.x * 0.45, 58.0), 11, Color("#b8c2b0"))
	var hp_rect := Rect2(_screen_size.x - 105.0, 50.0, 82.0, 10.0)
	draw_rect(hp_rect, Color("#202825"))
	draw_rect(Rect2(hp_rect.position, Vector2(hp_rect.size.x * _hp / 100.0, hp_rect.size.y)), Color("#d9584f" if _hp < 40.0 else "#83b96e"))
	_draw_text("HP", Vector2(_screen_size.x - 111.0, 59.0), 9, Color("#f1e8d0"), HORIZONTAL_ALIGNMENT_RIGHT)
	if not _boss.is_empty():
		var width := _screen_size.x * 0.54
		var bar := Rect2((_screen_size.x - width) * 0.5, 96.0, width, 7.0)
		draw_rect(bar, Color(0.04, 0.05, 0.05, 0.82))
		draw_rect(Rect2(bar.position, Vector2(bar.size.x * maxf(0.0, float(_boss["hp"]) / float(_boss["max_hp"])), bar.size.y)), Color("#c95649"))
		_draw_center("BOSS  %d / %d" % [int(maxf(0.0, float(_boss["hp"]))), int(_boss["max_hp"])], 119.0, 10, Color("#f0dfc6"))
	if _permanent_rapid_fire or _rapid_fire_time > 0.0 or _companion_time > 0.0:
		var status_y := _screen_size.y - 22.0
		var labels: Array[String] = []
		if _permanent_rapid_fire:
			labels.append("RAPID FIRE")
		if _companion_time > 0.0:
			labels.append("SUPPORT %02d" % int(ceil(_companion_time)))
		if _rapid_fire_time > 0.0:
			labels.append("BOOST %02d" % int(ceil(_rapid_fire_time)))
		_draw_center("  ·  ".join(labels), status_y, 10, Color("#e2d2a5"))


func _draw_message() -> void:
	var alpha := minf(1.0, _message_time * 2.0)
	var box := Rect2(18.0, _screen_size.y * 0.21, _screen_size.x - 36.0, 46.0)
	draw_rect(box, Color(0.04, 0.05, 0.05, 0.82 * alpha))
	draw_rect(Rect2(box.position, Vector2(box.size.x, 2.0)), Color(0.83, 0.47, 0.31, alpha))
	_draw_center(_message, box.position.y + 29.0, 12, Color(0.96, 0.89, 0.75, alpha))


func _draw_menu() -> void:
	draw_rect(Rect2(Vector2.ZERO, _screen_size), Color(0.015, 0.025, 0.025, 0.64))
	var panel := Rect2(18.0, _screen_size.y * 0.27, _screen_size.x - 36.0, _screen_size.y * 0.48)
	draw_rect(panel, Color(0.045, 0.06, 0.055, 0.95))
	draw_rect(Rect2(panel.position, Vector2(panel.size.x, 2.0)), Color("#d0a15c"))
	var title := "DEAD ROUTE" if _state == RunState.TITLE else "STAGE 1 CLEARED" if _state == RunState.CLEARED else "RUN OVER"
	_draw_center(title, panel.position.y + 64.0, 28, Color("#f3ead2"))
	_draw_center("1-1  ·  CLOSED HIGHWAY", panel.position.y + 94.0, 13, Color("#d5c39f"))
	if _state == RunState.TITLE:
		_draw_center("Hold out through six waves.", panel.position.y + 139.0, 13, Color("#c1c9ba"))
		_draw_center("Defeat the Highway Brute to clear the stage.", panel.position.y + 161.0, 11, Color("#aeb8aa"))
		_draw_center("DRAG TO MOVE  ·  AUTO FIRE", panel.position.y + 197.0, 10, Color("#d5c39f"))
		_draw_center("ARROWS / A-D ON KEYBOARD", panel.position.y + 216.0, 10, Color("#aeb8aa"))
	else:
		_draw_center("%d KILLS  ·  %05d SCORE" % [_kills, _score], panel.position.y + 143.0, 13, Color("#c1c9ba"))
		_draw_center("BARRELS BROKEN  %d" % _barrels_broken, panel.position.y + 168.0, 11, Color("#aeb8aa"))
	var button := _start_button_rect()
	draw_rect(button, Color("#a86437"))
	draw_rect(Rect2(button.position, Vector2(button.size.x, 2.0)), Color("#f3cb83"))
	_draw_center("START STAGE" if _state == RunState.TITLE else "PLAY AGAIN", button.position.y + 36.0, 16, Color("#fff5dd"))


func _draw_local_center(text: String, x: float, baseline: float, size: int, color: Color, width: float = 100.0) -> void:
	draw_string(ThemeDB.fallback_font, Vector2(x - width * 0.5, baseline), text, HORIZONTAL_ALIGNMENT_CENTER, width, size, color)


func _draw_center(text: String, baseline: float, size: int, color: Color) -> void:
	_draw_text(text, Vector2(0.0, baseline), size, color, HORIZONTAL_ALIGNMENT_CENTER)


func _draw_text(text: String, position: Vector2, size: int, color: Color, alignment: int = HORIZONTAL_ALIGNMENT_LEFT) -> void:
	var draw_position := position
	var draw_width := _screen_size.x
	if alignment == HORIZONTAL_ALIGNMENT_RIGHT:
		draw_position.x = 0.0
		draw_width = position.x
	draw_string(ThemeDB.fallback_font, draw_position, text, alignment, draw_width, size, color)


func _draw_ellipse(center: Vector2, radii: Vector2, color: Color) -> void:
	draw_ellipse(center, radii.x, radii.y, color)
