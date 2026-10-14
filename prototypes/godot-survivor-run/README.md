# DEAD ROUTE · Godot 1-1

Godot 4 프로젝트로 구현한 `폐쇄 고속도로` 스테이지입니다. 기존 JavaScript판은 유지하고, Godot판은 별도 주소로만 접속할 수 있도록 배포합니다.

- 플레이 흐름: HTML판의 6개 웨이브와 같은 등장 시점·차선, 보급 선택, 폭발통, 로켓, 장애물, 62초 보스 경고, 64초 보스전을 따릅니다.
- 클리어 조건: 35초 생존이 아니라 체력 350의 보스를 처치하는 것입니다.
- 조작: 화면을 좌우로 드래그합니다. PC에서는 ←/→ 또는 A/D를 사용합니다. 사격은 자동입니다.
- 화면: 세로형 고속도로, 깊이에 따른 적 크기와 Y 정렬, 움직이는 도로변, 피격·폭발 파티클, 카메라 흔들림을 사용합니다. 플레이어 정지/달리기 동작은 Godot `AnimatedSprite2D`로 재생합니다.

## Godot 에디터에서 실행

1. Godot 4.7.2 이상에서 `project.godot`을 엽니다.
2. F6 또는 F5를 눌러 실행합니다.
3. `stage1_config.gd`에서 웨이브와 보스 타이밍을 조정합니다.

## 웹 빌드

Godot 4.7.2에 맞는 Web export template이 필요합니다. 저장소 루트에서 다음 명령을 실행합니다.

```sh
export GODOT_BIN="/path/to/Godot"
"$GODOT_BIN" --headless --path prototypes/godot-survivor-run \
  --export-release Web ../../godot-survivor-run/index.html
python3 prototypes/godot-survivor-run/tools/package_web_export.py godot-survivor-run
```

출력 파일은 `godot-survivor-run/`에 생성됩니다. 현재 웹 내보내기는 WebAssembly 런타임을 포함해 약 42MB입니다. 이 폴더를 HTTP 서버로 제공해야 WebAssembly를 실행할 수 있습니다. 파일을 직접 열거나 `file://`로 실행하지 않습니다.

현재 별도 접속 주소는 [https://sowol244.github.io/mobile-game/godot-survivor-run/](https://sowol244.github.io/mobile-game/godot-survivor-run/)입니다. 메인 페이지 게임 목록에는 표시하지 않습니다. HTML판은 [survivor-run/](../../survivor-run/)에 그대로 남아 있습니다.
