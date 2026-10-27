/* Letter Swap — 기획서/참고_LetterSwap.tsx(Originkit, React+framer-motion) 재현.
   React 없이 GSAP으로: 글자마다 겹친 2칸(primary/secondary)을 두고,
   trigger 시 primary는 위로 빠지고(yPercent:-100) secondary는 아래(top:100%)에서
   0%로 올라와 자리를 잡는다. 공백은 셀은 만들되 애니메이션 순서에서 뺀다.
   의존성: GSAP(gsap 전역)만 있으면 된다. 이 파일 자체는 없어도 콘텐츠가
   깨지지 않도록, mount() 호출 전 원문 텍스트가 이미 DOM에 있다고 가정한다
   (호출부에서 처리). */
window.LetterSwap = (function () {
  'use strict';

  function shuffledIndexes(n) {
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(i);
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  var measureCtx = null;
  function measureWidth(host, text) {
    if (!text) return 0;
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    var cs = getComputedStyle(host);
    measureCtx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    return measureCtx.measureText(text).width;
  }

  function buildCells(host, fromText, toText) {
    host.innerHTML = '';
    var maxLen = Math.max(fromText.length, toText.length);
    var cells = [];
    for (var i = 0; i < maxLen; i++) {
      var a = fromText[i] || '';
      var b = toText[i] || '';
      var wrap = document.createElement('span');
      wrap.className = 'ls-cell';
      if ((a === ' ' || a === '') && (b === ' ' || b === '') && (a === ' ' || b === ' ')) {
        // 둘 중 하나라도 공백이고 둘 다 글자가 아니면(즉 실질적으로 공백 칸) 애니메이션 없이 공백만 둔다
        wrap.classList.add('ls-space');
        wrap.textContent = ' ';
        host.appendChild(wrap);
        cells.push({ el: wrap, isSpace: true });
        continue;
      }
      // 칸 너비는 흐름 안에 있는 primary만으로 정해지는데 secondary는
      // position:absolute라 너비에 기여하지 않는다. a/b 글자가 서로 다르면(문구 교체·등장)
      // 더 넓은 쪽 글자가 overflow:hidden에 잘려 보이므로, 두 글자 중 더 넓은 쪽으로
      // 칸 너비를 명시적으로 고정한다.
      var w = Math.max(measureWidth(host, a), measureWidth(host, b));
      var primary = document.createElement('span');
      primary.className = 'ls-primary';
      primary.textContent = a || ' ';
      var secondary = document.createElement('span');
      secondary.className = 'ls-secondary';
      secondary.textContent = b || ' ';
      wrap.appendChild(primary);
      wrap.appendChild(secondary);
      if (w > 0) wrap.style.width = Math.ceil(w) + 'px';
      host.appendChild(wrap);
      cells.push({ el: wrap, primary: primary, secondary: secondary, isSpace: false });
    }
    return cells;
  }

  function mount(container, text, opts) {
    opts = opts || {};
    var stagger = opts.stagger || 0.08;
    var duration = opts.duration || 0.8;
    var ease = opts.ease || 'back.out(1.4)';

    container.classList.add('ls-root');
    container.innerHTML = '';

    var sr = document.createElement('span');
    sr.className = 'ls-sr-only';
    sr.textContent = text;
    container.appendChild(sr);

    var cellHost = document.createElement('span');
    cellHost.className = 'ls-cells';
    cellHost.setAttribute('aria-hidden', 'true');
    container.appendChild(cellHost);

    var current = text;
    var cells = buildCells(cellHost, current, current); // primary=current, secondary=current(동일, 대기 상태)

    function animIdxs(cellList) {
      var idxs = [];
      cellList.forEach(function (c, i) { if (!c.isSpace) idxs.push(i); });
      return idxs;
    }

    // ---- 왕복 롤(같은 글자가 한 바퀴 굴러 제자리) : forward 모드, 끝나면 리셋 ----
    function rollOnce(runOpts) {
      runOpts = runOpts || {};
      var st = runOpts.stagger != null ? runOpts.stagger : stagger;
      var dur = runOpts.duration || duration;
      var ez = runOpts.ease || ease;
      var idxs = animIdxs(cells);
      var order = shuffledIndexes(idxs.length).map(function (k) { return idxs[k]; });
      var tl = gsap.timeline();
      var maxDelay = 0;
      order.forEach(function (idx, i) {
        var c = cells[idx];
        var delay = i * st;
        maxDelay = Math.max(maxDelay, delay);
        tl.to(c.primary, { yPercent: -100, duration: dur, ease: ez }, delay);
        tl.to(c.secondary, { top: '0%', duration: dur, ease: ez }, delay);
        tl.set(c.primary, { yPercent: 0 }, delay + dur);
        tl.set(c.secondary, { top: '100%' }, delay + dur);
      });
      return tl;
    }

    // ---- 문구 교체: current → newText (한 방향, 리셋 없음) ----
    function replaceText(newText, runOpts) {
      runOpts = runOpts || {};
      var st = runOpts.stagger != null ? runOpts.stagger : stagger;
      var dur = runOpts.duration || duration;
      var ez = runOpts.ease || ease;
      sr.textContent = newText;
      var newCells = buildCells(cellHost, current, newText);
      var idxs = animIdxs(newCells);
      var order = shuffledIndexes(idxs.length).map(function (k) { return idxs[k]; });
      var tl = gsap.timeline();
      order.forEach(function (idx, i) {
        var c = newCells[idx];
        var delay = i * st;
        tl.to(c.primary, { yPercent: -100, duration: dur, ease: ez }, delay);
        tl.to(c.secondary, { top: '0%', duration: dur, ease: ez }, delay);
      });
      tl.add(function () {
        cells = newCells;
        current = newText;
      });
      return tl;
    }

    // ---- 호버 핑퐁 ----
    function pingStart(runOpts) {
      runOpts = runOpts || {};
      var st = runOpts.stagger != null ? runOpts.stagger : stagger;
      var dur = runOpts.duration || duration;
      var ez = runOpts.ease || ease;
      var idxs = animIdxs(cells);
      var order = shuffledIndexes(idxs.length).map(function (k) { return idxs[k]; });
      order.forEach(function (idx, i) {
        var c = cells[idx];
        var delay = i * st;
        gsap.to(c.primary, { yPercent: -100, duration: dur, ease: ez, delay: delay, overwrite: 'auto' });
        gsap.to(c.secondary, { top: '0%', duration: dur, ease: ez, delay: delay, overwrite: 'auto' });
      });
    }
    function pingEnd(runOpts) {
      runOpts = runOpts || {};
      var st = runOpts.stagger != null ? runOpts.stagger : stagger;
      var dur = runOpts.duration || duration;
      var ez = runOpts.ease || ease;
      var idxs = animIdxs(cells);
      var order = shuffledIndexes(idxs.length).map(function (k) { return idxs[k]; });
      order.forEach(function (idx, i) {
        var c = cells[idx];
        var delay = i * st;
        gsap.to(c.primary, { yPercent: 0, duration: dur, ease: ez, delay: delay, overwrite: 'auto' });
        gsap.to(c.secondary, { top: '100%', duration: dur, ease: ez, delay: delay, overwrite: 'auto' });
      });
    }

    function attachHoverPingpong() {
      container.addEventListener('mouseenter', function () { pingStart(); });
      container.addEventListener('mouseleave', function () { pingEnd(); });
    }

    return {
      rollOnce: rollOnce,
      replaceText: replaceText,
      pingStart: pingStart,
      pingEnd: pingEnd,
      attachHoverPingpong: attachHoverPingpong,
      el: container
    };
  }

  return { mount: mount };
})();
