# Installation

!!! abstract "요약"
    - 로봇(Jetson)과 개발용 PC 모두 **Ubuntu 22.04 + ROS 2 Humble**
    - DDS는 **CycloneDDS** (`RMW_IMPLEMENTATION=rmw_cyclonedds_cpp`)
    - 워크스페이스 `~/robot_ws`에 RH+ 리포 2개, MoveIt Task Constructor는 `~/ws_moveit2`에 소스 빌드

## 환경

| 구분 | 하드웨어 | OS | ROS 2 |
|---|---|---|---|
| 로봇 | NVIDIA Jetson Orin Nano (SSD 부팅) | JetPack 6 (L4T 36.4) = Ubuntu 22.04 | Humble |
| 개발 PC | x86_64 노트북 · 데스크톱 (Windows 듀얼 부팅) | Ubuntu 22.04 | Humble |
| 시뮬레이션 | 개발 PC | — | Gazebo (`ros_gz`) + `gz_ros2_control` |

!!! warning "PC · 로봇 ROS 2 배포판 통일"
    - 같은 네트워크에서 노드끼리 통신하려면 배포판을 통일한다. 로봇이 Humble이므로 PC도 Humble.
    - Jazzy용 코드는 Humble에서 빌드되지 않는 경우가 있다 (예: `hardware_interface`의 `on_init` 시그니처 → [Hardware Plugin › 트러블슈팅](../hw/interface.md#troubleshooting))
    - Ubuntu 24.04 + Jazzy도 같은 절차 — 명령의 `humble`을 `jazzy`로 바꾼다 (7축 로봇팔 초기 환경)

## 설치 순서

| 단계 | 내용 | 페이지 |
|---|---|---|
| 1 | Ubuntu 22.04 설치 (듀얼 부팅 파티션) · 기본 설정 | [Ubuntu & ROS2](ros2.md#ubuntu) |
| 2 | ROS 2 Humble · CycloneDDS · ros2_control · Gazebo | [Ubuntu & ROS2](ros2.md#ros2) |
| 3 | MoveIt 2 · MoveIt Task Constructor (로봇팔용) | [Ubuntu & ROS2](ros2.md#moveit) |
| 4 | Jetson Orin Nano: JetPack 설치 · 원격 접속 · 성능 모드 | [Ubuntu & ROS2](ros2.md#jetson) |
| 5 | `robot_ws` 생성 · 리포 clone · 의존성 · 빌드 | [Workspace Setup](workspace.md) |
| 6 | `.bashrc` 설정 · 실행 확인 | [Workspace Setup](workspace.md#bashrc) |

## 설치 확인 { #check }

```bash
# 1. 통신 (터미널 2개)
ros2 run demo_nodes_cpp talker
ros2 run demo_nodes_cpp listener

# 2. 휴머노이드 Gazebo
ros2 launch rhphumanoid_bringup rhphumanoid_bringup.launch.py use_sim:=true
```

- Gazebo에 로봇이 뜨고 `ros2 control list_controllers`에 컨트롤러가 `active`이면 완료
- 실제 로봇 실행 · 시리얼 포트 설정 → [Hardware Interface](../hw/index.md)
