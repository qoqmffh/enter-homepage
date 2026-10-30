/* ENTER 홈 POETIC — /2 /3 기능 카드 안 미니 UI를 움직이는 장면으로(지시서 5-5 ④).
   순수 HTML/CSS + JS(이미지 없음). 기본 마크업은 이미 "완료된 안전한 상태"로
   렌더링돼 있다(/2=마스킹 완료, /3=메시지 전부 보임) — JS가 돌 때만 애니메이션
   사이클로 바꾼다. 화면에 들어오면 재생, 나가면 정지(IntersectionObserver),
   prefers-reduced-motion이면 아예 손대지 않고 기본(최종) 상태로 둔다. */
(function () {
  'use strict';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function clearTimers(state) { state.timers.forEach(clearTimeout); state.timers = []; }
  function after(state, ms, fn) { state.timers.push(setTimeout(fn, ms)); }

  // ---------------- /2 CRM 장면 ----------------
  function initCrmScene(scene) {
    var statusEl = scene.querySelector('[data-crm-status]');
    var hardmarkEl = scene.querySelector('[data-crm-hardmark]');
    var fieldEls = {
      name: scene.querySelector('[data-crm-field="name"]'),
      phone: scene.querySelector('[data-crm-field="phone"]'),
      rrn: scene.querySelector('[data-crm-field="rrn"]')
    };
    if (!statusEl || !hardmarkEl || !fieldEls.name || !fieldEls.phone || !fieldEls.rrn) return null;

    var data = {
      name: { unmasked: scene.getAttribute('data-crm-name-unmasked'), masked: scene.getAttribute('data-crm-name-masked') },
      phone: { unmasked: scene.getAttribute('data-crm-phone-unmasked'), masked: scene.getAttribute('data-crm-phone-masked') },
      rrn: { unmasked: scene.getAttribute('data-crm-rrn-unmasked'), masked: scene.getAttribute('data-crm-rrn-masked') }
    };
    var statuses = [
      scene.getAttribute('data-crm-status-start'),
      scene.getAttribute('data-crm-status-mid'),
      scene.getAttribute('data-crm-status-end')
    ];

    var ls = {};
    if (window.LetterSwap) {
      try {
        Object.keys(fieldEls).forEach(function (key) {
          ls[key] = LetterSwap.mount(fieldEls[key], data[key].masked, { stagger: 0.03, duration: 0.4, ease: 'back.out(1.4)' });
        });
      } catch (e) { ls = {}; }
    }

    function setFields(which) {
      Object.keys(fieldEls).forEach(function (key) {
        if (ls[key]) ls[key].replaceText(data[key][which], { stagger: 0.03 });
        else fieldEls[key].textContent = data[key][which];
      });
    }

    var state = { timers: [] };

    function playCycle() {
      clearTimers(state);
      hardmarkEl.style.opacity = '0';
      hardmarkEl.style.transform = 'scale(.8)';
      statusEl.textContent = statuses[0];
      setFields('unmasked');

      after(state, 1200, function () { statusEl.textContent = statuses[1]; });
      after(state, 2400, function () { statusEl.textContent = statuses[2]; });
      after(state, 2650, function () {
        setFields('masked');
        hardmarkEl.style.opacity = '1';
        hardmarkEl.style.transform = 'scale(1)';
      });
      after(state, 6000, playCycle);
    }

    return { play: playCycle, stop: function () { clearTimers(state); } };
  }

  // ---------------- /3 정책방 채팅 장면 ----------------
  function initChatScene(scene) {
    var msgs = Array.prototype.slice.call(scene.querySelectorAll('[data-chat-msg]'));
    if (!msgs.length) return null;
    var state = { timers: [] };

    function playCycle() {
      clearTimers(state);
      msgs.forEach(function (m) { m.classList.add('hp-chat-msg--pending'); });
      var stepGap = 1100;
      msgs.forEach(function (m, i) {
        after(state, 500 + i * stepGap, function () { m.classList.remove('hp-chat-msg--pending'); });
      });
      var holdUntil = 500 + (msgs.length - 1) * stepGap + 2400;
      after(state, holdUntil, playCycle);
    }

    return { play: playCycle, stop: function () { clearTimers(state); } };
  }

  function setup(selector, initFn) {
    var els = document.querySelectorAll(selector);
    if (!els.length || !('IntersectionObserver' in window)) return;
    els.forEach(function (el) {
      var controller = initFn(el);
      if (!controller) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) controller.play();
          else controller.stop();
        });
      }, { threshold: 0.3 });
      io.observe(el);
    });
  }

  setup('[data-crm-scene]', initCrmScene);
  setup('[data-chat-scene]', initChatScene);
})();
