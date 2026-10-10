# Hardware Plugin

!!! abstract "요약"
    - 소스: [`rhphumanoid_hardware_interface`](https://github.com/RHplusLab/RHp_humanoid_resources/tree/main/rhphumanoid_hardware_interface)
    - 7축 로봇팔용 `rhparm_hardware_interface`에서 출발 — 같은 Hiwonder 서보라 **프로토콜 계층은 그대로**, 관절 구성과 통신 보드만 교체
    - 플러그인 2개: 몸체 22축(시리얼 버스) · 머리 2축(PWM)

## 구조

```text
controller_manager
   │ read() / write()                      50 Hz
   ▼
rhphumanoid_system.cpp     ros2_control 플러그인 (얇은 껍데기)
   │ getAllJointPositions / setAllJointPositions
   ▼
rhphumanoid.cpp            ID 매핑 · 단위 변환 · 통신 스레드
   │ getJointPosition / setJointPosition
   ▼
rhphumanoid_serial.cpp     /dev/ttyRHP, 115200 bps
serial_servo_bus.cpp       Hiwonder 버스 서보 프로토콜
```

| 파일 | 역할 | 수정 |
|---|---|---|
| `rhphumanoid_system.cpp` | `SystemInterface` 구현. `on_init`에서 URDF 관절 목록 · `initial_value` 읽기 | 거의 없음 |
| `rhphumanoid.cpp` | 관절 ↔ 모터 ID, rad ↔ 서보 단위, 전송 스레드 | **대부분 여기서** |
| `rhphumanoid_serial.cpp` | 포트 열기 · baud 설정 | 포트 · 속도 변경 시 |
| `serial_servo_bus.cpp` | 패킷 생성 (헤더 `0x55`, 체크섬), `MOVE_TIME_WRITE` · `POS_READ` 등 | 거의 없음 |
| `pwm_head_system.cpp` · `pwm_driver.cpp` | 머리 SG-90 플러그인 | — |
| `rhphumanoid_hardware.xml` | pluginlib 등록 (플러그인 2개) | — |

!!! note "write()는 바로 보내지 않는다"
    `write()`는 명령을 공유 맵에 저장만 한다. 시리얼 전송은 `rhphumanoid::Process()` 스레드가 자기 주기로 처리한다.
    → 시리얼 지연이 제어 루프를 막지 않음.

## 1. 개발 순서: 2축 → 22축

1. `rhparm_hardware_interface` 복사 → `rhptwo_hardware_interface` (2축)
    - 관절 수 · 이름 변경
    - 통신 보드 변경 시 프로토콜 확인
2. `ros2_control_demos` 예제 6 xacro에서 플러그인만 교체 → 실제 모터 2개 구동

    ```xml
    <hardware>
      <plugin>rhptwo_hardware/RHPTwoSystemHardware</plugin>
    </hardware>
    ```

3. 22축 매핑 추가 → 이름 일괄 변경 `two` → `humanoid` (대소문자 · 파일명 · 폴더명 포함)

## 2. 시리얼 포트

### CH340 드라이버 (Jetson)

- 노트북 Ubuntu: 기본 내장
- Jetson: 없을 수 있음 → [CH341SER](https://github.com/juliagoda/CH341SER) 빌드 (README 6단계는 `sudo make load`)

```bash
lsmod | grep ch34                                                    # 로드 확인
sudo cp ch34x.ko /lib/modules/$(uname -r)/kernel/drivers/usb/serial/ # 재부팅 후 유지
sudo depmod -a
ls -l /dev/ttyUSB*                                                   # 재연결 후 확인
```

### brltty 제거

- 증상: `dmesg`에 `ch341-uart converter now disconnected from ttyUSB0`
- 원인: 점자 디스플레이 서비스 `brltty`가 포트 점유

```bash
sudo apt-get remove brltty
```

### 포트 이름 고정 (udev)

- `/dev/ttyUSB0` 번호는 연결 순서에 따라 바뀐다.
- 코드는 **`/dev/ttyRHP`** 를 연다.
- `MODE="0666"`으로 권한까지 해결 → `chmod` 불필요

```bash
lsusb      # CH340 → 1a86:7523
echo 'SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="7523", SYMLINK+="ttyRHP", MODE="0666"' \
  | sudo tee /etc/udev/rules.d/99-rhphumanoid.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
# USB 재연결 후
ls -l /dev/ttyRHP      # /dev/ttyRHP -> ttyUSB0
```

## 3. 관절 매핑 · 단위 변환 { #unit-conversion }

```cpp
const JointLimit DEFAULT_LIMIT = {RAD_RANGE, 0, 1000, 500, 1};  // range_rad, min, max, mid, invert

const std::vector<std::pair<std::string, int>> joint_defs = {
  {"l_hip_yaw", 1},   {"l_hip_roll", 2},   {"l_hip_pitch", 3},
  {"l_knee", 4},      {"l_ank_pitch", 5},  {"l_ank_roll", 6},
  {"r_hip_yaw", 7},   {"r_hip_roll", 8},   {"r_hip_pitch", 9},
  {"r_knee", 10},     {"r_ank_pitch", 11}, {"r_ank_roll", 12},
  {"l_sho_pitch", 13},{"l_sho_roll", 14},  {"l_el", 15},
  {"l_wst", 16},      {"l_grp", 17},
  {"r_sho_pitch", 18},{"r_sho_roll", 19},  {"r_el", 20},
  {"r_wst", 21},      {"r_grp", 22}
};

for (const auto & [name, id] : joint_defs) {
  joint_name_map_[name] = id;
  JointLimit limit = DEFAULT_LIMIT;
  if (name == "r_wst") limit.invert_factor = -1;   // 조립 방향이 반대인 관절
  joint_range_limits_[name] = limit;
}
```

서보 규격: **0~1000 단위 = 240°**, 중앙 500

$$
\text{unit} = \frac{1000\,\theta\,k}{240° \cdot \pi/180} + 500
\qquad
\theta = \frac{(\text{unit} - 500)(240° \cdot \pi/180)\,k}{1000}
$$

- $k$ = `invert_factor` (±1). RViz와 실물 방향이 반대면 −1
- 1 unit ≈ 0.24° ≈ 0.0042 rad (로그의 `pos= 499, -0.004189`)

## 4. 전송 스레드 상수

```cpp
constexpr auto UPDATE_PERIOD_MOVING = 20ms;
constexpr auto UPDATE_PERIOD_IDLE   = 100ms;
constexpr int  IDLE_ENTRY_CNT       = 50;
constexpr int  FIRST_SET_MOVE_TIME  = 2000;
const std::string MANUAL_MODE_ENABLE_FILE = "/tmp/rhphumanoid_enable_manual_mode";
constexpr int  NUM_JOINTS = 22;
const std::string SERIAL_DEV = "/dev/ttyRHP";
```

| 상수 | 값 | 의미 |
|---|---|---|
| `UPDATE_PERIOD_MOVING` | 20 ms (50 Hz) | 명령 수신 중 전송 주기. controller_manager `update_rate`와 일치 |
| `UPDATE_PERIOD_IDLE` | 100 ms (10 Hz) | 명령 없을 때 주기 — 버스 점유 · CPU 부하 감소 |
| `IDLE_ENTRY_CNT` | 50 | 명령 없이 50주기 경과 시 idle 진입 |
| `FIRST_SET_MOVE_TIME` | 2000 ms | 첫 명령의 서보 이동 시간 — 전원 직후 급격한 동작 방지 |
| `MANUAL_MODE_ENABLE_FILE` | `/tmp/...` | 파일 존재 시 토크 해제 → 손으로 자세 조정. `touch`로 생성 |

## 5. 22축 안정화 포인트

### 위치 읽기는 초기 2초만

| | 로봇팔 코드 | 휴머노이드 |
|---|---|---|
| 위치 읽기 | 정지할 때마다 전 관절 | **활성화 후 2초만** (초기 자세 + 연결 확인) |
| `/joint_states` 값 | 서보 실측값 | **마지막 명령값** (오픈 루프) |

- 22축에서 주기적 읽기 → 명령 전송 지연, 제어 불능 발생
- 읽기 제거 후 해결

### 초기 자세 튐 (race condition)

- 증상: 첫 제어 명령 때 로봇이 전원 직후의 뒤틀린 자세로 돌아갔다가 튐
- 원인: 늦게 끝난 초기 읽기가 bringup이 보낸 최신 명령(0°)을 **과거 센서값으로 덮어씀**
- 해결: 읽기 완료 시점에 새 명령이 있으면 읽은 값 폐기

```cpp
readJointPositions(local_pos_map);
{
  std::lock_guard<std::mutex> guard(mutex_);
  if (!new_cmd_) {
    last_pos_get_map_ = local_pos_map;
  } else {
    RCLCPP_WARN(..., "Race condition detected! New command received during read. Discarding read result.");
  }
}
```

### 끊긴 모터 감지

- 초기 읽기에 응답 없는 모터 → ID 출력 후 **초기화 중단**
- 한 관절만 빠진 채 구동하면 낙상 · 기구 손상 위험

```text
[FATAL]: !!! MOTOR COMMUNICATION FAILURE DETECTED !!!
[FATAL]:   -> ID: 22 (r_grp)
[FATAL]:   -> ID: 21 (r_wst)
[FATAL]: System initialization ABORTED to prevent damage.
```

### 일부 모터 무반응

- **서보 전압 제한**: 기본 최대 12 V → Hiwonder 설정 프로그램(Windows)에서 **10~14 V**로 변경
- **개별 구동 테스트**: 같은 프로그램으로 1~22번을 하나씩 돌려 배선 · ID 문제를 코드 문제와 분리

## 6. 머리 서보 (PWM)

- 플러그인: `PWMHeadSystemHardware` (몸체와 별도)
- 방식: Jetson sysfs PWM `/sys/class/pwm/pwmchipN/pwm0`, 주기 20 ms
- `pwmchip` 번호는 Jetson 모델마다 다름 → `ls /sys/class/pwm` 확인, `jetson-io`로 PWM 핀 활성화

```xml
<ros2_control name="head_hardware" type="system">
  <hardware>
    <plugin>rhphumanoid_hardware/PWMHeadSystemHardware</plugin>
    <param name="pwm_chip_pan">pwmchip3</param>
    <param name="pwm_chip_tilt">pwmchip2</param>
    <param name="pwm_period_ns">20000000</param>
    <param name="pwm_min_duty_ns_pan">600000</param>
    <param name="pwm_neutral_duty_ns_pan">1600000</param>
    <param name="pwm_max_duty_ns_pan">2600000</param>
    <!-- tilt: 400000 / 1400000 / 2400000 -->
  </hardware>
</ros2_control>
```

- pan · tilt의 duty 범위가 서로 다름 → 서보 교체 시 재측정

### 부팅 후 권한

재부팅 시 PWM sysfs 권한이 root로 돌아가 bringup 실패 → udev 규칙으로 고정

```bash
sudo usermod -aG gpio $USER          # 1회, 재로그인
sudo nano /etc/udev/rules.d/99-pwm.rules
```

```text
SUBSYSTEM=="pwm", ACTION=="add", PROGRAM="/bin/sh -c 'chown -R root:gpio /sys/class/pwm && chmod -R 770 /sys/class/pwm'"
SUBSYSTEM=="pwm", ACTION=="change", PROGRAM="/bin/sh -c 'chown -R root:gpio /sys/class/pwm && chmod -R 770 /sys/class/pwm'"
```

```bash
sudo udevadm control --reload-rules && sudo udevadm trigger
```

- 부팅 후 규칙 적용까지 **20~30초** → 그 뒤 bringup 실행

## 7. 컨트롤러 · 명령 전송

??? example "rhphumanoid_bringup/config/rhphumanoid_controllers.yaml"

    ```yaml
    controller_manager:
      ros__parameters:
        update_rate: 50
        joint_state_broadcaster:
          type: joint_state_broadcaster/JointStateBroadcaster
        head_controller:
          type: joint_trajectory_controller/JointTrajectoryController
        arm_controller:
          type: joint_trajectory_controller/JointTrajectoryController
        leg_controller:
          type: joint_trajectory_controller/JointTrajectoryController

    leg_controller:
      ros__parameters:
        joints: [l_hip_yaw, l_hip_roll, l_hip_pitch, l_knee, l_ank_pitch, l_ank_roll,
                 r_hip_yaw, r_hip_roll, r_hip_pitch, r_knee, r_ank_pitch, r_ank_roll]
        command_interfaces: [position]
        state_interfaces: [position]
        allow_nonzero_velocity_at_trajectory_end: false
    # arm_controller (10), head_controller (2) 동일 형식
    ```

[`joint_trajectory_controller`](https://control.ros.org/humble/doc/ros2_controllers/joint_trajectory_controller/doc/userdoc.html)

- 입력: "어떤 관절을 · 언제(`time_from_start`) · 어느 위치로"가 적힌 궤적
- 동작: 시간표대로 하드웨어에 보간 명령 전달 → 미리 계산된 보행 시퀀스 재생에 적합

| 입력 | 이름 | 용도 |
|---|---|---|
| Action | `/leg_controller/follow_joint_trajectory` | 보행 노드 — 도착 결과를 받고 다음 동작으로 |
| Topic | `/leg_controller/joint_trajectory` | GUI — 결과 없이 계속 덮어쓰기 |

```cpp
auto goal = FollowJointTrajectory::Goal();
goal.trajectory.joint_names = joint_names_;           // 컨트롤러 관절 이름 그대로
trajectory_msgs::msg::JointTrajectoryPoint point;
point.positions = target_positions;                   // 12개, rad
point.time_from_start = rclcpp::Duration::from_seconds(move_time_sec);
goal.trajectory.points.push_back(point);
client_ptr_->async_send_goal(goal);
```

!!! warning "`Joints on incoming trajectory don't match the controller joints.`"
    `joint_names`가 비었거나 컨트롤러에 없는 이름일 때 발생.
    관절은 순서가 아닌 **이름**으로 지정한다.

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `St16invalid_argument ... stod` | `initial_value` 없는 관절에 `stod()` 호출 | 빈 값이면 0.0 사용 (현재 코드 반영) |
| `failed to initialize` → `Waiting for data on 'robot_description'` 반복 | 플러그인 초기화 실패 | 앞쪽 로그 확인. 패키지 단독 빌드 여부, `on_init` 파라미터명과 xacro 일치 확인 |
| `'HardwareComponentInterfaceParams' ... does not name a type` | Jazzy 최신 `on_init(params)` 시그니처를 Humble에서 빌드 | Humble: `on_init(const HardwareInfo &)`. Jazzy에서는 이 시그니처가 deprecated 경고만 |
| `package 'ros2_controllers_test_nodes' not found` | 테스트 노드 미설치 | `sudo apt install ros-humble-ros2-controllers-test-nodes` |
| 보드가 HID(`0483:5750`)로만 인식 | Bus Servo Controller | TTL/USB Debugging Board(CH340) 사용 |
| 포트 연결 직후 끊김 | `brltty` | `sudo apt-get remove brltty` |
| 프로세스 종료 후에도 토크 유지 | 서보는 마지막 위치 유지 | 전원 스위치 또는 manual mode 파일 |

## 다음

- 보행 시퀀스 → [Walking Pattern](../walk/index.md)
- 레퍼런스 구조 → [OP3 Reference](op3.md)
