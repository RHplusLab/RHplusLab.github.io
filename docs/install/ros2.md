# Ubuntu & ROS2

!!! abstract "요약"
    - 개발 PC: Ubuntu 22.04 듀얼 부팅 → 기본 설정 → ROS 2 Humble → CycloneDDS · ros2_control · Gazebo → MoveIt 2 · MTC
    - Jetson Orin Nano: SDK Manager로 JetPack 6 설치 (Ubuntu 22.04 포함) → 원격 접속 → ROS 2 Humble
    - 순서대로 따라 하면 [Workspace Setup](workspace.md)으로 이어진다

## 1. Ubuntu 22.04 설치 { #ubuntu }

### 파티션 (Windows 듀얼 부팅)

| 파티션 | 크기 | 용도 |
|---|---|---|
| swap | 64 GB | swap area |
| EFI | 512 MB | EFI System Partition |
| `/` | 나머지 | Ext4 journaling file system |

!!! danger "Ubuntu만 다시 설치할 때"
    - **기존 Ubuntu 파티션(ext4)만 포맷**, 마운트 위치 `/`
    - EFI 파티션은 용도만 *EFI System Partition*으로 지정하고 **포맷 체크 해제** — 체크하면 Windows 부팅 파일이 지워진다
    - 부트로더 설치 위치: 파티션이 아니라 **디스크 전체** (예: `/dev/nvme1n1`) → 설치 프로그램이 EFI 파티션에 GRUB을 넣는다

### 기본 설정

| 항목 | 명령 · 방법 |
|---|---|
| 한글 입력 | `sudo apt install fcitx5 fcitx5-hangul` → 입력기를 fcitx5로, 두벌식 ([설정 방법](https://osg.kr/archives/913)) |
| 부팅 순서 · 대기 시간 | `sudo nano /etc/default/grub` → `sudo update-grub` → `sudo reboot` |
| 듀얼 부팅 시간 어긋남 | `timedatectl set-local-rtc 1 --adjust-system-clock` |
| 터미널 · 편집기 | `sudo apt install terminator gedit` |
| VS Code | [code.visualstudio.com](https://code.visualstudio.com/)에서 `.deb` 받아 `sudo dpkg -i <파일>.deb` |
| 화면 자동 꺼짐 | Settings › Power에서 끄기 |
| 원격 데스크톱 | [NoMachine](https://www.nomachine.com/) — PC는 Linux DEB (amd64) |

## 2. ROS 2 Humble { #ros2 }

### 설치

[공식 설치 문서 (deb)](https://docs.ros.org/en/humble/Installation/Ubuntu-Install-Debs.html) 그대로 따른다.

```bash
# locale (UTF-8 확인)
sudo apt update && sudo apt install locales
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8

# 저장소
sudo apt install software-properties-common
sudo add-apt-repository universe
sudo apt update && sudo apt install curl -y
export ROS_APT_SOURCE_VERSION=$(curl -s https://api.github.com/repos/ros-infrastructure/ros-apt-source/releases/latest | grep -F "tag_name" | awk -F'"' '{print $4}')
curl -L -o /tmp/ros2-apt-source.deb "https://github.com/ros-infrastructure/ros-apt-source/releases/download/${ROS_APT_SOURCE_VERSION}/ros2-apt-source_${ROS_APT_SOURCE_VERSION}.$(. /etc/os-release && echo ${UBUNTU_CODENAME:-${VERSION_CODENAME}})_all.deb"
sudo dpkg -i /tmp/ros2-apt-source.deb

# ROS 2 + 개발 도구
sudo apt update && sudo apt upgrade
sudo apt install ros-humble-desktop ros-dev-tools
```

- 한국어 정리본: [오로카 ROS 2 개발환경 구축](https://cafe.naver.com/openrt/25288)
- 통신 확인 → [Installation › 설치 확인](index.md#check)

### 추가 패키지

```bash
# DDS: CycloneDDS (환경 변수는 Workspace Setup의 .bashrc에서)
sudo apt install ros-humble-rmw-cyclonedds-cpp

# ros2_control
sudo apt install ros-humble-ros2-control ros-humble-ros2-controllers

# Gazebo 연동
sudo apt install ros-humble-ros-gz-sim ros-humble-ros-gz
sudo apt install ros-humble-ign-ros2-control ros-humble-gz-ros2-control

# 카메라
sudo apt install ros-humble-camera-info-manager
```

| 패키지 | 용도 |
|---|---|
| `rmw_cyclonedds_cpp` | DDS 구현 교체 — 팀 전체 통일 |
| `ros2_control` · `ros2_controllers` | 하드웨어 플러그인 · `JointTrajectoryController` → [Hardware Interface](../hw/index.md) |
| `ros_gz` · `gz_ros2_control` | Gazebo 시뮬레이션에서 같은 컨트롤러 사용 |
| `camera_info_manager` | 카메라 노드 의존성 |

## 3. MoveIt 2 · MTC { #moveit }

7축 로봇팔 패키지에 필요하다. 휴머노이드만 쓸 때는 건너뛴다.

```bash
# MoveIt 2 (바이너리)
sudo apt install ros-humble-moveit*

# MoveIt Task Constructor (소스)
mkdir -p ~/ws_moveit2/src && cd ~/ws_moveit2/src
git clone https://github.com/ros-planning/moveit_task_constructor.git -b humble

# 빌드 도구 · colcon mixin
source /opt/ros/humble/setup.bash
sudo apt install python3-rosdep
sudo rosdep init
rosdep update
sudo apt update && sudo apt dist-upgrade
sudo apt install python3-colcon-common-extensions python3-colcon-mixin python3-vcstool
colcon mixin add default https://raw.githubusercontent.com/colcon/colcon-mixin-repository/master/index.yaml
colcon mixin update default
sudo apt install ros-humble-py-binding-tools

# 빌드
cd ~/ws_moveit2
colcon build --mixin release
```

- MTC 사용법 → [MoveIt Task Constructor](../arm/mtc.md)

## 4. Jetson Orin Nano { #jetson }

### JetPack 설치

| 단계 | 내용 |
|---|---|
| 1 | M.2 SSD 장착 (OS를 SSD에 설치) |
| 2 | Jetson을 **강제 복구 모드(Force Recovery Mode)**로 전원 ON → USB로 호스트 PC에 연결 |
| 3 | 호스트 PC(Ubuntu)의 [NVIDIA SDK Manager](https://developer.nvidia.com/sdk-manager)가 Jetson 인식 → JetPack 선택 → 저장 장치를 SSD로 지정해 Flash |
| 4 | 설치 중 사용자 계정 생성 |

- JetPack 6 = Ubuntu 22.04 기반 → ROS 2 Humble을 [2절](#ros2)과 같은 방법으로 설치
- Jetson의 영상 출력은 DisplayPort → 모니터 없이 진행하려면 아래 원격 접속 사용

### 원격 접속

USB 케이블로 연결하면 Jetson이 `192.168.55.1`로 잡힌다 (USB 장치 모드).

```bash
ssh <사용자 이름>@192.168.55.1
hostname -I        # Jetson에서 다른 네트워크 IP 확인
```

=== "NoMachine (사용)"

    ```bash
    # Jetson: 다운로드 페이지에서 Linux ARMv8 (arm64) DEB를 받아 설치
    sudo dpkg -i nomachine_<버전>_arm64.deb
    systemctl status nxserver

    # 모니터 없이(headless) 쓸 때
    sudo systemctl set-default multi-user.target
    sudo /usr/NX/bin/nxserver --restart
    ```

    - [NoMachine 다운로드 (Linux)](https://download.nomachine.com/download/?id=1&platform=linux) — Jetson은 ARMv8 DEB, PC는 DEB (amd64)
    - 접속 주소에 IP 대신 `<호스트네임>.local` 입력 가능 (예: `ubuntu.local`)

=== "xrdp + Remmina"

    ```bash
    # Jetson
    sudo apt install xrdp -y
    sudo systemctl enable xrdp && sudo systemctl restart xrdp

    # PC
    sudo apt install remmina remmina-plugin-vnc
    ```

    | 증상 | 해결 |
    |---|---|
    | 접속 직후 끊김 | `/etc/gdm3/custom.conf`에서 `WaylandEnable=false` |
    | "컬러 프로필 인증" 팝업 후 끊김 | `/etc/polkit-1/localauthority/50-local.d/45-allow-colord.pkla`에 colord 허용 규칙 추가 |
    | 보안 프로토콜 오류 | Remmina 고급 › 보안을 `RDP` · `TLS` · `NLA` 순으로 변경, 색 깊이 16bpp |
    | 바로 세션 종료 | `echo "exec startxfce4" > ~/.xsession` (xfce4 · xorgxrdp 설치 후) |

### 성능 모드

```bash
sudo jetson_clocks          # 클럭 최대 고정 (재부팅하면 해제)
```

- 전원 모드는 `MAXN SUPER`로 설정
- 상태 확인: `jtop` (`jetson-stats`). L4T 36.4에서 `Jetpack NOT DETECTED`가 떠도 `nvidia-jetpack`이 설치되어 있으면 표시 오류
- SSH 입력이 느린데 CPU · 메모리가 여유 있으면 기기가 아니라 네트워크 지연 쪽을 확인

### 시리얼 · PWM

- CH340 드라이버, `brltty` 제거, `/dev/ttyRHP` 고정 → [Hardware Plugin › 시리얼 포트](../hw/interface.md#serial-port)
- 머리 서보 PWM 핀 활성화 (`jetson-io`) → [Hardware Plugin › 머리 서보](../hw/interface.md#head-pwm)

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| 외장 SSD에 Ubuntu 설치 후 GRUB 설치 실패 | 설치 프로그램이 외장 SSD의 EFI가 아니라 **내장 Windows SSD의 EFI**를 `/boot/efi`로 마운트 | 아래 복구 절차 |
| `ch341-uart converter now disconnected` | `brltty`가 포트 점유 | `sudo apt-get remove brltty` |

??? example "외장 SSD GRUB 복구 (재설치 없이)"

    Ubuntu Live USB로 부팅한 뒤 실행. `<ROOT>` = 외장 SSD의 Ubuntu 파티션, `<EFI>` = 외장 SSD의 EFI 파티션 (`lsblk`로 확인)

    ```bash
    sudo mount <ROOT> /mnt
    sudo mount <EFI> /mnt/boot/efi
    for d in /dev /proc /sys; do sudo mount --bind $d /mnt$d; done
    sudo chroot /mnt

    grub-install --target=x86_64-efi --efi-directory=/boot/efi --removable --no-nvram
    update-grub
    exit
    ```

    - 재부팅 → 노트북 UEFI 부팅 메뉴에서 외장 SSD(`UEFI: <SSD 이름>`) 선택
    - `--removable`: 펌웨어 기본 경로에 설치, `--no-nvram`: 내장 디스크의 부팅 항목을 건드리지 않음
