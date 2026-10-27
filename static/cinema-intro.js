/* ENTER 홈 — 오프닝(1단계) + 건너뛰기 + 24시간 생략.
   <head>의 동기 인라인 스크립트가 이미 html.cinema-pending 여부를 정해 놨다.
   여기서는: (a) pending이 아니면 아무 것도 안 하고(바로 흰 화면 + 하단바 노출),
            (b) pending인데 라이브러리가 하나라도 없으면 즉시 안전하게 중단하고
                역시 바로 흰 화면으로 넘어간다. */
(function () {
  'use strict';

  var html = document.documentElement;
  var footerbar = document.querySelector('.footerbar');

  function showFooterbarNow() {
    if (footerbar) footerbar.classList.add('h-bar-visible');
  }

  function abortToPlainHome() {
    html.classList.remove('cinema-pending');
    showFooterbarNow();
  }

  if (!html.classList.contains('cinema-pending')) {
    // 오프닝을 안 보여주기로 이미 결정됨(24시간 이내 재방문 / reduced-motion) — 바로 하단바 노출.
    showFooterbarNow();
    return;
  }

  if (
    typeof gsap === 'undefined' ||
    typeof ScrollTrigger === 'undefined' ||
    typeof SplitText === 'undefined' ||
    typeof Flip === 'undefined' ||
    typeof Lenis === 'undefined'
  ) {
    abortToPlainHome();
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText, Flip);

  var stage = document.getElementById('cinemaStage');
  var wordmark = document.getElementById('cinemaWordmark');
  var skipBtn = document.getElementById('cinemaSkip');
  var cuts = Array.prototype.slice.call(document.querySelectorAll('.h-cinema-cut'));
  var header = document.querySelector('header.site');
  var brandEl = document.querySelector('header.site .brand');
  var navItems = Array.prototype.slice.call(document.querySelectorAll('header.site nav.site a'));
  var headlineLines = Array.prototype.slice.call(document.querySelectorAll('#scene-headline [data-line]'));

  if (!stage || !wordmark || !header || !brandEl || headlineLines.length === 0) {
    abortToPlainHome();
    return;
  }

  // ---------- Lenis: 오프닝 동안 스크롤 잠금 ----------
  var lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  function markIntroSeen() {
    try { localStorage.setItem('enter_intro_seen', String(Date.now())); } catch (e) {}
  }

  function finishIntro() {
    html.classList.remove('cinema-pending');
    markIntroSeen();
    showFooterbarNow();
    lenis.start();
  }

  // ---------- 타임라인 ----------
  var tl = gsap.timeline({ paused: true, onComplete: finishIntro });

  // 숫자 컷 — 0.4 / 1.2 / 2.0 / 2.8s에 등장, 마지막(금색)만 1.0s 머문다.
  var cutStarts = [0.4, 1.2, 2.0, 2.8];
  cuts.forEach(function (cutEl, i) {
    var t = cutStarts[i];
    var hold = (i === cuts.length - 1) ? 1.0 : 0.3;
    tl.to(cutEl, { opacity: 1, duration: 0.25, ease: 'power1.out' }, t);
    tl.to(cutEl, { opacity: 0, duration: 0.25, ease: 'power1.in' }, t + 0.25 + hold);
  });

  // 4.0s — ENTER 워드마크 등장
  tl.to(wordmark, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }, 4.0);

  // 4.6s — 막이 걷힘(스테이지 자체가 위로 빠진다)
  tl.to(stage, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, 4.6);

  // 5.0s — 워드마크가 헤더의 실제 로고 자리로 Flip, 헤더/내비 페이드인
  tl.add(function () {
    Flip.fit(wordmark, brandEl, {
      scale: true,
      duration: 0.5,
      ease: 'power3.inOut',
      onComplete: function () { wordmark.style.opacity = 0; }
    });
  }, 5.0);
  tl.to(header, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 5.0);
  if (navItems.length) {
    tl.from(navItems, { opacity: 0, duration: 0.3, stagger: 0.04, ease: 'power1.out' }, 5.15);
  }

  // 5.5s — 장면 1 헤드라인 2줄이 한 줄씩 아래에서 올라온다(SplitText, 글자 단위)
  var splits = headlineLines.map(function (line) {
    return new SplitText(line, { type: 'chars' });
  });
  splits.forEach(function (split, i) {
    tl.from(split.chars, {
      yPercent: 100,
      opacity: 0,
      duration: 0.5,
      stagger: 0.018,
      ease: 'power3.out'
    }, 5.5 + i * 0.25);
  });

  // ---------- 건너뛰기 ----------
  var skipped = false;
  function skipToCurtain() {
    if (skipped) return;
    skipped = true;
    if (tl.time() < 4.6) {
      tl.seek(4.6);
    }
    tl.play();
    window.removeEventListener('wheel', skipToCurtain);
    window.removeEventListener('touchstart', skipToCurtain);
    window.removeEventListener('keydown', skipToCurtain);
    window.removeEventListener('click', skipToCurtain);
  }
  skipBtn.addEventListener('click', skipToCurtain);
  window.addEventListener('wheel', skipToCurtain, { passive: true });
  window.addEventListener('touchstart', skipToCurtain, { passive: true });
  window.addEventListener('keydown', skipToCurtain);
  window.addEventListener('click', skipToCurtain);

  tl.play();
})();
