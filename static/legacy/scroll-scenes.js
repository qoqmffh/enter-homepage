/* ENTER 홈 — 스크롤 장면 (GSAP 3 + ScrollTrigger + Lenis, static/vendor에서 로드, CDN 없음)
   기본 철학은 이전 interactions.js와 같다: 모든 콘텐츠는 기본으로 "보임"이고,
   이 스크립트가 실제로 켜졌을 때만(.h-scene-ready 등 클래스로) 장면 연출이 더해진다.
   GSAP/ScrollTrigger/Lenis 중 하나라도 로드에 실패하면 아무 것도 하지 않고
   CSS 기본 상태(평범한 문서 흐름, 전부 보임)로 남는다.

   지금은 장면 ②(정산 장부)만 구현돼 있다. 나머지 장면은 뒤이어 추가된다. */
(function () {
  'use strict';

  // ---------- 모바일 하단 연락 바: 히어로를 지나면 등장 (기존 동작 유지) ----------
  // GSAP 로드 여부와 무관하게 동작해야 하므로 별도로 뗀다 — 여기서 실패하면
  // home.css가 .footerbar를 html.js 상태에서 숨겨 둔 채로 영영 안 나타나는
  // 회귀가 생기기 때문이다.
  (function setupFooterbar() {
    var footerbar = document.querySelector('.footerbar');
    var hero = document.getElementById('hero');
    if (!footerbar || !hero) return;
    function isInViewport(el) {
      var r = el.getBoundingClientRect();
      return r.top < (window.innerHeight || document.documentElement.clientHeight) && r.bottom > 0;
    }
    if (!('IntersectionObserver' in window)) {
      footerbar.classList.add('h-bar-visible');
      return;
    }
    footerbar.classList.toggle('h-bar-visible', !isInViewport(hero));
    var barIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        footerbar.classList.toggle('h-bar-visible', !entry.isIntersecting);
      });
    }, { threshold: 0 });
    barIo.observe(hero);
  })();

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' || typeof Lenis === 'undefined') {
    return;
  }

  gsap.registerPlugin(ScrollTrigger, window.SplitText ? SplitText : undefined);

  // ---------- Lenis ↔ ScrollTrigger 연동 ----------
  var lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);

  // ---------- 장면 ② 정산 장부 ----------
  function setupLedgerScene(isDesktop) {
    var section = document.querySelector('.h-scene-ledger');
    if (!section) return;
    var rows = Array.prototype.slice.call(section.querySelectorAll('.h-ledger-scene-row'));
    var totalRows = rows.length;
    if (!totalRows) return;

    var viewport = section.querySelector('.h-ledger-viewport');
    var table = section.querySelector('[data-scene-table]');
    var roundsEl = section.querySelector('[data-scene-rounds]');
    var fillEl = section.querySelector('[data-scene-progress-fill]');
    var overlayEl = section.querySelector('[data-scene-end-overlay]');
    var visibleCount = 10;

    // 행 높이는 한 번만 실측해서 쓴다(매 프레임 레이아웃을 읽지 않는다).
    var rowHeight = rows[0].getBoundingClientRect().height;
    viewport.style.height = (rowHeight * visibleCount) + 'px';

    section.classList.add('h-scene-ready');

    function stampPulse(index) {
      var stamp = rows[index] && rows[index].querySelector('.h-stamp-scene');
      if (!stamp) return;
      gsap.fromTo(stamp,
        { scale: 1.3, rotate: -6, opacity: 0 },
        { scale: 1, rotate: -4, opacity: 1, duration: 0.25, ease: 'back.out(2)' }
      );
    }

    var lastRevealed = 0;

    var st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=' + (isDesktop ? 250 : 130) + '%',
      pin: true,
      scrub: 1,
      onUpdate: function (self) {
        var p = self.progress;
        var revealed = Math.round(p * totalRows);

        if (revealed !== lastRevealed) {
          if (revealed > lastRevealed) {
            for (var i = lastRevealed; i < revealed; i++) stampPulse(i);
          }
          lastRevealed = revealed;
          roundsEl.textContent = revealed;
          rows.forEach(function (row, idx) {
            row.style.clipPath = idx < revealed ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)';
          });
          var overflowRows = Math.max(revealed - visibleCount, 0);
          gsap.set(table, { y: -overflowRows * rowHeight });
        }

        gsap.set(fillEl, { scaleX: p });
        var overlayP = gsap.utils.clamp(0, 1, (p - 0.92) / 0.08);
        gsap.set(overlayEl, { opacity: overlayP, scale: 0.96 + 0.04 * overlayP });
      }
    });

    return function cleanup() {
      st.kill();
      section.classList.remove('h-scene-ready');
      rows.forEach(function (row) { row.style.clipPath = ''; });
      gsap.set(table, { y: 0 });
      gsap.set(fillEl, { scaleX: 0 });
      gsap.set(overlayEl, { opacity: 0 });
    };
  }

  // ---------- 반응형 분기 ----------
  var mm = gsap.matchMedia();
  mm.add(
    {
      isDesktop: '(min-width: 1024px)',
      isMobile: '(max-width: 1023.98px)',
      reduceMotion: '(prefers-reduced-motion: reduce)'
    },
    function (context) {
      var conditions = context.conditions;
      if (conditions.reduceMotion) {
        // 아무 것도 하지 않는다 — CSS 기본 상태가 이미 "전부 보임, 애니메이션 없음"이다.
        return;
      }
      var cleanups = [];
      var c1 = setupLedgerScene(conditions.isDesktop);
      if (c1) cleanups.push(c1);

      return function () {
        cleanups.forEach(function (fn) { fn(); });
      };
    }
  );
})();
