# OP3 Reference

!!! abstract "요약"
    - [ROBOTIS-OP3](https://emanual.robotis.com/docs/en/platform/op3/introduction/): 코드가 공개된 소형 휴머노이드 레퍼런스
    - OP3는 `ros2_control`을 쓰지 않음 — 자체 `robotis_framework`로 다이나믹셀 직접 제어
    - RH+에 가져온 것: **보행 알고리즘만** (`rhphumanoid_walking`). 하드웨어 계층은 자체 구현

## 구조

```text
 op3_demo / GUI / 외부 노드
        │  /robotis/... topic · service
        ▼
 op3_manager ── 기능 모듈 로드 (walking · action · head · direct · base · tuning)
        │
        ▼
 robotis_controller   8 ms 주기 process()
        │  Bulk Read (상태) / Sync Write (목표)
        ▼
 DynamixelSDK → OpenCR → XM430 × 20
```

| OP3 | RH+ 대응 |
|---|---|
| `op3_manager` + 기능 모듈 | `controller_manager` + `joint_trajectory_controller` |
| `robotis_controller` (8 ms) | `rhphumanoid::Process()` (20 ms) |
| DynamixelSDK | `serial_servo_bus.cpp` (Hiwonder 프로토콜) |
| `op3_walking_module` | `rhphumanoid_walking` (별도 노드, action 전송) |
| `gazebo` 파라미터 분기 | URDF `use_gazebo` 분기 → [ros2_control 태그](description.md#ros2-control-tag) |

## 설치 (Jazzy)

```bash
sudo apt-get install libncurses-dev
mkdir -p ~/robotis_ws/src && cd ~/robotis_ws/src

git clone --branch jazzy https://github.com/ROBOTIS-GIT/DynamixelSDK
for r in ROBOTIS-Framework ROBOTIS-Framework-msgs ROBOTIS-Math ROBOTIS-OP3 ROBOTIS-OP3-Common \
         ROBOTIS-OP3-Demo ROBOTIS-OP3-ETC ROBOTIS-OP3-msgs ROBOTIS-OP3-Tools ROBOTIS-Utility; do
  git clone --branch jazzy-devel https://github.com/ROBOTIS-GIT/$r
done

cd ~/robotis_ws && colcon build
sudo apt install ros-jazzy-web-video-server ros-jazzy-rosbridge-server v4l-utils   # 데모용
```

## 리포지토리

| 리포 | 내용 |
|---|---|
| `ROBOTIS-OP3` | manager · 기능 모듈 (아래 표) |
| `ROBOTIS-OP3-Common` | URDF · 메시 · Gazebo/RViz 플러그인 |
| `ROBOTIS-OP3-msgs` | 메시지 타입 |
| `ROBOTIS-OP3-Tools` | GUI · action editor · tuner |
| `ROBOTIS-OP3-Demo` | ball detector · bringup · read-write demo |
| `ROBOTIS-Framework` | `robotis_controller` |
| `DynamixelSDK` | 다이나믹셀 통신 라이브러리 |

### ROBOTIS-OP3 패키지

| 패키지 | 기능 |
|---|---|
| `op3_manager` | 포트 열기 · 토크 ON · 모듈 등록 · 메인 루프 시작 |
| `op3_walking_module` | YAML 파라미터 기반 **사인파 궤적** + 자이로 피드백 |
| `op3_online_walking_module` | **LIPM + preview control**, IMU 균형, 발자국 지정 |
| `op3_kinematics_dynamics` | FK/IK. WholeBody · Manipulation · Walking 트리, 다리 전용 IK |
| `op3_balance_control` | Damping · PD 제어 → 기울기를 관절각 보정으로 변환 |
| `op3_action_module` | 저장된 동작 재생 (일어나기, 인사) |
| `op3_base_module` | 초기 자세 → 다른 모듈에 제어권 이양 |
| `op3_head_control_module` | `head_pan` · `head_tilt`, 4방향 자동 스캔 |
| `op3_direct_control_module` | 토픽으로 전 관절 직접 제어. 최소 저크 궤적 + 자기충돌 검사 |
| `op3_tuning_module` | 관절 offset · gain 보정 → YAML 저장 |
| `op3_localization` | 골반 움직임 누적 → 위치 추정 · TF |
| `open_cr_module` | OpenCR의 IMU · 버튼 · 전압 → 토픽 |

## 시뮬레이션 / 실물 전환

`op3_manager`의 `gazebo` 파라미터

| 값 | 동작 |
|---|---|
| `false` | `/dev/ttyUSB0` 열기 → 다이나믹셀 초기화 |
| `true` | 하드웨어 설정 생략 → Gazebo 로봇 이름 설정 |

실물 없이 `op3_bringup` 실행 시 아래 에러는 정상

```text
[op3_manager-1] [ERROR]: PORT [/dev/ttyUSB0] SETUP ERROR! (baudrate: 2000000)
[ERROR] [op3_manager-1]: process has died [... exit code 255 ...]
```

### Webots 실행

- `op3_gazebo_ros2`: `controller_manager` 서비스를 찾지 못해 로봇이 엎어진 상태로 정지
- **Webots: 정상 동작**

```bash
sudo mkdir -p /etc/apt/keyrings && cd /etc/apt/keyrings
sudo wget -q https://cyberbotics.com/Cyberbotics.asc
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/Cyberbotics.asc] https://cyberbotics.com/debian binary-amd64/" \
  | sudo tee /etc/apt/sources.list.d/Cyberbotics.list
sudo apt update && sudo apt install webots ros-jazzy-webots-ros2
```

`~/.bashrc` 추가 (없으면 `libCppController.so` 에러)

```bash
export WEBOTS_HOME=/usr/local/webots
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:$WEBOTS_HOME/lib/controller
```

```bash
ros2 launch op3_webots_ros2 robot_launch.py
ros2 launch op3_manager op3_simulation.launch.py
ros2 launch op3_gui_demo op3_demo.launch.py     # Mode control → walking → Start
```

## 도구

| 명령 | 용도 |
|---|---|
| `ros2 launch op3_gui_demo op3_demo.launch.py` | 모듈 전환 · 보행 파라미터 튜닝 · 머리 각도 · 모션 실행 |
| `ros2 launch op3_tuner_client op3_tuner_client.launch.xml` | offset · gain 조정 → `config/offset.yaml` |
| `ros2 run op3_action_editor executor.py` | 관절 위치(4095 해상도)를 시계열로 → 액션 생성 |
| `ros2 launch op3_ball_detector ball_detector_from_usb_cam.launch.py` | HSV 필터 → HoughCircles 공 검출 |
| `ros2 launch op3_read_write_demo op3_read_write.launch.xml` | 최하위 통신 테스트 (전 관절 read / write) |

- action editor · tuner는 실물 연결 필요
- RH+ 대체 도구: `RHp_humanoid_controller/scripts/motor_control_gui.py` (관절 슬라이더 → 자세 → 시퀀스)

## 설정 파일

| 파일 | 내용 |
|---|---|
| `op3_manager/config/OP3.robot` | 제어 주기 · 포트 · baud rate · 장치 목록 |
| `op3_manager/config/dxl_init_OP3.yaml` | 모터별 control table 초기값 (`min/max_position_limit`, `return_delay_time`) |
| `op3_manager/config/offset.yaml` | 관절별 offset (rad) |
| `op3_tuning_module/data/tune_pose.yaml` | offset · gain 조정용 기준 자세 |

## 보행 파라미터

| 파라미터 | 의미 | 기본값 |
|---|---|---|
| `period_time` | 두 걸음(좌+우) 주기 | 600 ms |
| `dsp_ratio` | 양발 지지 구간 비율 | 0.2 |
| `swing_right_left` | 좌우 흔들림 | 0.028 m |
| `swing_top_down` | 상하 흔들림 | 0.006 m |
| `x / y / z_offset` | 발 기준 위치 보정 | 예: −0.02 / 0.015 / 0.035 m |
| `roll / pitch / yaw_offset`, `pelvis_offset` | 발 · 골반 자세 보정 | — |

**offset이 필요한 이유**

- 설계 좌표의 0 ≠ 실물이 안정적으로 서는 0
- 다리 길이 · 서보 초기각 · 무게중심 오차 → 보정 없이 사인 궤적을 그리면 발이 바닥을 긁거나 뜨거나 몸이 앞으로 쏠림
- 사람도 발을 약간 벌리고 살짝 뒤에 두고 선다

→ 보행 원리 상세: [Walking Pattern](../walk/index.md)

## 참고

- [OP3 e-Manual](https://emanual.robotis.com/docs/en/platform/op3/introduction/)
- [ROBOTIS ROS Packages](https://emanual.robotis.com/docs/en/platform/op3/robotis_ros_packages/)
- [OP3 Simulation](https://emanual.robotis.com/docs/en/platform/op3/simulation/)
- [ROBOTIS-OP3-Simulations](https://github.com/ROBOTIS-GIT/ROBOTIS-OP3-Simulations) (`jazzy-devel`)
