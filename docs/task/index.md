# Task Generation

!!! abstract "요약"
    - 휴머노이드가 경기장 미션을 수행하도록 **보행 · 미션 동작을 순서대로 엮는** 계층
    - 경기장 코스: 허들 → 농구 → 허들 → 축구
    - 현재: 키프레임 동작 시퀀스 구조까지 구현, 카메라 인식과의 연결은 기록 없음

## 경기장 코스

팀 자체 규정 (기존 대회 규정을 참고해 작성)

```text
 START → ① 허들 (5 cm) → ② 농구 → ③ 허들 (10 cm) → ④ 축구 → FINISH
```

| 미션 | 내용 | 점수 |
|---|---|---|
| ① · ③ 허들 | **전진 보행**으로 넘기. 넘어뜨리기 · 옆걸음으로 넘기 · 건너뛰기는 실격 | — |
| ② 농구 | 공 지지대(높이 3 cm) 위의 공(지름 7 cm 스펀지)을 집어 골대에 넣기. 방법 자유 | 골 +1 / 림 접촉 −1 |
| ④ 축구 | 공 지지대 위의 공을 드리블해 **하체로** 슛 | 골 +1 / 골대 접촉 · 상체로 공 접촉 −1 |

- 자율 주행, 경기 중 조작 · 접촉 금지, 제한 시간 10분
- 바닥 유도선(흰색 점선)을 따라 이동, 경로 이탈 시 종료
- 순위: 미션 점수(−2 ~ +2) → 총 이동 거리 → 시간
- 경기장 규격 · 제작 → [Arena Setup](../arena.md)

## 미션 동작 계획

| 미션 | 계획 |
|---|---|
| 축구 | 카메라로 공 위치 인식 → 골대 위치까지 인식 → 발로 차기 |
| 물체 이동 · 농구 | 카메라로 바닥의 물체 인식 → 집어서 목표 지점에 놓기 (팔 4축 + 그리퍼, MoveIt 적용 예정 → [7-DoF Manipulator](../arm/moveit2.md) 참고) |
| 투척 | 바닥의 공을 집어 던지기 (가능하면 방향까지 제어) |
| 전체 | 보행 · 미션 동작을 순서대로 배치하는 **동작 스케줄링** |

## 동작 시퀀스 구성

보행 · 미션 동작을 **키프레임 시퀀스**로 정의하고, 상위 노드가 필요한 시퀀스를 순서대로 호출하는 구조다.
[`rhphumanoid_walking_pattern`](https://github.com/RHplusLab/RHp_humanoid_controller/tree/main/rhphumanoid_walking_pattern)

```cpp
struct MotionStep {
  std::vector<double> positions;   // 관절 12개 목표 각도 (rad)
  double move_time;                // 도달 시간 (s)
  double stop_time;                // 도달 후 정지 시간 (s)
};

const std::vector<MotionStep> SEQ_WALK_FORWARD = {
  { POSE_LEFT_UP,  0.5, 0.1 },
  { POSE_STAND,    0.5, 0.1 },
  { POSE_RIGHT_UP, 0.5, 0.1 },
  { POSE_STAND,    0.5, 0.1 },
};
// SEQ_TURN_LEFT, SEQ_WALK_BACKWARD …
```

- 각 `MotionStep`을 `/leg_controller/follow_joint_trajectory` action goal 하나로 보내고, 결과를 받으면 다음 단계로 넘어간다.
- "앞으로 2번 → 왼쪽 3번"처럼 시퀀스를 이어 붙여 미션 경로를 만든다.
- 시퀀스 편집용 GUI(관절 슬라이더 → 장면 저장 → YAML 출력) 개발 중

## 진행 상태

| 단계 | 상태 |
|---|---|
| 22축 하드웨어 인터페이스 · 컨트롤러 | 완료 → [Hardware Interface](../hw/index.md) |
| 키프레임 보행 시퀀스 (전진 · 후진 · 회전) | 기본 동작 구현 |
| 사인파 기반 연속 보행 (OP3 이식) | 구현 → [Walking Pattern](../walk/index.md) |
| 카메라 인식 → 미션 동작 연결 | 기록 없음 |
