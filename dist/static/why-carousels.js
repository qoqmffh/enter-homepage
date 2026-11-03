/* 왜 ENTER(why.html) 전용 — 본사 사진 4장 롤링 + 약속 인용문 5개 롤링.
   둘 다 같은 패턴: 크로스페이드만(줌·슬라이드 없음), 호버/포커스 시 정지,
   화살표로 수동 이동, prefers-reduced-motion이면 자동 전환 끄고 첫 장만. */
(function () {
  'use strict';

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function setupCarousel(root, opts) {
    var items = root.querySelectorAll(opts.itemSelector);
    if (!items.length) return;
    var index = 0;
    var timer = null;

    function render() {
      items.forEach(function (el, i) {
        el.classList.toggle(opts.activeClass, i === index);
      });
      if (opts.counter) {
        opts.counter.textContent = pad2(index + 1) + ' / ' + pad2(items.length);
      }
    }
    function go(next) {
      index = (next + items.length) % items.length;
      render();
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function start() {
      stop();
      if (reduceMotion || items.length < 2) return;
      timer = setInterval(function () { go(index + 1); }, opts.interval);
    }

    if (opts.prevBtn) {
      opts.prevBtn.addEventListener('click', function () { go(index - 1); start(); });
    }
    if (opts.nextBtn) {
      opts.nextBtn.addEventListener('click', function () { go(index + 1); start(); });
    }

    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', function (e) {
      if (!root.contains(e.relatedTarget)) start();
    });

    render();
    start();
  }

  /* 박스 전체를 클릭해도 다음으로 넘어가게(지시서 2026-11-04, 커스텀 커서 라벨 "넘기기/다음 →"
     와 짝). 실제 링크·버튼(화살표 버튼, 인용문 안의 CTA 링크) 클릭은 원래 동작 그대로 두고
     건드리지 않는다. */
  function makeBoxClickable(root, nextBtn) {
    if (!root || !nextBtn) return;
    root.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      nextBtn.click();
    });
  }

  function init() {
    var photoRoot = document.querySelector('[data-photo-carousel]');
    if (photoRoot) {
      setupCarousel(photoRoot, {
        itemSelector: '.hp-photo-img',
        activeClass: 'is-active',
        interval: parseInt(photoRoot.getAttribute('data-interval'), 10) || 5000,
        prevBtn: photoRoot.querySelector('[data-photo-prev]'),
        nextBtn: photoRoot.querySelector('[data-photo-next]'),
        counter: photoRoot.querySelector('[data-photo-counter]'),
      });
      makeBoxClickable(photoRoot, photoRoot.querySelector('[data-photo-next]'));
    }

    var quoteStage = document.querySelector('[data-quote-carousel]');
    if (quoteStage) {
      var quoteRoot = quoteStage.closest('.hp-promise-content') || quoteStage.parentElement;
      setupCarousel(quoteRoot, {
        itemSelector: '.hp-quote-item',
        activeClass: 'is-active',
        interval: parseInt(quoteStage.getAttribute('data-interval'), 10) || 7000,
        prevBtn: quoteRoot.querySelector('[data-quote-prev]'),
        nextBtn: quoteRoot.querySelector('[data-quote-next]'),
        counter: quoteRoot.querySelector('[data-quote-counter]'),
      });
      makeBoxClickable(quoteRoot, quoteRoot.querySelector('[data-quote-next]'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
