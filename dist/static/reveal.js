/* ENTER 사이트 공통 — 조용한 스크롤 등장 연출(지시서 2026-11-12).
   [data-reveal] = 화면에 들어오면 0.6s에 걸쳐 살짝 떠오르며 opacity 0->1(한 번뿐, 다시 안 숨김).
   [data-count] = 화면에 들어오면 0부터 실제 값까지 1.2s easeOutCubic로 올라감(단위·쉼표 고정).
   하나의 IntersectionObserver로 둘 다 처리한다(rootMargin 0 0 -10% 0, 스크롤 리스너는 안 씀).

   같은 부모 밑에 나란히 있는 [data-reveal] 형제들은 0.06s씩 차례로 뜨되, 지연 합계는
   0.4s로 막는다(static/why.html 카드 3장, 서브페이지 근거 띠·카드·목록 행 등). [data-count]는
   가장 가까운 [data-reveal] 조상의 지연을 그대로 물려받아, 카드가 뜨는 순간 숫자도 같이
   올라가기 시작한다(독립적으로 또 지연 계산을 하지 않는다).

   why.html의 숫자 카드(4,000건 등)는 static/why-chart.js가 막대 차오름과 같은 타이밍에
   window.ENTER_REVEAL.startCount()를 직접 불러 맞춘다 — 그 요소들은 data-count-manual도
   같이 붙어 있어서 아래 자동 관찰 대상에서는 빠진다(중복 트리거 방지).

   안전장치: html.js-reveal이 있어야 숨김 스타일이 켜지므로(static/reveal.css), 이 스크립트가
   실패하거나 2초 안에 초기화를 못 마치면 전부 강제로 보이게 해서 내용이 숨겨진 채 남지 않는다. */
(function () {
  'use strict';

  var html = document.documentElement;
  var reduce = false;
  try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  var allCountEls = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));

  var SAFETY_MS = 2000;
  var STAGGER_STEP = 0.06;
  var STAGGER_MAX = 0.4;
  var COUNT_DURATION_MS = 1200;

  var safetyDone = false;
  var safetyTimer = setTimeout(forceRevealAll, SAFETY_MS);

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // "4,000건" -> {prefix:"", num:4000, suffix:"건"} — 템플릿/콘텐츠를 안 바꾸고
  // 이미 렌더링된 문자열에서 바로 숫자 부분만 떼어 쓴다.
  function parseCountText(text) {
    var m = text.match(/^(\D*)([\d][\d,]*)(.*)$/);
    if (!m) return null;
    var num = parseInt(m[2].replace(/,/g, ''), 10);
    if (isNaN(num)) return null;
    return { prefix: m[1], num: num, suffix: m[3] };
  }

  // [data-count] 요소를 "0"부터 보여줄 수 있게 준비 — 접근성: 바뀌는 숫자는 aria-hidden,
  // 바깥 요소(원래 data-count가 붙은 요소)에 최종 값을 aria-label로 남겨 스크린리더는
  // 최종 값만 읽는다.
  function prepareCountEl(el) {
    if (el.__revealCount) return el.__revealCount;
    var finalText = el.textContent;
    var parsed = parseCountText(finalText);
    if (!parsed) return null;
    var width = el.getBoundingClientRect().width;
    if (width > 0) el.style.minWidth = width + 'px';
    el.setAttribute('aria-label', finalText);
    el.innerHTML = '';
    var inner = document.createElement('span');
    inner.setAttribute('aria-hidden', 'true');
    inner.textContent = parsed.prefix + '0' + parsed.suffix;
    el.appendChild(inner);
    var state = { el: el, inner: inner, parsed: parsed, finalText: finalText, started: false, done: false };
    el.__revealCount = state;
    return state;
  }

  function setFinalCount(el) {
    var state = prepareCountEl(el);
    if (!state) return;
    state.inner.textContent = state.finalText; // 포맷 그대로(쉼표 포함) 최종 값
    state.started = true;
    state.done = true;
  }

  function startCount(el, delaySec) {
    var state = prepareCountEl(el);
    if (!state || state.started) return;
    state.started = true;
    var delayMs = Math.max(0, (delaySec || 0) * 1000);
    setTimeout(function () {
      var startTime = null;
      function tick(now) {
        if (startTime === null) startTime = now;
        var t = Math.min(1, (now - startTime) / COUNT_DURATION_MS);
        var eased = easeOutCubic(t);
        var val = Math.round(state.parsed.num * eased);
        state.inner.textContent = state.parsed.prefix + val.toLocaleString('ko-KR') + state.parsed.suffix;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          state.inner.textContent = state.finalText;
          state.done = true;
        }
      }
      requestAnimationFrame(tick);
    }, delayMs);
  }

  function forceRevealAll() {
    if (safetyDone) return;
    safetyDone = true;
    revealEls.forEach(function (el) { el.classList.add('is-revealed'); });
    allCountEls.forEach(function (el) {
      if (!el.hasAttribute('data-count-manual')) setFinalCount(el);
    });
  }

  if (reduce) {
    // 떠오르기 없이 바로 보이고, 숫자도 최종 값으로 바로 표시.
    revealEls.forEach(function (el) { el.classList.add('is-revealed'); });
    allCountEls.forEach(function (el) {
      if (!el.hasAttribute('data-count-manual')) setFinalCount(el);
    });
    clearTimeout(safetyTimer);
    safetyDone = true;
    // data-count-manual(왜 ENTER 숫자 카드)도 reduced-motion이면 즉시 최종 값으로 —
    // why-chart.js가 나중에 startCount를 불러도 이미 done인 상태라 애니메이션 없이 끝난다.
    allCountEls.forEach(function (el) { if (el.hasAttribute('data-count-manual')) setFinalCount(el); });
    window.ENTER_REVEAL = { startCount: function (el) { setFinalCount(el); } };
    return;
  }

  // 같은 부모 밑 [data-reveal] 형제 순서대로 0.06s씩(최대 0.4s) 지연을 미리 계산해 둔다.
  var siblingIndex = typeof WeakMap === 'function' ? new WeakMap() : null;
  function nextIndex(parent) {
    if (!siblingIndex || !parent) return 0;
    var n = siblingIndex.get(parent) || 0;
    siblingIndex.set(parent, n + 1);
    return n;
  }
  var delayByEl = siblingIndex ? new WeakMap() : null;
  revealEls.forEach(function (el) {
    var idx = nextIndex(el.parentElement);
    var delay = Math.min(idx * STAGGER_STEP, STAGGER_MAX);
    el.style.transitionDelay = delay.toFixed(2) + 's';
    if (delayByEl) delayByEl.set(el, delay);
  });

  function delayFor(el) {
    var node = el;
    while (node && node !== document.body) {
      if (node.hasAttribute && node.hasAttribute('data-reveal')) {
        return (delayByEl && delayByEl.get(node)) || 0;
      }
      node = node.parentElement;
    }
    return 0;
  }

  html.classList.add('js-reveal');

  var autoCountEls = allCountEls.filter(function (el) { return !el.hasAttribute('data-count-manual'); });
  autoCountEls.forEach(function (el) { prepareCountEl(el); });

  var hasIO = 'IntersectionObserver' in window;
  var observer = hasIO ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      observer.unobserve(el);
      if (el.hasAttribute('data-reveal')) el.classList.add('is-revealed');
      if (el.hasAttribute('data-count') && !el.hasAttribute('data-count-manual')) {
        startCount(el, delayFor(el));
      }
    });
  }, { rootMargin: '0px 0px -10% 0px' }) : null;

  function isInViewport(el) {
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }

  function setup(el) {
    if (!hasIO || isInViewport(el)) {
      if (el.hasAttribute('data-reveal')) el.classList.add('is-revealed');
      if (el.hasAttribute('data-count') && !el.hasAttribute('data-count-manual')) {
        startCount(el, delayFor(el));
      }
    } else {
      observer.observe(el);
    }
  }

  revealEls.forEach(setup);
  // data-reveal 없이 data-count만 붙은 요소(없을 수도 있지만 대비)는 따로 관찰.
  autoCountEls.forEach(function (el) { if (!el.hasAttribute('data-reveal')) setup(el); });

  safetyDone = true;
  clearTimeout(safetyTimer);

  // static/why-chart.js가 왜 ENTER 숫자 카드(data-count-manual)를 막대 차오름과
  // 같은 타이밍에 직접 불러 쓰는 공개 API.
  window.ENTER_REVEAL = {
    startCount: function (el, delaySec) { startCount(el, delaySec); }
  };
})();
