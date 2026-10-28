/* ENTER 홈 — POETIC 인트로. poetic.com 실제 구현 분석값 기준(기획서/클로드코드_홈_POETIC_지시서.md §3).
   A/B 비교 후 A안(로고 opacity 페이드 + 커서 바)으로 확정.
   <head>의 동기 인라인 스크립트가 html.intro-pending을 붙였을 때만 동작한다.
   GSAP이 없거나 실패하면 즉시 레이어 없이 홈이 바로 보이게 한다 — 인트로는
   항상 "없어도 되는" 장식이다. */
(function () {
  'use strict';

  function unlockAndReveal() {
    document.documentElement.classList.remove('intro-pending');
    var root = document.getElementById('introRoot');
    if (root && root.parentNode) root.parentNode.removeChild(root);
  }

  if (!document.documentElement.classList.contains('intro-pending')) return;

  if (typeof gsap === 'undefined') {
    unlockAndReveal();
    return;
  }

  try {
    var cfg = window.__introConfig || {};
    var WORD = cfg.wordmark || 'ENTER';
    var SUBTITLE = cfg.subtitle || '';
    var SKIP_LABEL = cfg.skipLabel || '건너뛰기 →';

    var root = document.createElement('div');
    root.id = 'introRoot';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="intro-color intro-color--3"></div>' +
      '<div class="intro-color intro-color--2"></div>' +
      '<div class="intro-color intro-color--1"></div>' +
      '<div class="intro-black">' +
        '<div class="intro-stack">' +
          '<div class="intro-logo-outer">' +
            '<div class="intro-cursor"></div>' +
            '<div class="intro-logo-box"><img class="intro-logo-svg" src="static/brand/enter-wordmark-dark.svg" alt="' + WORD + '"></div>' +
          '</div>' +
          '<div class="intro-subtitle">' + SUBTITLE + '</div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="intro-skip">' + SKIP_LABEL + '</button>';
    document.body.appendChild(root);

    var color3 = root.querySelector('.intro-color--3');
    var color2 = root.querySelector('.intro-color--2');
    var color1 = root.querySelector('.intro-color--1');
    var black = root.querySelector('.intro-black');
    var cursor = root.querySelector('.intro-cursor');
    var logoSvg = root.querySelector('.intro-logo-svg');
    var subtitle = root.querySelector('.intro-subtitle');
    var headlineSpans = document.querySelectorAll('.hp-hero .hp-display-xl span');

    // ---- 안전장치: 4초 강제 종료 / 완료 처리 ----
    var finished = false;
    var hardTimeoutId = null;
    function finishIntro() {
      if (finished) return;
      finished = true;
      if (hardTimeoutId) clearTimeout(hardTimeoutId);
      removeSkipListeners();
      try { localStorage.setItem('enter_intro_seen', String(Date.now())); } catch (e) {}
      unlockAndReveal();
    }
    hardTimeoutId = setTimeout(finishIntro, 4000);

    // ---- 건너뛰기: 클릭/휠/터치/키 입력 시 즉시 와이프 단계(1.5s)로 점프 ----
    var skipped = false;
    function skipToWipe() {
      if (skipped || finished) return;
      skipped = true;
      tl.seek(1.5);
      removeSkipListeners();
    }
    function removeSkipListeners() {
      window.removeEventListener('click', skipToWipe);
      window.removeEventListener('wheel', skipToWipe);
      window.removeEventListener('touchstart', skipToWipe);
      window.removeEventListener('keydown', skipToWipe);
    }
    window.addEventListener('click', skipToWipe);
    window.addEventListener('wheel', skipToWipe, { passive: true });
    window.addEventListener('touchstart', skipToWipe, { passive: true });
    window.addEventListener('keydown', skipToWipe);

    // ---- 타임라인 ----
    var tl = gsap.timeline({ onComplete: finishIntro });

    // 0.5s~1.2s 로고 등장: opacity 0->1, 1s 애니메이션의 70% 지점(=0.7s)에 완전히 보임
    tl.fromTo(logoSvg, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'none' }, 0.5);

    // 커서 바: 로고 왼쪽 밖(-56px)에서 로고 오른쪽 끝(로고폭, SVG 비율 기준 239px)까지, 1s의 앞 50% 구간
    tl.set(cursor, { x: 0, opacity: 0 }, 0.5);
    tl.to(cursor, { opacity: 1, duration: 0.5 * 0.12, ease: 'none' }, 0.5); // 시작 12% 지점까지 페이드인
    tl.to(cursor, { x: 239, duration: 0.5, ease: 'cubic-bezier(0.4,0,0.2,1)' }, 0.5);

    // 부제: 커서가 로고 끝에 도착해 깜빡이기 시작할 때(1.0s) 아래에서 6px 올라오며 페이드인
    if (subtitle && SUBTITLE) {
      tl.fromTo(subtitle, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power1.out' }, 1.0);
    }

    // 커서 깜빡임: 도착 후(1.0s) 남은 구간(~1.5s)에서 2~3회, 각 약 2.5% 구간
    var blinkDur = 1 * 0.025;
    [1.15, 1.3, 1.45].forEach(function (bt) {
      tl.to(cursor, { opacity: 0, duration: blinkDur, ease: 'none' }, bt);
      tl.to(cursor, { opacity: 1, duration: blinkDur, ease: 'none' }, bt + blinkDur);
    });

    // 1.5s 와이프 시작: 검은 커버 + 색 커버 3장(80/160/240ms 지연)
    tl.to(black, { xPercent: 100, duration: 0.72, ease: 'cubic-bezier(0.7,0,0.3,1)' }, 1.5);
    tl.to(color1, { xPercent: 100, duration: 0.72, ease: 'cubic-bezier(0.7,0,0.3,1)' }, 1.5 + 0.08);
    tl.to(color2, { xPercent: 100, duration: 0.72, ease: 'cubic-bezier(0.7,0,0.3,1)' }, 1.5 + 0.16);
    tl.to(color3, { xPercent: 100, duration: 0.72, ease: 'cubic-bezier(0.7,0,0.3,1)' }, 1.5 + 0.24);

    // 1.76s 히어로 헤드라인 등장 (한 줄씩, y 24px->0, 0.6s)
    if (headlineSpans.length) {
      tl.fromTo(headlineSpans, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' }, 1.76);
    }

  } catch (err) {
    unlockAndReveal();
  }
})();

/* 헤더 로고 호버: 이제 SVG 워드마크라 Letter Swap은 빼고, 초록 문짝이 살짝 더
   열리는 효과(0.3s)를 CSS만으로 처리한다 — static/home-poetic.css의
   .hp-brand:hover .hp-brand-door-leaf 참고. */
