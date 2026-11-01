# High Level Control

!!! abstract "요약"
    - 머리 카메라 영상으로 **목표물의 위치 · 거리를 구해 미션 동작을 결정하는** 계층
    - 카메라: USB 웹캠 1개, 머리 2축(pan · tilt) 위에 장착
    - 인식: **색상 필터링** 기반 — 경기장 목표물(허들 · 공 · 골대)이 색으로 구분됨
    - 현재: 카메라 구동 · 영상 회전 구현, 인식은 카메라 좌표계 3D 좌표 산출까지 진행. 로봇 좌표계 변환 · 필터링은 미구현

## 구조

```text
USB 웹캠 (머리, 거꾸로 장착)
   │ /image_raw                    640 × 480, MJPEG → RGB
   ▼
image_flipper                      180° 회전
   │ /image_flipped/compressed
   ▼
목표물 인식 (Object Detection)     색상 마스크 → 중심 · 크기 → 거리 → 3D 좌표
   │ 위치 오차 ΔX · ΔY · Δθ
   ▼
Task Generation                    정밀 정렬 → 동작 실행 (보행 · 키프레임)

head_controller ── pan · tilt ──▶ 시야 확보 · 탐색 (좌우 · 상하 스캔)
```

| 페이지 | 내용 |
|---|---|
| [Camera Setup](camera.md) | 카메라 노드 · 영상 회전 · 머리 2축 · Gazebo 카메라 · 프레임 드랍 해결 |
| [Object Detection](detection.md) | 색상 필터링 인식 단계, 거리 추정, 정렬 오차 계산 |

인식 결과를 쓰는 미션 로직 → [Task Generation](../task/index.md)

## 카메라 구성 선정

기존 대회(임베디드 소프트웨어 경진대회) 수상 팀 보고서를 분석해 정한 구성이다.

| 항목 | 일반적인 구성 | 이 로봇 |
|---|---|---|
| 카메라 | CSI 카메라 (예: Arducam IMX219). USB 웹캠은 CSI보다 지연이 김 | **USB 웹캠** — 로봇에서 쓸 수 있는 포트가 USB뿐 |
| 자유도 | 2자유도 (pitch · yaw) | **2자유도** (`head_tilt` · `head_pan`) |
| 인식 | 색상 필터링 | 색상 필터링 |
| 거리 추정 | Bounding Box 크기, 또는 카메라 pitch + 픽셀 위치 | → [Object Detection](detection.md#distance) |

- **Pitch**: 거리 측정과 바닥 시야 확보에 사실상 필수
- **Yaw**: 없으면 목표물을 찾을 때 몸 전체를 돌려야 함 → 효율 · 안정성 저하

## 진행 단계 { #phases }

| 단계 | 내용 | 상태 |
|---|---|---|
| Phase 0 | 색상 마스킹으로 물체의 중심 · 크기 인식 | ✅ |
| Phase 1 | 카메라 캘리브레이션 · 내부 파라미터(intrinsics) 확보 | ✅ |
| Phase 2 | 거리 추정 (depth estimation) | ✅ |
| Phase 3 | 카메라 좌표계 기준 3D 좌표 산출 | ✅ |
| Phase 4 | 로봇 좌표계로 좌표 변환 | ⬜ |
| Phase 5 | 상태 추정 · 필터링 (센서 노이즈 · 프레임 드랍 대비) | ⬜ |

- 허들 인식 결과로 상하좌우 이동 · 좌우 회전 동작을 고르는 스켈레톤 코드 작성 단계
- rqt 데이터 시각화 · 동작 검증은 미진행

!!! note "인식 코드 위치"
    launch 파일이 실행하는 `rhphumanoid_vision` 패키지(`image_flipper`)와 Phase 0~3 인식 코드는 GitHub 저장소에 아직 올라와 있지 않다.
    이 섹션의 인식 내용은 설계 · 작업 기록 기준이다.
