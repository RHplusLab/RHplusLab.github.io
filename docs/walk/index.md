# Walking Pattern

!!! abstract "요약"
    - 소스: [`rhphumanoid_walking`](https://github.com/RHplusLab/RHp_humanoid_controller/tree/main/rhphumanoid_walking)
    - ROBOTIS OP3 `op3_walking_module`의 보행 알고리즘을 RH+ 링크 치수에 맞춰 재구현
    - **사인파 기반 open-loop 보행** — ZMP 계산 · IMU 피드백 없음. 안정성은 파라미터 튜닝으로 확보
    - 다리 12축만 제어. 한 보행 주기(600 ms, 30포인트)를 action goal 하나로 전송
    - 방향 명령 8종: 전진 · 후진 · 옆걸음 · 회전 · 제자리 · 정지

## 구조

```text
/walking/command  (std_msgs/String)          "forward", "turn_left", "stop" …
   │
   ▼
rhphumanoid_walking 노드
   │ 1. 사인파(wSin)로 발 끝점 궤적 계산       ← 보행 파라미터 (YAML)
   │ 2. 닫힌 형태 IK → 다리 관절각 12개
   │ 3. 20 ms 간격 30포인트를 goal 하나로 묶음
   ▼
/leg_controller/follow_joint_trajectory  (FollowJointTrajectory action)
   │ 결과 수신 → 다음 주기 계산 · 전송 (연속 보행)
   ▼
leg_controller (JointTrajectoryController) → 하드웨어 플러그인 → 서보
```

- `leg_controller` · 하드웨어 플러그인 → [Hardware Interface](../hw/index.md), [Hardware Plugin](../hw/interface.md)
- OP3 원본 모듈 비교 → [OP3 Reference](../hw/op3.md)

## 빠른 실행 (Gazebo)

```bash
# 1. 빌드
cd ~/robot_ws
colcon build --packages-select rhphumanoid_walking
source install/setup.bash

# 2. Gazebo + 컨트롤러 (약 5초)
ros2 launch rhphumanoid_bringup rhphumanoid_bringup.launch.py use_sim:=true

# 3. action 서버 확인 → /leg_controller/follow_joint_trajectory 가 보여야 함
ros2 action list

# 4. 보행 노드
ros2 launch rhphumanoid_walking walking.launch.py

# 5. 명령 (--once 필수: 빠지면 같은 명령이 반복 전송됨)
ros2 topic pub --once /walking/command std_msgs/msg/String "data: 'forward'"
ros2 topic pub --once /walking/command std_msgs/msg/String "data: 'stop'"
```

!!! note "`walking.launch.py`는 `use_sim_time: True` 고정"
    실제 로봇에서 실행할 때는 launch 파일의 `use_sim_time` 값을 확인한다.

## 명령

| 명령 | 동작 | 보폭 파라미터 |
|---|---|---|
| `forward` (= `start`) | 전진 | `x_move_amplitude` |
| `backward` | 후진 | `x_move_amplitude` (부호 반대) |
| `left` · `right` | 옆걸음 | `y_move_amplitude` |
| `turn_left` · `turn_right` | 제자리 회전 (반시계 · 시계) | `angle_move_amplitude` |
| `in_place` | 제자리 걸음 | — (보폭 0) |
| `stop` | 현재 주기를 마치고 정지 | — |

- 정지 상태에서 명령 → 차렷 자세(전 관절 0 rad)로 2초 동안 이동 → 명령 2.2초 뒤 첫 주기 시작
- 걷는 중 다른 방향 명령 → 멈추지 않고 **다음 phase부터** 방향 전환 ([Phase 갱신](sine.md#phase-update))
- `stop` 직후 방향 명령 → 정지 요청 취소, 계속 보행
- 알 수 없는 명령 → 경고 로그만 출력

## 진행 상태

| 항목 | 상태 |
|---|---|
| 사인파 궤적 · IK · action 연속 전송 | ✅ 구현 |
| 방향 명령 (앞 · 뒤 · 옆 · 회전) | ✅ Gazebo에서 동작 확인 |
| 실제 로봇 보행 | ⚠️ 파라미터 튜닝 중 |
| 센서 피드백 (IMU · 균형 제어) | ⬜ 없음 |

증상별 조정 방향 (실제 로봇 기록 + 패키지 README 튜닝 팁):

| 증상 | 조정 방향 |
|---|---|
| 앞으로 넘어짐 | `hip_pitch_offset` ↓ → `x_offset` 더 음수 → `x_move_amplitude` ↓ |
| 왼쪽으로 휨 | 하드웨어 점검 → `y_offset` 보정 |
| 옆으로 넘어짐 | `swing_right_left` ↑ → `pelvis_offset` ↑ |
| 좌우 진동이 큼 (뒤뚱거림) | `pelvis_offset` 과다 여부 확인 |
| 한 걸음마다 멈칫함 | `dsp_ratio` ↓, `period_time` ↓ |
| Gazebo에서 맞춘 값이 실제 로봇에서 더 불안정 | — |

- 파라미터별 의미 · 튜닝 순서 → [Sine-Based Walking › 보행 파라미터](sine.md#parameters)

## 향후 과제

현재 보행은 미리 계산한 궤적을 재생할 뿐, 로봇의 실제 기울기를 측정해 보정하지 않는다.
다음 단계 후보는 OP3 `op3_online_walking_module`처럼 **ZMP 기반 보행 패턴 생성(LIPM + preview control)과 IMU 균형 제어**를 붙이는 것이다. 참고 자료 → [References](refs.md)
