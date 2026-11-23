/* 인터뷰캐러셀 지시서(2026-11-19) — 가운데 카드 캐러셀. 라이브러리 없이 바닐라 JS.
   무한 순환은 앞뒤 클론 방식으로 만든다: 실제 슬라이드 배열의 맨 앞에 마지막 카드의
   클론을, 맨 뒤에 첫 카드의 클론을 하나씩 심는다(물리 배열 [클론마지막, 실제0..N-1,
   클론첫번째]). 클론 쪽으로 넘어가는 전환은 평소처럼 애니메이션하고, 전환이 끝나는
   순간(transitionend)에만 transition을 끄고 진짜 슬라이드로 순간 이동한다 — 화면에는
   보이지 않는 점프라 "되감기"가 안 보인다. 클론은 aria-hidden이라 스크린리더·SEO에
   중복 텍스트로 잡히지 않는다. */
(function () {
  'use strict';

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var AUTOPLAY_MS = 5000;
  var SWIPE_THRESHOLD = 40;

  Array.prototype.slice.call(document.querySelectorAll('[data-voices-carousel]')).forEach(function (root) {
    var track = root.querySelector('[data-voices-track]');
    var realSlides = Array.prototype.slice.call(root.querySelectorAll('[data-voices-slide]'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-voices-dot]'));
    var prevBtn = root.querySelector('[data-voices-prev]');
    var nextBtn = root.querySelector('[data-voices-next]');
    var N = realSlides.length;
    if (!track || N < 2) return;

    var cloneFirst = realSlides[0].cloneNode(true);
    var cloneLast = realSlides[N - 1].cloneNode(true);
    cloneFirst.setAttribute('aria-hidden', 'true');
    cloneLast.setAttribute('aria-hidden', 'true');
    cloneFirst.removeAttribute('data-voices-slide');
    cloneLast.removeAttribute('data-voices-slide');
    track.insertBefore(cloneLast, realSlides[0]);
    track.appendChild(cloneFirst);

    var slides = Array.prototype.slice.call(track.children); // [cloneLast, real0..N-1, cloneFirst]
    var current = 1; // 물리 인덱스, 시작은 real0
    var timer = null;
    var hovering = false;
    var inView = true;
    var tabVisible = !document.hidden; // 성능(지시서 2026-11-23 §2-②-6) — 탭 숨김이면 정지

    function dotIndex() {
      return ((current - 1) % N + N) % N;
    }

    function render() {
      slides.forEach(function (slide, p) {
        var off = p - current;
        slide.style.setProperty('--i', off);
        slide.style.setProperty('--s', off === 0 ? 1 : .94);
        slide.classList.toggle('is-active', off === 0);
        slide.classList.toggle('is-near', Math.abs(off) === 1);
      });
      var di = dotIndex();
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === di); });
    }

    function setInstant(on) {
      slides.forEach(function (s) { s.style.transition = on ? 'none' : ''; });
      if (on) void track.offsetWidth; // 강제 리플로우로 transition:none을 확정시킨 뒤 되돌린다
    }

    function goTo(physicalIndex, instant) {
      if (instant) setInstant(true);
      current = physicalIndex;
      render();
      if (instant) {
        requestAnimationFrame(function () { setInstant(false); });
      }
    }

    function onSettle() {
      if (current === 0) { goTo(N, true); }
      else if (current === N + 1) { goTo(1, true); }
    }
    track.addEventListener('transitionend', function (e) {
      if (e.target.parentNode === track) onSettle();
    });

    function next() { goTo(current + 1, reduce); }
    function prev() { goTo(current - 1, reduce); }

    if (prevBtn) prevBtn.addEventListener('click', function () { stop(); prev(); play(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { stop(); next(); play(); });
    dots.forEach(function (d, i) {
      d.addEventListener('click', function () { stop(); goTo(i + 1, reduce); play(); });
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); prev(); play(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stop(); next(); play(); }
    });

    // 스와이프(터치) — 가로로 SWIPE_THRESHOLD 이상 밀면 다음/이전.
    var touchX = null;
    track.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (touchX == null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      stop();
      if (dx < 0) next(); else prev();
      play();
    }, { passive: true });

    function play() {
      if (reduce || hovering || !inView || !tabVisible) return;
      stop();
      timer = setInterval(next, AUTOPLAY_MS);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    root.addEventListener('mouseenter', function () { hovering = true; stop(); });
    root.addEventListener('mouseleave', function () { hovering = false; play(); });
    root.addEventListener('focusin', function () { hovering = true; stop(); });
    root.addEventListener('focusout', function () { hovering = false; play(); });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          inView = entry.isIntersecting;
          if (inView) play(); else stop();
        });
      }, { threshold: .2 });
      io.observe(root);
    }
    document.addEventListener('visibilitychange', function () {
      tabVisible = !document.hidden;
      if (tabVisible) play(); else stop();
    });

    render();
    play();
  });
})();
