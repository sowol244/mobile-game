extends Node2D

const PLAYER_IDLE: Texture2D = preload("res://assets/player-back-a.webp")
const PLAYER_RUN: Texture2D = preload("res://assets/player-back-b.webp")
const ZOMBIE_IDLE: Texture2D = preload("res://assets/zombie-walker.webp")
const ZOMBIE_RUN: Texture2D = preload("res://assets/zombie-walker-run.webp")

const ROUND_LENGTH := 35.0
const PLAYER_FIRE_INTERVAL := 0.34
const PLAYER_MOVE_SPEED := 300.0

enum RunState { TITLE, PLAYING, CLEARED, GAME_OVER }

var _screen_size := Vector2(360.0, 640.0)
var _state: RunState = RunState.TITLE
var _elapsed := 0.0
var _hp := 100.0
var _kills := 0
var _player_x := 180.0
var _player_target_x := 180.0
var _player_y := 500.0
var _player_anim_time := 0.0
var _player_frame := 0
var _fire_timer := 0.0
var _spawn_timer := 0.55
var _world_scroll := 0.0
var _dragging := false
var _drag_origin_x := 0.0
var _drag_origin_player_x := 0.0
var _invulnerable := 0.0
var _zombies: Array = []
var _bullets: Array = []
var _particles: Array = []


func _ready() -> void:
	get_viewport().size_changed.connect(_on_viewport_resized)
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
	_player_y = _screen_size.y * 0.78
	_clamp_player()
	queue_redraw()


func _process(delta: float) -> void:
	_world_scroll += delta * 116.0
	if _state == RunState.PLAYING:
		_update_run(delta)
	queue_redraw()


func _update_run(delta: float) -> void:
	_elapsed += delta
	_player_anim_time += delta
	if _player_anim_time >= 0.18:
		_player_anim_time = 0.0
		_player_frame = 1 - _player_frame

	if _invulnerable > 0.0:
		_invulnerable = maxf(0.0, _invulnerable - delta)

	var keyboard_axis := float(Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A))
	if keyboard_axis != 0.0:
		_player_target_x += keyboard_axis * PLAYER_MOVE_SPEED * delta
		_clamp_player_target()
	_player_x = move_toward(_player_x, _player_target_x, PLAYER_MOVE_SPEED * 2.2 * delta)

	_spawn_timer -= delta
	if _spawn_timer <= 0.0:
		_spawn_zombie()
		_spawn_timer = maxf(0.58, 1.12 - _elapsed * 0.009) + randf_range(-0.12, 0.12)

	_fire_timer -= delta
	if _fire_timer <= 0.0:
		_fire_auto()
		_fire_timer = PLAYER_FIRE_INTERVAL

	_update_zombies(delta)
	_update_bullets(delta)
	_update_particles(delta)
	_check_hits()

	if _hp <= 0.0:
		_state = RunState.GAME_OVER
		_dragging = false
	elif _elapsed >= ROUND_LENGTH:
		_state = RunState.CLEARED
		_dragging = false


func _spawn_zombie() -> void:
	var top_y := _screen_size.y * 0.16
	var spread := _road_half_width(top_y) * 0.82
	var lane := randi_range(0, 2)
	var lane_offset := float(lane - 1) * spread * 0.68
	_zombies.append({
		"x": _screen_size.x * 0.5 + lane_offset + randf_range(-9.0, 9.0),
		"y": top_y + randf_range(-22.0, 15.0),
		"speed": randf_range(62.0, 80.0) + minf(18.0, _elapsed * 0.35),
		"hp": 3,
		"flash": 0.0,
		"anim": randf_range(0.0, 1.0),
		"dead": false,
		"death_time": 0.30,
		"knockback": 0.0,
	})


func _fire_auto() -> void:
	var origin := Vector2(_player_x, _player_y - 94.0)
	var target_position := Vector2(_player_x, 0.0)
	var nearest_distance := INF
	for zombie in _zombies:
		if zombie["dead"]:
			continue
		var candidate := Vector2(zombie["x"], zombie["y"] - 32.0)
		var distance := origin.distance_squared_to(candidate)
		if distance < nearest_distance:
			nearest_distance = distance
			target_position = candidate
	var direction := (target_position - origin).normalized()
	if direction.y >= -0.15:
		direction = Vector2.UP
	_bullets.append({"position": origin, "velocity": direction * 520.0, "life": 1.5})
	_spawn_particles(origin + Vector2(0.0, -4.0), Color("#ffe18a"), 2, 54.0)


func _update_zombies(delta: float) -> void:
	for index in range(_zombies.size() - 1, -1, -1):
		var zombie: Dictionary = _zombies[index]
		zombie["anim"] = float(zombie["anim"]) + delta
		zombie["flash"] = maxf(0.0, float(zombie["flash"]) - delta)
		if zombie["dead"]:
			zombie["death_time"] = float(zombie["death_time"]) - delta
			if zombie["death_time"] <= 0.0:
				_zombies.remove_at(index)
			continue
		zombie["y"] = float(zombie["y"]) + float(zombie["speed"]) * delta
		zombie["x"] = float(zombie["x"]) + float(zombie["knockback"]) * delta
		zombie["knockback"] = move_toward(float(zombie["knockback"]), 0.0, 120.0 * delta)


func _update_bullets(delta: float) -> void:
	for index in range(_bullets.size() - 1, -1, -1):
		var bullet: Dictionary = _bullets[index]
		var bullet_position: Vector2 = bullet["position"]
		var bullet_velocity: Vector2 = bullet["velocity"]
		var next_position := bullet_position + bullet_velocity * delta
		bullet["position"] = next_position
		bullet["life"] = float(bullet["life"]) - delta
		if bullet["life"] <= 0.0 or next_position.y < -30.0:
			_bullets.remove_at(index)


func _check_hits() -> void:
	for bullet_index in range(_bullets.size() - 1, -1, -1):
		var bullet_position: Vector2 = _bullets[bullet_index]["position"]
		for zombie_index in range(_zombies.size() - 1, -1, -1):
			var zombie: Dictionary = _zombies[zombie_index]
			if zombie["dead"]:
				continue
			var hit_center := Vector2(zombie["x"], zombie["y"] - 32.0)
			if bullet_position.distance_to(hit_center) <= 30.0:
				_bullets.remove_at(bullet_index)
				zombie["hp"] = int(zombie["hp"]) - 1
				zombie["flash"] = 0.16
				zombie["knockback"] = signf(float(zombie["x"]) - _player_x) * 28.0
				_spawn_particles(bullet_position, Color("#ffc07a"), 5, 110.0)
				if int(zombie["hp"]) <= 0:
					zombie["dead"] = true
					_kills += 1
					_spawn_particles(hit_center, Color("#ed574b"), 13, 150.0)
				break

	if _invulnerable > 0.0:
		return
	for zombie in _zombies:
		if zombie["dead"]:
			continue
		if float(zombie["y"]) >= _player_y - 27.0:
			if absf(float(zombie["x"]) - _player_x) < 46.0:
				_hp = maxf(0.0, _hp - 24.0)
				_invulnerable = 0.70
				_spawn_particles(Vector2(_player_x, _player_y - 54.0), Color("#ff514e"), 18, 190.0)
			zombie["dead"] = true
			zombie["death_time"] = 0.16


func _update_particles(delta: float) -> void:
	for index in range(_particles.size() - 1, -1, -1):
		var particle: Dictionary = _particles[index]
		var particle_position: Vector2 = particle["position"]
		var particle_velocity: Vector2 = particle["velocity"]
		particle["position"] = particle_position + particle_velocity * delta
		particle["velocity"] = particle_velocity * (1.0 - delta * 1.8)
		particle["life"] = float(particle["life"]) - delta
		if particle["life"] <= 0.0:
			_particles.remove_at(index)


func _spawn_particles(position: Vector2, color: Color, count: int, speed: float) -> void:
	for _i in range(count):
		var direction := Vector2.from_angle(randf_range(0.0, TAU))
		_particles.append({
			"position": position,
			"velocity": direction * randf_range(speed * 0.25, speed),
			"life": randf_range(0.16, 0.42),
			"max_life": 0.42,
			"radius": randf_range(1.4, 3.4),
			"color": color,
		})


func _clamp_player_target() -> void:
	var limit := _road_half_width(_player_y) * 0.70
	_player_target_x = clampf(_player_target_x, _screen_size.x * 0.5 - limit, _screen_size.x * 0.5 + limit)


func _clamp_player() -> void:
	_clamp_player_target()
	_player_x = clampf(_player_x, _screen_size.x * 0.5 - _road_half_width(_player_y) * 0.70, _screen_size.x * 0.5 + _road_half_width(_player_y) * 0.70)


func _road_half_width(y: float) -> float:
	var depth := clampf((y - _screen_size.y * 0.10) / (_screen_size.y * 0.90), 0.0, 1.0)
	return _screen_size.x * (0.16 + depth * 0.30)


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
	if _state == RunState.TITLE or _state == RunState.CLEARED or _state == RunState.GAME_OVER:
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
	_hp = 100.0
	_kills = 0
	_player_x = _screen_size.x * 0.5
	_player_target_x = _player_x
	_player_y = _screen_size.y * 0.78
	_player_frame = 0
	_player_anim_time = 0.0
	_fire_timer = 0.05
	_spawn_timer = 0.45
	_invulnerable = 0.0
	_zombies.clear()
	_bullets.clear()
	_particles.clear()
	_dragging = false
	queue_redraw()


func _start_button_rect() -> Rect2:
	return Rect2(_screen_size.x * 0.5 - 102.0, _screen_size.y * 0.60, 204.0, 58.0)


func _draw() -> void:
	_draw_background()
	if _state == RunState.PLAYING:
		_draw_bullets()
		_draw_zombies()
		_draw_player()
		_draw_particles()
		_draw_hud()
	else:
		_draw_menu()


func _draw_background() -> void:
	draw_rect(Rect2(Vector2.ZERO, _screen_size), Color("#263b31"))
	var horizon := _screen_size.y * 0.10
	draw_rect(Rect2(0.0, 0.0, _screen_size.x, horizon + 28.0), Color("#405b45"))
	var top_half := _road_half_width(horizon)
	var bottom_half := _road_half_width(_screen_size.y)
	var shoulder := PackedVector2Array([
		Vector2(_screen_size.x * 0.5 - top_half - 7.0, horizon),
		Vector2(_screen_size.x * 0.5 + top_half + 7.0, horizon),
		Vector2(_screen_size.x * 0.5 + bottom_half + 10.0, _screen_size.y),
		Vector2(_screen_size.x * 0.5 - bottom_half - 10.0, _screen_size.y),
	])
	draw_colored_polygon(shoulder, Color("#a09473"))
	var road := PackedVector2Array([
		Vector2(_screen_size.x * 0.5 - top_half, horizon),
		Vector2(_screen_size.x * 0.5 + top_half, horizon),
		Vector2(_screen_size.x * 0.5 + bottom_half, _screen_size.y),
		Vector2(_screen_size.x * 0.5 - bottom_half, _screen_size.y),
	])
	draw_colored_polygon(road, Color("#424a4b"))
	_draw_tree_line(-1.0, horizon)
	_draw_tree_line(1.0, horizon)
	draw_line(Vector2(_screen_size.x * 0.5 - top_half, horizon), Vector2(_screen_size.x * 0.5 - bottom_half, _screen_size.y), Color("#d2c49d"), 3.0)
	draw_line(Vector2(_screen_size.x * 0.5 + top_half, horizon), Vector2(_screen_size.x * 0.5 + bottom_half, _screen_size.y), Color("#d2c49d"), 3.0)
	for lane in [-1.0, 1.0]:
		for dash in range(6):
			var y := horizon + fposmod(float(dash) * 146.0 + _world_scroll, _screen_size.y - horizon)
			var half := _road_half_width(y)
			var x: float = _screen_size.x * 0.5 + lane * half * 0.34
			var length := 12.0 + y / _screen_size.y * 20.0
			draw_line(Vector2(x, y), Vector2(x, y + length), Color(0.86, 0.83, 0.69, 0.66), 2.0 + y / _screen_size.y)


func _draw_tree_line(side: float, horizon: float) -> void:
	for tree_index in range(7):
		var y := horizon + fposmod(float(tree_index) * 118.0 + _world_scroll * 0.78, _screen_size.y - horizon)
		var depth := (y - horizon) / (_screen_size.y - horizon)
		var half := _road_half_width(y)
		var x := _screen_size.x * 0.5 + side * (half + 18.0 + depth * 14.0)
		var size := 9.0 + depth * 17.0
		draw_rect(Rect2(x - size * 0.13, y, size * 0.26, size * 0.9), Color("#514437"))
		draw_circle(Vector2(x, y - size * 0.15), size * 0.62, Color("#314c37"))
		draw_circle(Vector2(x - size * 0.22, y - size * 0.36), size * 0.40, Color("#476642"))


func _draw_bullets() -> void:
	for bullet in _bullets:
		var position: Vector2 = bullet["position"]
		var velocity: Vector2 = bullet["velocity"]
		draw_line(position, position - velocity.normalized() * 17.0, Color("#fff0a7"), 3.0)
		draw_circle(position, 3.2, Color("#fff8d1"))


func _draw_zombies() -> void:
	for zombie in _zombies:
		var position := Vector2(zombie["x"], zombie["y"])
		var depth := clampf(position.y / _screen_size.y, 0.0, 1.0)
		var sprite_size := Vector2(51.0, 99.0) * (0.70 + depth * 0.42)
		var texture: Texture2D = ZOMBIE_IDLE if int(float(zombie["anim"]) * 7.0) % 2 == 0 else ZOMBIE_RUN
		var tint := Color.WHITE
		if float(zombie["flash"]) > 0.0:
			tint = Color("#ffaaaa")
		if zombie["dead"]:
			var fade := clampf(float(zombie["death_time"]) / 0.30, 0.0, 1.0)
			tint.a = fade
			sprite_size *= 0.65 + fade * 0.35
		draw_texture_rect(texture, Rect2(position.x - sprite_size.x * 0.5, position.y - sprite_size.y, sprite_size.x, sprite_size.y), false, tint)
		if not zombie["dead"] and int(zombie["hp"]) < 3:
			var bar := Rect2(position.x - 19.0, position.y - sprite_size.y - 8.0, 38.0, 4.0)
			draw_rect(bar, Color("#17211c"))
			draw_rect(Rect2(bar.position, Vector2(bar.size.x * float(zombie["hp"]) / 3.0, bar.size.y)), Color("#ea6659"))


func _draw_player() -> void:
	if _invulnerable > 0.0 and int(_invulnerable * 20.0) % 2 == 0:
		return
	var texture := PLAYER_IDLE if _player_frame == 0 else PLAYER_RUN
	var lean := clampf((_player_target_x - _player_x) / 220.0, -0.075, 0.075)
	draw_set_transform(Vector2(_player_x, _player_y), lean, Vector2.ONE)
	draw_colored_polygon(PackedVector2Array([
		Vector2(-28.0, -5.0), Vector2(0.0, -1.0), Vector2(28.0, -5.0),
		Vector2(17.0, 5.0), Vector2(-18.0, 5.0),
	]), Color(0.04, 0.06, 0.05, 0.55))
	draw_texture_rect(texture, Rect2(-37.0, -126.0, 74.0, 126.0), false)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_particles() -> void:
	for particle in _particles:
		var alpha := clampf(float(particle["life"]) / float(particle["max_life"]), 0.0, 1.0)
		var color: Color = particle["color"]
		color.a = alpha
		draw_circle(particle["position"], float(particle["radius"]) * (0.55 + alpha * 0.65), color)


func _draw_hud() -> void:
	var panel := Rect2(12.0, 12.0, _screen_size.x - 24.0, 74.0)
	draw_rect(panel, Color(0.055, 0.075, 0.07, 0.83))
	draw_rect(Rect2(panel.position, Vector2(panel.size.x, 1.5)), Color("#a6a47d"))
	_draw_text("SURVIVE", Vector2(24.0, 37.0), 14, Color("#e7e3ce"))
	_draw_text("%02d SEC" % int(maxf(0.0, ROUND_LENGTH - _elapsed)), Vector2(_screen_size.x - 24.0, 37.0), 17, Color("#fff2cf"), HORIZONTAL_ALIGNMENT_RIGHT)
	_draw_text("KILLS  %02d" % _kills, Vector2(24.0, 60.0), 12, Color("#c7d2bd"))
	var hp_rect := Rect2(_screen_size.x - 137.0, 49.0, 112.0, 10.0)
	draw_rect(hp_rect, Color("#202827"))
	draw_rect(Rect2(hp_rect.position, Vector2(hp_rect.size.x * _hp / 100.0, hp_rect.size.y)), Color("#d9584f" if _hp < 40.0 else "#83b96e"))
	_draw_text("HP", Vector2(_screen_size.x - 146.0, 59.0), 10, Color("#f1e8d0"), HORIZONTAL_ALIGNMENT_RIGHT)


func _draw_menu() -> void:
	draw_rect(Rect2(Vector2.ZERO, _screen_size), Color(0.015, 0.025, 0.025, 0.50))
	var panel_height := 266.0
	var panel := Rect2(20.0, _screen_size.y * 0.31, _screen_size.x - 40.0, panel_height)
	draw_rect(panel, Color(0.055, 0.075, 0.07, 0.94))
	draw_rect(Rect2(panel.position, Vector2(panel.size.x, 2.0)), Color("#d0a15c"))
	var title := "DEAD ROUTE" if _state == RunState.TITLE else "RUN COMPLETE" if _state == RunState.CLEARED else "RUN OVER"
	_draw_center(title, panel.position.y + 65.0, 27, Color("#f3ead2"))
	var detail := "DRAG TO DODGE · AUTO FIRE" if _state == RunState.TITLE else "%d KILLS · %d SEC" % [_kills, int(_elapsed)]
	_draw_center(detail, panel.position.y + 105.0, 13, Color("#c3c9b3"))
	_draw_center("Move left and right to avoid the horde.", panel.position.y + 144.0, 12, Color("#aeb8aa"))
	_draw_center("Arrow keys / A-D also work on PC.", panel.position.y + 166.0, 12, Color("#aeb8aa"))
	var button := _start_button_rect()
	draw_rect(button, Color("#c88139"))
	draw_rect(Rect2(button.position, Vector2(button.size.x, 2.0)), Color("#f3cb83"))
	_draw_center("START RUN" if _state == RunState.TITLE else "PLAY AGAIN", button.position.y + 36.0, 17, Color("#fff5dd"))


func _draw_center(text: String, baseline: float, size: int, color: Color) -> void:
	_draw_text(text, Vector2(0.0, baseline), size, color, HORIZONTAL_ALIGNMENT_CENTER)


func _draw_text(text: String, position: Vector2, size: int, color: Color, alignment: int = HORIZONTAL_ALIGNMENT_LEFT) -> void:
	var draw_position := position
	var draw_width := _screen_size.x
	if alignment == HORIZONTAL_ALIGNMENT_RIGHT:
		draw_position.x = 0.0
		draw_width = position.x
	draw_string(ThemeDB.fallback_font, draw_position, text, alignment, draw_width, size, color)
