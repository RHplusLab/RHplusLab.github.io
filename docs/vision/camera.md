# Camera Setup

!!! abstract "요약"
    - 카메라 노드: [`usb_cam`](https://index.ros.org/p/usb_cam/) — `rhphumanoid_bringup.launch.py`가 실제 로봇 모드에서 실행
    - 카메라가 **거꾸로 장착**돼 있어 `image_flipper`가 180° 회전한 영상을 따로 발행
    - 머리 2축(`head_pan` · `head_tilt`)은 ros2_control `head_controller`로 제어
    - 시뮬레이션은 Gazebo 카메라 센서를 `ros_gz_bridge`로 연결 (토픽 이름이 실물과 다름 → [5절](#gazebo))
    - 소스: [`RHp_humanoid_resources`](https://github.com/RHplusLab/RHp_humanoid_resources) (bringup · description · hardware_interface), [`RHp_humanoid_controller`](https://github.com/RHplusLab/RHp_humanoid_controller) (`rhphumanoid_head_controller`)

## 토픽 { #topics }

| 토픽 | 발행 노드 | 내용 |
|---|---|---|
| `/image_raw` · `/camera_info` | `usb_cam` (실물) | 원본 영상 · 카메라 정보 |
| `/image_raw/compressed` | `usb_cam` (`image_transport`) | 압축 영상 (실물) |
| `/image_flipped/compressed` | `image_flipper` | 180° 회전한 압축 영상 (실물) |
| `/usb_cam/image_raw` · `/usb_cam/camera_info` | `ros_gz_bridge` | Gazebo 카메라 영상 · 정보 |

- `usb_cam`은 노드 이름과 상관없이 `image_raw`(상대 이름)로 발행 → 네임스페이스가 없으면 `/image_raw` ([usb_cam 소스](https://github.com/ros-drivers/usb_cam/blob/main/src/usb_cam_node.cpp))

## 1. 카메라 노드 (usb_cam)

설치 → [Workspace Setup › 의존성](../install/workspace.md#dependencies)

```python
# rhphumanoid_bringup/launch/rhphumanoid_bringup.launch.py
usb_cam_device_path = "/dev/v4l/by-id/usb-HD_USB_Camera_HD_USB_Camera-video-index0"
if os.path.exists(usb_cam_device_path):
    usb_cam_device_path = os.path.realpath(usb_cam_device_path)
else:
    usb_cam_device_path = "/dev/video0"

usb_cam_node = Node(
    package='usb_cam',
    executable='usb_cam_node_exe',
    name='usb_cam',
    parameters=[{
        'video_device': usb_cam_device_path,
        'framerate': 30.0,
        'image_width': 640,
        'image_height': 480,
        'pixel_format': 'mjpeg2rgb',  # YUYV 대신 MJPEG을 사용하고 RGB로 변환하여 송출
        'camera_name': 'usb_cam',
        'frame_id': 'camera_frame'
    }],
    condition=UnlessCondition(use_sim)
)
```

| 파라미터 | 값 | 이유 |
|---|---|---|
| `video_device` | `/dev/v4l/by-id/...` → 절대 경로 | USB 장치 번호(`/dev/videoN`)는 연결 순서에 따라 바뀜 → 고유 ID 경로 사용 |
| | `os.path.realpath` 변환 | by-id 심볼릭 링크를 그대로 넘기면 `usb_cam`이 상대 경로(`../..`)를 잘못 해석하는 경우가 있음 |
| `pixel_format` | `mjpeg2rgb` | 카메라에서 MJPEG으로 받아 RGB로 변환. YUYV(비압축)보다 USB 전송량이 작음 → [프레임 드랍](#troubleshooting) |
| `image_width` · `height` | 640 × 480 | |

- 카메라 ID 경로 확인: `ls -l /dev/v4l/by-id/`
- 다른 카메라를 쓰면 `usb_cam_device_path` 문자열을 바꾼다

## 2. 영상 회전 (image_flipper)

카메라가 머리에 거꾸로 달려 있어 영상이 위아래 · 좌우 모두 뒤집혀 나온다.

```text
/image_raw/compressed  ──▶  image_flipper (180° 회전)  ──▶  /image_flipped/compressed
```

- 패키지 `rhphumanoid_vision`, 실행 파일 `image_flipper` (실물 로봇에서만 실행)
- 입력 · 출력 모두 압축 영상 (`sensor_msgs/CompressedImage`)

!!! note
    `rhphumanoid_vision` 패키지는 GitHub 저장소에 아직 없다. 저장소만 받아 빌드하면 bringup 실행 시 이 노드가 실패한다.

## 3. 머리 2축 (pan · tilt)

| 관절 | 방향 | 범위 (URDF) |
|---|---|---|
| `head_pan` | + 왼쪽 / − 오른쪽 | ±120° (±2π/3 rad) |
| `head_tilt` | + 아래 / − 위 | ±120° |

```text
head_controller (JointTrajectoryController)
   │ /head_controller/follow_joint_trajectory
   ▼
PWMHeadSystemHardware          rad → PWM duty
   ▼
SG-90 서보 2개                  pan: pwmchip3/0 · tilt: pwmchip2/0, 주기 20 ms
```

### PWM 보정값

`rhphumanoid.ros2_control.xacro`의 `head_hardware` 파라미터. 서보마다 중립 위치가 달라 축별로 따로 둔다.

| 축 | 최소 duty | 중립(0 rad) | 최대 duty |
|---|---|---|---|
| pan | 600,000 ns | 1,600,000 ns | 2,600,000 ns |
| tilt | 400,000 ns | 1,400,000 ns | 2,400,000 ns |

- `use_mock`은 `use_gazebo` 값을 따름 → Gazebo에서는 PWM 장치를 열지 않음
- 하드웨어 플러그인 구조 → [Hardware Plugin](../hw/interface.md)

### 머리만 테스트

22축 몸체 없이 머리 2축만 띄울 때:

```bash
ros2 launch rhphumanoid_bringup rhphumanoid_bringup.launch.py head_only:=true
```

- `joint_state_broadcaster` · `head_controller`만 spawn (arm · leg 컨트롤러 생략)
- 카메라 노드 · `image_flipper`도 같이 실행됨

### 머리 동작 노드

`rhphumanoid_head_controller` — 팔 동작 노드(`arm_controller`)와 같은 방식으로 `FollowJointTrajectory` 액션을 보낸다.

| 함수 | 동작 |
|---|---|
| `look_at(pan, tilt)` | 지정 각도로 0.8 s 동안 이동 |
| `center()` | 정면 (0, 0) |
| `scan_horizontal()` | 왼쪽 0.8 rad → 정면 → 오른쪽 −0.8 rad → 정면 |
| `scan_vertical()` | 위 −0.4 rad → 정면 → 아래 0.4 rad → 정면 |

```bash
ros2 run rhphumanoid_head_controller head_controller   # 기본 시나리오: center → scan_horizontal → center
```

- 자세 · 시퀀스는 `head_definitions.hpp`에 `{ [pan, tilt], 이동 시간, 정지 시간 }`로 정의
- 목표물 탐색(좌우 스캔), 거리 추정용 pitch 조정에 사용

## 4. 카메라 좌표계 (URDF)

`rhphumanoid.structure.head.xacro`

```text
head_pan_link ─ head_tilt ─ head_tilt_link ─┬─ cam (fixed)        ─ cam_link
                                            └─ cam_gazebo (fixed) ─ cam_gazebo_link
```

| 링크 | 위치 (head_tilt_link 기준) | 회전 (rpy) | 용도 |
|---|---|---|---|
| `cam_link` | (0.040, −0.015, 0.027) m | (−π/2, 0, −π/2) | 광학 좌표계 (z 앞, x 오른쪽, y 아래) — 인식 좌표 변환용 |
| `cam_gazebo_link` | 같음 | (0, 0, 0) | Gazebo 카메라 센서 (x 앞) |

- Gazebo 카메라는 x축 방향을 보고, 영상 처리는 광학 좌표계(z 앞)를 쓰므로 링크를 둘로 나눔
- 카메라 3D 좌표 → 로봇 좌표 변환(Phase 4)은 이 TF 체인을 이용

## 5. Gazebo 카메라 { #gazebo }

`rhphumanoid.gazebo.xacro`의 카메라 센서를 `ros_gz_bridge`로 ROS 토픽에 연결한다.

| 항목 | 값 |
|---|---|
| 해상도 | 320 × 200 |
| 수평 화각 | 1.0123 rad (약 58°) |
| 갱신 | 30 Hz |
| 토픽 | `camera/image_raw` · `camera/camera_info` → **`/usb_cam/...`로 remap** |

```python
bridge = Node(
    package='ros_gz_bridge',
    executable='parameter_bridge',
    arguments=[
        '/clock@rosgraph_msgs/msg/Clock[ignition.msgs.Clock',
        '/camera/image_raw@sensor_msgs/msg/Image[ignition.msgs.Image',
        '/camera/camera_info@sensor_msgs/msg/CameraInfo[ignition.msgs.CameraInfo'
    ],
    remappings=[
        ('/camera/image_raw', '/usb_cam/image_raw'),
        ('/camera/camera_info', '/usb_cam/camera_info')
    ],
    condition=IfCondition(use_sim)
)
```

- 실물과 토픽 이름이 다름 (→ [토픽](#topics) 표) — 인식 노드를 양쪽에서 쓰려면 구독 토픽을 remap
- 해상도도 실물(640 × 480)과 다름 → 픽셀 단위 임계값(면적 등)은 해상도에 맞춰 조정

## 트러블슈팅 { #troubleshooting }

### 영상 끊김 (프레임 드랍)

증상: 카메라는 30 fps로 찍는데 수신 측(`ros2 topic hz`)은 3~4 fps, Docker 안에서는 1 fps 미만.

| 원인 | 확인 | 해결 |
|---|---|---|
| **DDS 수신 버퍼 부족** — 640 × 480 RGB 한 장이 약 0.92 MB. CycloneDDS는 UDP 패킷으로 쪼개 보내는데, OS 수신 버퍼가 차면 패킷이 버려지고 패킷 하나만 잃어도 프레임 전체를 버림 | `ros2 topic hz /image_raw` | 아래 `sysctl`로 버퍼 확대 |
| **YUYV 전송량** — 비압축 포맷은 USB · 네트워크 부담이 큼 | 포맷 확인: `v4l2-ctl --list-formats-ext` | `pixel_format: mjpeg2rgb` (현재 설정) |
| **자동 노출** — 웹캠은 어두우면 노출 시간을 늘리려고 스스로 fps를 5~10으로 낮춤 | 밝은 조명을 비추고 fps가 오르는지 확인 | 파라미터 `autoexposure: False`, `exposure` 수동 지정 (범위는 카메라마다 다름) |

```bash
# 호스트 Ubuntu에서 실행 (Docker 안이 아님)
sudo sysctl -w net.core.rmem_max=2147483647
sudo sysctl -w net.core.rmem_default=2147483647
sudo sysctl -w net.core.wmem_max=2147483647
sudo sysctl -w net.core.wmem_default=2147483647
```

- `sysctl -w`는 재부팅하면 초기화 → 유지하려면 같은 값을 `/etc/sysctl.conf`에 등록
- Docker 개발 환경은 `--net=host`, `--ipc=host`를 주면 네트워크 가상화로 인한 병목은 없음
