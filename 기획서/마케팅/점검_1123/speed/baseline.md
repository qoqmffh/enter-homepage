# 속도 개선 지시서(2026-11-23) §1 — 작업 전 기준선

측정일: 2026-11-23, §2(폰트/스크롤/TBT/번들/이미지) 작업을 시작하기 전,
§0-1(문구 반영) 배포 직후 상태에서 측정. 측정 환경:

- Lighthouse: Playwright가 내려받은 Chromium + `chrome-launcher`, `throttlingMethod:'simulate'`.
  모바일 = RTT 150ms·1638.4Kbps 다운로드·CPU 4배 저하. 데스크톱 = CPU 1배(저하 없음), 고대역폭.
  로컬에서 GitHub Pages의 확장자 없는 URL(`/slug`)을 그대로 재현하는 정적 서버로 `dist/`를 서빙.
- why 스크롤 fps: Playwright CDP `Emulation.setCPUThrottlingRate(4)` + `PerformanceObserver(longtask)`.

## 참고 — 지시서 §0에 적힌 "지난주" 수치와의 차이

지시서 §0에 적힌 기존 수치(예: why 스크롤 47fps, index TBT 607ms)는 이번에 쓴 것과는
다른 방식(Playwright CDP 트레이스 직접 측정 등)으로 잰 것으로 보이고, 이번 측정(Lighthouse
simulate + 짧은 합성 스크롤 스크립트)은 그보다 전반적으로 더 좋게 나왔다. 측정 방법이
다르면 숫자가 달라지는 게 당연하므로, 이 문서의 수치를 "그 전 세션의 숫자"가 아니라
"이번 작업 내 전/후 비교의 기준"으로만 쓴다 — §2 적용 후 같은 스크립트·같은 환경으로
다시 재서 이 문서와 직접 비교한다(§7 보고에 전/후 표로 들어감).

## Lighthouse (§2 작업 전)

| 페이지 | 기기 | Performance | FCP(ms) | LCP(ms) | TBT(ms) | CLS | 전송량(KB) | 요청수 |
|---|---|---|---|---|---|---|---|---|
| / | mobile | 97 | 2010 | 2010 | 98 | 0.001 | 1196 | 34 |
| / | desktop | 100 | 448 | 448 | 0 | 0.010 | 1229 | 35 |
| /why | mobile | 68 | 2856 | 5570 | 306 | 0.004 | 1477 | 48 |
| /why | desktop | 95 | 673 | 1392 | 65 | 0.004 | 1511 | 49 |
| /about | mobile | 74 | 2406 | 5898 | 148 | 0.001 | 826 | 32 |
| /about | desktop | 98 | 528 | 1185 | 0 | 0.001 | 860 | 33 |
| /stories | mobile | 76 | 2256 | 5564 | 137 | 0.000 | 903 | 36 |
| /stories | desktop | 98 | 486 | 1101 | 0 | 0.001 | 938 | 37 |
| /startup | mobile | 75 | 2106 | 5751 | 154 | 0.000 | 821 | 33 |
| /startup | desktop | 99 | 485 | 973 | 0 | 0.001 | 821 | 33 |
| /blog-wired-wholesale-checklist | mobile | 78 | 2406 | 2406 | 316 | 0.201 | 858 | 37 |
| /blog-wired-wholesale-checklist | desktop | 90 | 525 | 525 | 1 | 0.207 | 893 | 38 |
| /guide-store-setup | mobile | 90 | 2107 | 2107 | 328 | 0.003 | 690 | 31 |
| /guide-store-setup | desktop | 100 | 487 | 487 | 0 | 0.001 | 751 | 33 |

목표(지시서 §5): why·about·stories·blog·guide는 모바일 Perf≥90·LCP<2.5s·TBT<200ms·CLS<0.05,
index는 Perf≥85·TBT<300ms·CLS<0.05.

처음부터 눈에 띄는 것:
- **/why 모바일이 가장 나쁘다**(Perf 68, LCP 5.57s, TBT 306ms) — 폰트(92개 조각 파일,
  3.1MB) + 7개 개별 스크립트 태그가 가장 크게 걸리는 페이지라서 그렇다.
- **about/stories/startup도 LCP가 5.5~5.9초로 전부 나쁘다** — 같은 폰트 문제가 모든
  서브페이지에 공통으로 걸려 있다는 뜻.
- **blog-wired-wholesale-checklist만 CLS가 0.2대로 튄다** — 다른 페이지는 전부 0.01 미만인데
  이 글만 비정상적으로 높다. (원인은 §2 작업 중 확인 — 브레드크럼 마지막 항목이 글 제목
  그대로라 유난히 길어서, 폴백 폰트 때 2줄 → 본 폰트 때 1줄로 바뀌며 전체가 밀렸다.)
- guide-store-setup 모바일 TBT 328ms로 전체 중 가장 높다.

## why 스크롤 fps (§2 작업 전)

CPU 4배 저하, 6초간 측정, `PerformanceObserver({type:'longtask', buffered:true})`로
50ms 넘는 Long Task 집계.

| 시나리오 | 평균 fps | 측정 프레임 수 | 33ms 초과 프레임 | Long Task(>50ms) |
|---|---|---|---|---|
| 마우스 움직임 없음 | 60.0 | 362 | 0 | 0 |
| 마우스 움직임 있음(합성 스크롤+10회 move) | 59.3 | 358 | 4 | 0 |

목표(지시서 §5): 마우스 있음 기준 평균 ≥55fps, Long Task(>50ms) 0건 — **이 기준은 작업 전에도
이미 만족**하는 것으로 측정됐다. 다만 이 합성 스크립트는 스크롤 중 연속 마우스 이동을
성기게(6초간 10회) 흉내 낸 것이라 실제 사용자의 마우스 움직임(스크롤 내내 끊임없이 발생)보다
부하가 가볍다 — §2②(home-poetic-trail.js의 rect 캐시·rAF 배칭, why-carousels.js/
voices-carousel.js의 화면 밖 일시정지, 헤더 backdrop-filter 제거 등)는 그럼에도 불구하고
지시서가 지목한 구체적 원인들을 실제로 고쳤고, §5에서 같은 스크립트로 다시 재서 전/후를 비교한다.

## 헤더 블러(backdrop-filter) 전/후 스크린샷

- 전: `점검_1123/speed/header_blur/before.png`
- 후: `점검_1123/speed/header_blur/after.png`

(why 페이지, y=400 스크롤, 1440×90 클립. 전은 커밋 40e6e7e 당시의
`backdrop-filter:blur(8px)` + `rgba(255,255,250,.92)` 규칙을 현재 페이지에 주입해서 찍었다 —
레이아웃·콘텐츠는 지금 그대로 두고 헤더 배경 규칙 한 줄만 그때 값으로 되돌린 것.)
