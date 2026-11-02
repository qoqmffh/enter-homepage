/* ENTER why.html — 광고(index.html)에서 "홈페이지 둘러보기"/"건너뛰기"로 넘어올 때만 동작한다.
   index.html은 초록 띠 3장으로 화면을 덮은 채 이 페이지로 이동하고(location.href=
   'why.html#from-ad'), 이 페이지는 <head>의 동기 스크립트가 미리 html.wipe-pending을
   붙여서 "이미 덮인 상태"로 시작한다(FOUC 없음) — 여기서는 그 띠를 걷어내기만 하면
   기존 같은 페이지 안 와이프와 똑같이 보인다. 해시 없이 why.html을 직접 방문하면
   wipe-pending이 안 붙으므로 이 스크립트는 즉시 종료한다(평소엔 완성된 상태 그대로). */
(function () {
  'use strict';

  var html = document.documentElement;
  if (!html.classList.contains('wipe-pending')) return;

  if (window.__wipeHardTimeout) { clearTimeout(window.__wipeHardTimeout); window.__wipeHardTimeout = null; }

  var layers = document.querySelectorAll('[data-wipe-layer]');
  var lines = document.querySelectorAll('.hp-hero .hp-display-xl .hp-headline-line');

  lines.forEach(function (el) {
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
  });

  // 두 번의 rAF로 "완전히 덮인" 프레임이 먼저 그려지게 한 뒤 전환을 건다(안 그러면
  // translateX(0) -> translateX(100%)이 한 프레임에 합쳐져 애니메이션 없이 바로 걷힐 수 있다).
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      layers.forEach(function (layer, i) {
        setTimeout(function () {
          layer.style.transition = 'transform .72s cubic-bezier(.7,0,.3,1)';
          layer.style.transform = 'translateX(100%)';
        }, i * 80);
      });

      setTimeout(function () {
        lines.forEach(function (el, i) {
          el.style.transition = 'opacity .6s ease ' + (i * 0.1) + 's, transform .6s ease ' + (i * 0.1) + 's';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        });
        setTimeout(function () {
          lines.forEach(function (el) { el.style.transition = ''; el.style.opacity = ''; el.style.transform = ''; });
        }, 600 + lines.length * 100 + 50);
      }, 200);

      setTimeout(function () {
        html.classList.remove('wipe-pending');
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      }, 900);
    });
  });
})();
