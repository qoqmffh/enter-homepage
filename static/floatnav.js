/* 플로팅 내비게이션(지시서 2026-11-13) — 하단 스티키 바 + 우측 퀵메뉴 + 1:1 상담센터.
   static/floatnav.css, templates/partials/floatnav.html 짝.
   하단 바 등장/숨김은 IntersectionObserver 둘로만 판단한다(스크롤 이벤트 리스너 없음):
   히어로를 벗어나면 보이고, 맨 아래 CTA 띠([data-fn-cta-band] — cta_band.html의 #lead
   또는 why.html만 다른 구조라 따로 쓰는 #contact)가 보이면 다시 숨긴다. */
(function () {
  'use strict';

  var bottombar = document.querySelector('[data-fn-bottombar]');
  var consultRoot = document.querySelector('[data-fn-consult]');
  if (!bottombar && !consultRoot) return;

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var hero = document.querySelector('.hp-hero, .sp-hero');
  var ctaBand = document.querySelector('[data-fn-cta-band]');
  var consultPanel = document.querySelector('[data-fn-consult-panel]');

  var heroVisible = !hero; // 히어로가 없으면(이론상 없음) 처음부터 바가 보여도 무방
  var ctaVisible = false;

  function updateBarVisibility() {
    var show = !heroVisible && !ctaVisible;
    if (bottombar) {
      bottombar.classList.toggle('is-visible', show);
      document.body.style.paddingBottom = show ? bottombar.offsetHeight + 'px' : '';
    }
    if (consultRoot) consultRoot.classList.toggle('bar-visible', show);
    if (consultPanel) consultPanel.classList.toggle('bar-visible', show);
  }

  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { heroVisible = entry.isIntersecting; });
      updateBarVisibility();
    }, { threshold: 0 }).observe(hero);
  }

  if (ctaBand && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { ctaVisible = entry.isIntersecting; });
      updateBarVisibility();
    }, { threshold: 0 }).observe(ctaBand);
  }

  updateBarVisibility();

  // ---------- TOP ----------
  var topBtn = document.querySelector('[data-fn-top]');
  if (topBtn) {
    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  // ---------- 1:1 상담 ----------
  var panel = document.querySelector('[data-fn-consult-panel]');
  var closeBtn = document.querySelector('[data-fn-consult-close]');
  var body = document.querySelector('[data-fn-consult-body]');
  var form = document.querySelector('[data-fn-consult-form]');
  var input = document.querySelector('[data-fn-consult-input]');
  var openBtns = Array.prototype.slice.call(document.querySelectorAll('[data-fn-consult-open]'));

  function isConsultOpen() { return !!panel && !panel.hidden; }

  function openConsult() {
    if (!panel || isConsultOpen()) return;
    panel.hidden = false;
    requestAnimationFrame(function () { panel.classList.add('is-open'); });
    openBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
    setTimeout(function () { if (input) input.focus(); }, 60);
  }
  function closeConsult() {
    if (!panel || !isConsultOpen()) return;
    panel.classList.remove('is-open');
    openBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    setTimeout(function () { panel.hidden = true; }, 220);
  }

  openBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (isConsultOpen()) closeConsult(); else openConsult();
    });
  });
  if (closeBtn) closeBtn.addEventListener('click', closeConsult);

  function addMessage(text, who) {
    if (!body) return;
    var row = document.createElement('div');
    row.className = 'fn-consult-msg fn-consult-msg--' + who;
    row.textContent = text;
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  /* AI 상담원이 아직 연결되지 않았다 — 나중에 실제 응답으로 바꿔 끼울 수 있게
     전송 로직을 이 함수 하나로 분리해 둔다(지시서 2026-11-13). */
  function sendToAssistant(message) {
    addMessage(message, 'user');
    var phone = (window.ENTER_SITE && window.ENTER_SITE.phone) || '';
    setTimeout(function () {
      addMessage('AI 상담은 곧 연결될 예정입니다. 지금은 전화 ' + phone + ' 또는 정책 받기 신청을 이용해 주세요.', 'assistant');
    }, 400);
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input ? input.value.trim() : '';
      if (!v) return;
      input.value = '';
      sendToAssistant(v);
    });
  }

  var chips = Array.prototype.slice.call(document.querySelectorAll('[data-fn-chip]'));
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      if (chip.getAttribute('data-fn-chip') === 'lead') {
        closeConsult();
        if (window.ENTER_LEAD_MODAL) window.ENTER_LEAD_MODAL.open(chip);
      }
    });
  });
})();
