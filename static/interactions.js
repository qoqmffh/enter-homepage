/* ENTER 홈 전용 스크롤 인터랙션 — 라이브러리 없이 IntersectionObserver만 사용.
   home.css가 html.js 기준으로만 요소를 숨기므로, 이 스크립트가 없거나 실패해도 콘텐츠는 전부 보인다. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1) 섹션/블록 리빌 (+ 순차 등장을 위한 stagger)
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  // 같은 테이블 안의 tr.reveal 들에는 순서대로 transition-delay를 줘서
  // 한 화면에 전부 들어와도 "한 줄씩 찍히는" 느낌을 만든다.
  document.querySelectorAll('.h-ledger-table tbody, .h-journey-table tbody').forEach(function (tbody) {
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr.reveal'));
    rows.forEach(function (row, i) {
      row.style.transitionDelay = (i * 90) + 'ms';
    });
  });

  // 기본은 "보임"이다. 화면 밖에 있다고 지금 이 자리에서 동기적으로 확인된 요소에만
  // .h-pending(숨김)을 붙이고, 그 요소가 화면에 들어오면 옵저버가 .in-view로 바꿔준다.
  // 이미 화면 안에 있는 요소는 애초에 숨긴 적이 없으므로, 옵저버 콜백/트랜지션 타이밍과
  // 무관하게 항상 보인다 — 리사이즈 직후 바로 찍는 풀페이지 스크린샷에서도 안전하다.
  function isInViewport(el) {
    var r = el.getBoundingClientRect();
    return r.top < (window.innerHeight || document.documentElement.clientHeight) && r.bottom > 0;
  }

  if (!('IntersectionObserver' in window) || reduceMotion) {
    // 애니메이션을 안 할 거면 .in-view만 바로 켜서, 거기 물려있는 다른 효과
    // (라벨 밑줄, 도장 등)도 전부 최종 상태로 보이게 한다.
    revealEls.forEach(function (el) { el.classList.add('in-view'); });
  } else {
    var pending = [];
    revealEls.forEach(function (el) {
      if (isInViewport(el)) {
        // 이미 화면 안에 있으면 숨긴 적이 없으니 트랜지션 없이 바로 in-view로 표시만 해 둔다.
        el.classList.add('in-view');
      } else {
        el.classList.add('h-pending');
        pending.push(el);
      }
    });
    if (pending.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
      pending.forEach(function (el) { io.observe(el); });
    }
  }

  // 2) 큰 숫자 카운트업 — 텍스트 안의 숫자(콤마 포함)만 찾아서 0에서 목표값까지 애니메이션.
  //    "ZERO" 처럼 숫자가 없으면 건드리지 않고 그대로 둔다.
  function animateCountUp(el) {
    var text = el.textContent;
    var match = text.match(/[\d,]+/);
    if (!match) return;

    var raw = match[0];
    var target = parseInt(raw.replace(/,/g, ''), 10);
    if (isNaN(target)) return;

    var prefix = text.slice(0, match.index);
    var suffix = text.slice(match.index + raw.length);
    var hasComma = raw.indexOf(',') !== -1;

    if (reduceMotion) {
      el.textContent = prefix + raw + suffix;
      return;
    }

    var duration = 1200;
    var start = null;

    function format(n) {
      return hasComma ? n.toLocaleString('ko-KR') : String(n);
    }

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var current = Math.round(target * eased);
      el.textContent = prefix + format(current) + suffix;
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = prefix + format(target) + suffix;
      }
    }
    requestAnimationFrame(step);
  }

  var countEls = Array.prototype.slice.call(document.querySelectorAll('[data-countup]'));
  if (countEls.length) {
    if (!('IntersectionObserver' in window)) {
      countEls.forEach(animateCountUp);
    } else {
      var countPending = [];
      countEls.forEach(function (el) {
        if (isInViewport(el)) { animateCountUp(el); } else { countPending.push(el); }
      });
      if (countPending.length) {
        var countIo = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCountUp(entry.target);
              countIo.unobserve(entry.target);
            }
          });
        }, { threshold: 0.4 });
        countPending.forEach(function (el) { countIo.observe(el); });
      }
    }
  }

  // 3) 모바일 하단 연락 바: 히어로를 지나면 등장
  var footerbar = document.querySelector('.footerbar');
  var hero = document.getElementById('hero');
  if (footerbar && hero) {
    if (!('IntersectionObserver' in window)) {
      footerbar.classList.add('h-bar-visible');
    } else {
      footerbar.classList.toggle('h-bar-visible', !isInViewport(hero));
      var barIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          footerbar.classList.toggle('h-bar-visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });
      barIo.observe(hero);
    }
  }
})();
