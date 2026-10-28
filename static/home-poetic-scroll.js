/* ENTER 홈 POETIC — 5-2 "홈 전체를 스크롤 인터랙션으로". 기획서 §5-2 승인된 콘티대로.
   철학은 다른 POETIC 스크립트와 동일: 기본 마크업은 전부 "완료된 최종 상태"로 보이고,
   이 스크립트가 실제로 켜졌을 때만(GSAP+ScrollTrigger 로드 성공 + reduced-motion 아님)
   JS가 시작 상태(흐릿함/숨김/축소)를 inline style로 깔고 그 위에서 애니메이션한다.
   실패하거나 꺼지면 아무 것도 건드리지 않은 "전부 보이는" 기본 상태로 남는다. */
(function () {
  'use strict';

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  var INK = '#10182B';
  var INK_DIM = 'rgba(16,24,43,.22)';

  // ---------------- hero 헤드라인: 스크롤에 맞춰 단어 단위로 채워짐 ----------------
  function setupHeroHeadline() {
    var words = document.querySelectorAll('.hp-hero [data-scroll-headline] .hp-word');
    if (!words.length) return null;
    gsap.set(words, { color: INK_DIM });
    var tween = gsap.to(words, {
      color: INK,
      ease: 'none',
      stagger: { each: 0.45, from: 'start' },
      scrollTrigger: {
        trigger: '.hp-hero',
        start: 'top top',
        end: 'bottom 55%',
        scrub: 0.3
      }
    });
    return function cleanup() {
      tween.scrollTrigger && tween.scrollTrigger.kill();
      tween.kill();
      gsap.set(words, { clearProps: 'color' });
    };
  }

  // ---------------- stats: 스크롤 진입 시 카운트업 ----------------
  function setupStatsCountup() {
    var nums = document.querySelectorAll('#stats .hp-stat-num');
    if (!nums.length) return null;
    var triggers = [];
    nums.forEach(function (el) {
      var raw = el.textContent.trim();
      var m = raw.match(/^([\d,]+)(.*)$/);
      if (!m) return;
      var target = parseInt(m[1].replace(/,/g, ''), 10);
      var suffix = m[2] || '';
      if (!isFinite(target)) return;
      var proxy = { v: 0 };
      var st = ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: function () {
          el.textContent = '0' + suffix;
          gsap.to(proxy, {
            v: target,
            duration: 1.1,
            ease: 'power1.out',
            onUpdate: function () {
              el.textContent = Math.round(proxy.v).toLocaleString('ko-KR') + suffix;
            },
            onComplete: function () { el.textContent = raw; }
          });
        }
      });
      triggers.push({ st: st, el: el, raw: raw });
    });
    if (!triggers.length) return null;
    return function cleanup() {
      triggers.forEach(function (t) { t.st.kill(); t.el.textContent = t.raw; });
    };
  }

  // ---------------- statement: 헤드라인 페이드업 -> 사진이 커지며 채움 (데스크톱 전용, 핀) ----------------
  function setupStatementPin() {
    var section = document.getElementById('statement');
    var photo = section && section.querySelector('.hp-photo-block');
    var heads = section && section.querySelectorAll('.hp-headline-lg, .hp-headline-md');
    if (!section || !photo) return null;
    gsap.set(photo, { scale: 0.86, transformOrigin: '50% 50%' });
    if (heads && heads.length) gsap.set(heads, { opacity: 0, y: 24 });

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=160%',
        scrub: 0.3,
        pin: true
      }
    });
    if (heads && heads.length) {
      tl.to(heads, { opacity: 1, y: 0, duration: 0.25, ease: 'power1.out', stagger: 0.08 }, 0);
    }
    tl.to(photo, { scale: 1, duration: 0.75, ease: 'none' }, 0.2);

    return function cleanup() {
      tl.scrollTrigger && tl.scrollTrigger.kill();
      tl.kill();
      gsap.set(photo, { clearProps: 'scale,transformOrigin' });
      if (heads && heads.length) gsap.set(heads, { clearProps: 'opacity,transform' });
    };
  }

  // ---------------- features /1/2/3 카드: 차례로 겹쳐 쌓이는 스택 (데스크톱 전용, 핀) ----------------
  function setupFeatureStack() {
    var cards = gsap.utils.toArray('#features .hp-feature-card');
    if (cards.length < 2) return null;
    var sts = [];
    cards.forEach(function (card, i) {
      gsap.set(card, { zIndex: i + 1 });
      var pinSt = ScrollTrigger.create({
        trigger: card,
        start: 'top 96px',
        end: function () { return '+=' + Math.round(window.innerHeight * 0.85); },
        pin: true,
        pinSpacing: i === cards.length - 1
      });
      sts.push(pinSt);
      if (i > 0) {
        var prev = cards[i - 1];
        var dimSt = ScrollTrigger.create({
          trigger: card,
          start: 'top 96px',
          end: function () { return '+=' + Math.round(window.innerHeight * 0.85); },
          scrub: true,
          onUpdate: function (self) {
            gsap.set(prev, {
              scale: 1 - self.progress * 0.05,
              filter: 'brightness(' + (1 - self.progress * 0.3).toFixed(2) + ')'
            });
          }
        });
        sts.push(dimSt);
      }
    });
    return function cleanup() {
      sts.forEach(function (st) { st.kill(); });
      gsap.set(cards, { clearProps: 'zIndex,scale,filter' });
    };
  }

  // ---------------- promise: 사진 슬라이드인 + 인용문 줄 단위 등장 ----------------
  function setupPromiseReveal(isDesktop) {
    var section = document.getElementById('promise');
    if (!section) return null;
    var photo = section.querySelector('.hp-promise-photo-lg');
    var lines = section.querySelectorAll('.hp-quote span');
    if (!photo && !lines.length) return null;
    if (photo) gsap.set(photo, { opacity: 0, x: isDesktop ? -32 : 0, y: isDesktop ? 0 : 16 });
    if (lines.length) gsap.set(lines, { opacity: 0, y: 14 });

    var st = ScrollTrigger.create({
      trigger: section,
      start: 'top 72%',
      once: true,
      onEnter: function () {
        var tl = gsap.timeline({
          onComplete: function () {
            if (photo) gsap.set(photo, { clearProps: 'opacity,transform' });
            if (lines.length) gsap.set(lines, { clearProps: 'opacity,transform' });
          }
        });
        if (photo) tl.to(photo, { opacity: 1, x: 0, y: 0, duration: 0.6, ease: 'power2.out' }, 0);
        if (lines.length) tl.to(lines, { opacity: 1, y: 0, duration: 0.5, stagger: 0.12, ease: 'power2.out' }, 0.15);
      }
    });
    return function cleanup() {
      st.kill();
      if (photo) gsap.set(photo, { clearProps: 'opacity,transform' });
      if (lines.length) gsap.set(lines, { clearProps: 'opacity,transform' });
    };
  }

  // ---------------- 공용: 뷰포트 진입 시 1회 스태거 페이드업 ----------------
  function setupStaggerReveal(sectionSelector, itemSelector, opts) {
    var section = document.querySelector(sectionSelector);
    if (!section) return null;
    var items = section.querySelectorAll(itemSelector);
    if (!items.length) return null;
    var o = opts || {};
    gsap.set(items, { opacity: 0, y: o.y || 18 });
    var st = ScrollTrigger.create({
      trigger: section,
      start: o.start || 'top 78%',
      once: true,
      onEnter: function () {
        gsap.to(items, {
          opacity: 1, y: 0,
          duration: o.duration || 0.45,
          stagger: o.stagger || 0.08,
          ease: 'power2.out',
          onComplete: function () { gsap.set(items, { clearProps: 'opacity,transform' }); }
        });
      }
    });
    return function cleanup() {
      st.kill();
      gsap.set(items, { clearProps: 'opacity,transform' });
    };
  }

  // ---------------- closing: 문장 채움(와이프) 후 CTA 등장 ----------------
  function setupClosingReveal() {
    var section = document.getElementById('contact');
    var headline = section && section.querySelector('[data-scroll-fill]');
    var ctas = section && section.querySelector('.hp-closing-ctas');
    if (!headline) return null;
    gsap.set(headline, { clipPath: 'inset(0 100% 0 0)' });
    if (ctas) gsap.set(ctas, { opacity: 0, y: 12 });

    var st = ScrollTrigger.create({
      trigger: section,
      start: 'top 65%',
      once: true,
      onEnter: function () {
        var tl = gsap.timeline({
          onComplete: function () {
            gsap.set(headline, { clearProps: 'clipPath' });
            if (ctas) gsap.set(ctas, { clearProps: 'opacity,transform' });
          }
        });
        tl.to(headline, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power2.inOut' }, 0);
        if (ctas) tl.to(ctas, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.5);
      }
    });
    return function cleanup() {
      st.kill();
      gsap.set(headline, { clearProps: 'clipPath' });
      if (ctas) gsap.set(ctas, { clearProps: 'opacity,transform' });
    };
  }

  // ---------------- 반응형/reduced-motion 분기 ----------------
  var mm = gsap.matchMedia();
  mm.add(
    {
      isDesktop: '(min-width: 768px)',
      reduceMotion: '(prefers-reduced-motion: reduce)'
    },
    function (context) {
      if (context.conditions.reduceMotion) return; // 기본(최종) 상태 그대로 둔다

      var isDesktop = context.conditions.isDesktop;
      var cleanups = [];
      function add(fn) { if (fn) cleanups.push(fn); }

      add(setupHeroHeadline());
      add(setupStatsCountup());
      if (isDesktop) {
        add(setupStatementPin());
        add(setupFeatureStack());
      }
      add(setupPromiseReveal(isDesktop));
      add(setupStaggerReveal('#start .hp-start-list', '.hp-start-row'));
      add(setupStaggerReveal('#trust .hp-trust-badges', '.hp-badge'));
      add(setupStaggerReveal('#carriers', '.hp-carriers-names > div', { y: 28, start: 'top 75%', stagger: 0.07 }));
      add(setupClosingReveal());

      return function () {
        cleanups.forEach(function (fn) { fn(); });
      };
    }
  );
})();
