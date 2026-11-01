# Workspace Setup

!!! abstract "요약"
    - 워크스페이스: `~/robot_ws` — [`RHp_humanoid_resources`](https://github.com/RHplusLab/RHp_humanoid_resources) + [`RHp_humanoid_controller`](https://github.com/RHplusLab/RHp_humanoid_controller)
    - 빌드: `colcon build --symlink-install` (YAML · launch 수정이 재빌드 없이 반영)
    - `.bashrc`: ROS 2 · 워크스페이스 source, CycloneDDS, 빌드 · 토픽 별칭

## 1. 리포 clone

```bash
mkdir -p ~/robot_ws/src && cd ~/robot_ws/src
git clone https://github.com/RHplusLab/RHp_humanoid_resources.git
git clone https://github.com/RHplusLab/RHp_humanoid_controller.git
```

| 리포 | 패키지 | 내용 |
|---|---|---|
| `RHp_humanoid_resources` | `rhphumanoid_description` · `bringup` · `gazebo` · `hardware_interface` | 로봇 모델 · 실행 · 시뮬레이션 · 하드웨어 플러그인 |
| `RHp_humanoid_controller` | `rhphumanoid_walking` · `walking_pattern` · `arm_controller` · `head_controller`, `scripts/` | 보행 · 동작 시퀀스 · 팔 · 머리 · GUI |

- 7축 로봇팔은 [`RHp_arm_resources`](https://github.com/RHplusLab/RHp_arm_resources) · [`RHp_arm_controller`](https://github.com/RHplusLab/RHp_arm_controller)를 같은 `src/`에 clone → [7-DoF Manipulator](../arm/index.md)

## 2. 의존성

`package.xml` · launch 파일 기준 목록. [Ubuntu & ROS2](ros2.md)의 패키지를 먼저 설치한다.

```bash
sudo apt install libhidapi-dev libyaml-cpp-dev
sudo apt install ros-humble-xacro ros-humble-joint-state-publisher-gui \
                 ros-humble-usb-cam ros-humble-cv-bridge
sudo apt install python3-pyqt5        # scripts/motor_control_gui.py
```

| 패키지 | 사용처 |
|---|---|
| `libhidapi-dev` | `rhphumanoid_hardware_interface` |
| `libyaml-cpp-dev` | `rhphumanoid_walking` (보행 파라미터 YAML) |
| `xacro` · `joint_state_publisher_gui` | `rhphumanoid_description` |
| `usb_cam` | `rhphumanoid_bringup` — 실제 로봇 카메라 |
| `cv_bridge` | `rhphumanoid_hardware_interface` |
| `python3-pyqt5` | 관절 슬라이더 GUI |

!!! tip "빠진 의존성 한 번에 설치"
    ```bash
    cd ~/robot_ws
    rosdep install --from-paths src --ignore-src -y
    ```
    `package.xml`에 적힌 의존성을 찾아 설치한다 ([rosdep 문서](https://docs.ros.org/en/humble/Tutorials/Intermediate/Rosdep.html)).

## 3. 빌드

```bash
cd ~/robot_ws
colcon build --symlink-install
source install/setup.bash
```

- `--symlink-install`: `install/`이 `src/`의 YAML · launch · Python 파일을 링크 → 수정 후 **노드 재시작만**으로 반영
- 일부만 빌드: `colcon build --symlink-install --packages-select <패키지>`
- 옵션 없이 빌드하면 `config/`가 `install/`로 복사됨 → `src/`만 고치면 반영되지 않음 ([Sine-Based Walking › 수정한 값 반영하기](../walk/sine.md#parameters))

## 4. .bashrc { #bashrc }

```bash
gedit ~/.bashrc     # 맨 아래에 추가
```

```bash
# ROS 2 · 워크스페이스
source /opt/ros/humble/setup.bash
source ~/robot_ws/install/local_setup.bash
source ~/ws_moveit2/install/local_setup.bash      # MTC를 설치한 경우

# colcon 자동완성 · colcon_cd
source /usr/share/colcon_argcomplete/hook/colcon-argcomplete.bash
source /usr/share/vcstool-completion/vcs.bash
source /usr/share/colcon_cd/function/colcon_cd.sh
export _colcon_cd_root=~/robot_ws

# 네트워크 · DDS
export ROS_DOMAIN_ID=7
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp

# 로그 형식
export RCUTILS_CONSOLE_OUTPUT_FORMAT='[{severity}]: {message}'
export RCUTILS_COLORIZED_OUTPUT=1
export RCUTILS_LOGGING_USE_STDOUT=0
export RCUTILS_LOGGING_BUFFERED_STREAM=1

# 별칭
alias cw='cd ~/robot_ws'
alias cs='cd ~/robot_ws/src'
alias ccd='colcon_cd'
alias cb='cd ~/robot_ws && colcon build --symlink-install'
alias cbp='colcon build --symlink-install --packages-select'
alias rt='ros2 topic list'
alias re='ros2 topic echo'
alias rn='ros2 node list'
alias killgazebo='killall -9 gazebo & killall -9 gzserver & killall -9 gzclient'
alias testpub='ros2 run demo_nodes_cpp talker'
alias testsub='ros2 run demo_nodes_cpp listener'
```

!!! warning "로봇 · PC `ROS_DOMAIN_ID` 일치"
    - 값이 다르면 서로의 토픽이 보이지 않는다. 같은 공간의 다른 팀과는 다른 값을 쓴다.
    - `RMW_IMPLEMENTATION`도 양쪽을 같게 둔다.

| 별칭 | 동작 |
|---|---|
| `cb` | 워크스페이스 전체 빌드 |
| `cbp <패키지>` | 패키지 하나만 빌드 |
| `cw` · `cs` · `ccd <패키지>` | 워크스페이스 · `src` · 패키지 폴더로 이동 |
| `testpub` · `testsub` | 통신 확인용 talker · listener |
| `killgazebo` | 남아 있는 Gazebo 프로세스 강제 종료 |

## 5. 실행 확인

```bash
# Gazebo
ros2 launch rhphumanoid_bringup rhphumanoid_bringup.launch.py use_sim:=true

# 실제 로봇 (Jetson) — 시리얼 포트 설정 후
ros2 launch rhphumanoid_bringup rhphumanoid_bringup.launch.py
```

- 실제 로봇 실행 전 준비 (CH340 · `/dev/ttyRHP` · PWM) → [Hardware Plugin](../hw/interface.md#serial-port)
- 실행 구성 차이 (`use_sim`) → [Hardware Interface › 실행](../hw/index.md)
- 다음 단계: [Walking Pattern](../walk/index.md) · [Task Generation](../task/index.md)
