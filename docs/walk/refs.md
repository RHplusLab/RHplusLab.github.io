# References

!!! abstract "요약"
    - 현재 구현의 출처: ROBOTIS OP3 (`op3_walking_module` · `op3_kinematics_dynamics`)
    - 다음 단계(ZMP · LIPM · 균형 제어) 참고용 오픈소스 · 논문 목록

## ROBOTIS OP3

| 자료 | 참고 포인트 |
|---|---|
| [ROBOTIS-OP3](https://github.com/ROBOTIS-GIT/ROBOTIS-OP3) | `op3_walking_module`(사인파 보행) · `op3_kinematics_dynamics`(다리 IK) — **현재 구현의 원본** |
| [ROBOTIS-OP3 · `op3_online_walking_module`](https://github.com/ROBOTIS-GIT/ROBOTIS-OP3/tree/master/op3_online_walking_module) | LIPM + preview control, IMU 균형, 발자국 지정 |
| [ROBOTIS-OP3 · `op3_balance_control`](https://github.com/ROBOTIS-GIT/ROBOTIS-OP3/tree/master/op3_balance_control) | Damping · PD 제어로 기울기 → 관절각 보정 |
| [ROBOTIS-OP3-Common](https://github.com/ROBOTIS-GIT/ROBOTIS-OP3-Common) | URDF · 메시 · Gazebo 플러그인 |
| [ROBOTIS-OP3-Tools](https://github.com/ROBOTIS-GIT/ROBOTIS-OP3-Tools) | 보행 시작 · 정지 GUI, 관절 offset 튜닝 |
| [OP3 e-Manual](https://emanual.robotis.com/docs/en/platform/op3/introduction/) | 모듈 구조 · 튜토리얼 |

- RH+와의 구조 비교 → [OP3 Reference](../hw/op3.md)

## 보행 제어 오픈소스

| 자료 | 언어 | 참고 포인트 |
|---|---|---|
| [lipm_walking_controller](https://github.com/stephane-caron/lipm_walking_controller) · [튜닝 가이드](https://scaron.info/robotics/tuning-the-lipm-walking-controller.html) | C++ | LIPM 기반 보행 + 안정화. 발 힘/토크 센서 사용 |
| [ToddlerBot](https://github.com/hshi74/toddlerbot) | Python | 소형 휴머노이드. ZMP 보행 알고리즘 코드 포함 (주력은 강화학습) |
| [Berkeley Humanoid Lite](https://github.com/HybridRobotics/Berkeley-Humanoid-Lite) · [문서](https://berkeley-humanoid-lite.gitbook.io/docs/getting-started-with-software) | Python | 저가형 오픈소스 휴머노이드, 강화학습 기반 |
| [Pinocchio](https://github.com/stack-of-tasks/pinocchio) · [보행 패턴 예제](https://gepettoweb.laas.fr/doc/stack-of-tasks/pinocchio/master/doxygen-html/md_doc_d_practical_exercises_6_wpg.html) | C++ / Python | 강체 동역학 라이브러리. 보행 패턴 생성 실습 |

## 이론

- [DYROS — Humanoid review](http://dyros.snu.ac.kr/wp-content/uploads/2024/04/Humanoid_review.pdf) — LIPM 설명
- Kajita et al., [*Introduction to Humanoid Robotics*](https://link.springer.com/book/10.1007/978-3-642-54536-8), Springer — ZMP · 보행 패턴 생성 교재

## 논문 (RoMeLa, UCLA)

목록: [RoMeLa Publications](https://www.romela.org/publications/)

| 주제 | 논문 |
|---|---|
| 보행 · 균형 | Humanoid Locomotion on Uneven Terrain Using the Time-Varying Divergent Component of Motion (2014) |
| 보행 · 균형 | Compliant Locomotion Using Whole-Body Control and Divergent Component of Motion Tracking (2015) |
| 보행 · 균형 | Practical Bipedal Walking Control on Uneven Terrain Using Surface Learning and Push Recovery |
| 보행 · 균형 | Online Learning of a Full Body Push Recovery Controller for Omnidirectional Walking |
| 보행 · 균형 | Learning Full Body Push Recovery Control for Small Humanoid Robots |
| 동작 생성 | Walk-and-Kick Motion Generation for a General Purpose Full-Sized Humanoid Robot |
| 동작 생성 | Active Stabilization of a Humanoid Robot for Impact Motions with Unknown Reaction Forces |
| 플랫폼 | Modular Low-Cost Humanoid Platform for Disaster Response (THOR-OP, 2014) |
| 플랫폼 | Team THOR's Entry in the DARPA Robotics Challenge Finals 2015 |
| 플랫폼 | RoboCup 2015 Humanoid AdultSize League Winner |
