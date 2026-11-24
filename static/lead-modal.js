/* 정책 받기 신청 팝업(지시서 2026-11-13) — static/lead-modal.css, templates/partials/lead_modal.html.
   사이트 전체의 [data-lead-trigger] 버튼(정책 받기/정책 받아보기/정책 문의 전부)을 한 곳에서
   위임(document 클릭)으로 받아 이 팝업 하나를 연다.

   lead_form_enabled=false(지시서 2026-11-16 §2, 관리자 페이지 생기기 전까지)면 신청 폼
   대신 전화·문자 안내("contact" 뷰)를 먼저 보여준다. true가 되면 원래 신청 폼("form" 뷰)이
   열리고, 전송은 site.lead_endpoint로 POST한다. 엔드포인트가 비어 있거나 전송이 실패하면
   "접수됨" 화면 대신 전화 안내 화면을 보여준다 — 접수 안 됐는데 됐다고 보이면 안 된다는
   지시서 원칙. */
(function () {
  'use strict';

  var backdrop = document.querySelector('[data-lm-backdrop]');
  if (!backdrop) return;

  var modal = backdrop.querySelector('[data-lm-modal]');
  var closeBtn = backdrop.querySelector('[data-lm-close]');
  var views = {
    contact: backdrop.querySelector('[data-lm-view="contact"]'),
    form: backdrop.querySelector('[data-lm-view="form"]'),
    success: backdrop.querySelector('[data-lm-view="success"]'),
    error: backdrop.querySelector('[data-lm-view="error"]')
  };
  var viewTitleIds = { contact: 'lmTitleContact', form: 'lmTitleForm', success: 'lmTitleSuccess', error: 'lmTitleError' };
  var form = backdrop.querySelector('[data-lm-form]');
  var nameInput = backdrop.querySelector('[data-lm-input="name"]');
  var shopInput = backdrop.querySelector('[data-lm-input="shop"]');
  var phoneInput = backdrop.querySelector('[data-lm-input="phone"]');
  var consentInput = backdrop.querySelector('[data-lm-input="consent"]');
  var submitBtn = backdrop.querySelector('[data-lm-submit]');
  var consentToggle = backdrop.querySelector('[data-lm-consent-toggle]');
  var consentDetail = backdrop.querySelector('[data-lm-consent-detail]');
  var honeypot = backdrop.querySelector('.lm-honeypot input');
  var confirmBtns = Array.prototype.slice.call(backdrop.querySelectorAll('[data-lm-confirm]'));

  var SITE = window.ENTER_SITE || {};
  var SUBMIT_LABEL = submitBtn.textContent;
  var lastFocused = null;

  function showView(name) {
    Object.keys(views).forEach(function (k) {
      if (views[k]) views[k].hidden = (k !== name);
    });
    modal.setAttribute('aria-labelledby', viewTitleIds[name]);
  }

  // ---------- 전화번호: 자동 하이픈 + 검증 ----------
  function formatPhone(raw) {
    var d = raw.replace(/\D/g, '').slice(0, 11);
    if (d.length < 4) return d;
    if (d.indexOf('02') === 0) {
      if (d.length <= 5) return d.slice(0, 2) + '-' + d.slice(2);
      if (d.length <= 9) return d.slice(0, 2) + '-' + d.slice(2, d.length - 4) + '-' + d.slice(-4);
      return d.slice(0, 2) + '-' + d.slice(2, 6) + '-' + d.slice(6, 10);
    }
    if (d.length <= 7) return d.slice(0, 3) + '-' + d.slice(3);
    if (d.length <= 10) return d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7, 11);
  }
  // 010/011/016~019 또는 지역번호: 0으로 시작하는 9~11자리 숫자(지시서 2026-11-13 단순 규칙)
  function isValidPhone(raw) {
    var d = raw.replace(/\D/g, '');
    return /^0\d{8,10}$/.test(d);
  }
  function isValidShop(raw) { return raw.trim().length >= 2; }
  function isValidName(raw) { return raw.trim().length >= 2; }

  function toggleFieldError(name, on) {
    var input = backdrop.querySelector('[data-lm-input="' + name + '"]');
    var err = backdrop.querySelector('[data-lm-error="' + name + '"]');
    if (input) input.classList.toggle('is-error', !!on);
    if (err) err.hidden = !on;
  }

  function updateSubmitState() {
    var ok = isValidName(nameInput.value) && isValidShop(shopInput.value) && isValidPhone(phoneInput.value) && consentInput.checked;
    submitBtn.disabled = !ok;
  }

  phoneInput.addEventListener('input', function () {
    phoneInput.value = formatPhone(phoneInput.value);
    if (!phoneInput.classList.contains('is-error')) { /* 입력 중엔 조용히 */ }
    updateSubmitState();
  });
  nameInput.addEventListener('input', updateSubmitState);
  shopInput.addEventListener('input', updateSubmitState);
  consentInput.addEventListener('change', updateSubmitState);

  nameInput.addEventListener('blur', function () { toggleFieldError('name', !isValidName(nameInput.value)); });
  shopInput.addEventListener('blur', function () { toggleFieldError('shop', !isValidShop(shopInput.value)); });
  phoneInput.addEventListener('blur', function () { toggleFieldError('phone', !isValidPhone(phoneInput.value)); });
  nameInput.addEventListener('focus', function () { toggleFieldError('name', false); });
  shopInput.addEventListener('focus', function () { toggleFieldError('shop', false); });
  phoneInput.addEventListener('focus', function () { toggleFieldError('phone', false); });

  consentToggle.addEventListener('click', function () {
    var willShow = consentDetail.hidden;
    consentDetail.hidden = !willShow;
    consentToggle.setAttribute('aria-expanded', String(willShow));
  });

  // ---------- 열기/닫기 ----------
  var FOCUSABLE_SEL = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function visibleFocusables() {
    return Array.prototype.slice.call(modal.querySelectorAll(FOCUSABLE_SEL)).filter(function (el) {
      return el.offsetParent !== null && el.getAttribute('tabindex') !== '-1';
    });
  }

  function onKeydown(e) {
    if (e.key === 'Escape' || e.keyCode === 27) { close(); return; }
    if (e.key !== 'Tab' && e.keyCode !== 9) return;
    var items = visibleFocusables();
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function resetForm() {
    form.reset();
    toggleFieldError('name', false);
    toggleFieldError('shop', false);
    toggleFieldError('phone', false);
    consentDetail.hidden = true;
    consentToggle.setAttribute('aria-expanded', 'false');
    updateSubmitState();
    submitBtn.textContent = SUBMIT_LABEL;
  }

  function open(triggerEl) {
    lastFocused = (triggerEl && triggerEl.focus) ? triggerEl : document.activeElement;
    resetForm();
    showView(SITE.leadFormEnabled ? 'form' : 'contact');
    backdrop.hidden = false;
    requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
    document.documentElement.classList.add('lm-scroll-lock');
    document.addEventListener('keydown', onKeydown);
    if (SITE.leadFormEnabled) setTimeout(function () { nameInput.focus(); }, 60);
    if (window.ENTER_TRACK) window.ENTER_TRACK('lead_open');
  }

  function close() {
    backdrop.classList.remove('is-open');
    document.documentElement.classList.remove('lm-scroll-lock');
    document.removeEventListener('keydown', onKeydown);
    setTimeout(function () { backdrop.hidden = true; }, 260);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
  closeBtn.addEventListener('click', close);
  confirmBtns.forEach(function (btn) { btn.addEventListener('click', close); });

  // ---------- 전송 ----------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nameOk = isValidName(nameInput.value);
    var shopOk = isValidShop(shopInput.value);
    var phoneOk = isValidPhone(phoneInput.value);
    toggleFieldError('name', !nameOk);
    toggleFieldError('shop', !shopOk);
    toggleFieldError('phone', !phoneOk);
    if (!nameOk) { nameInput.focus(); return; }
    if (!shopOk) { shopInput.focus(); return; }
    if (!phoneOk) { phoneInput.focus(); return; }
    if (!consentInput.checked) return;
    if (honeypot && honeypot.value) return; // 스팸봇 — 조용히 무시, 전송 안 함

    var attribution = {};
    try { attribution = JSON.parse(sessionStorage.getItem('enter_attribution') || '{}'); } catch (e2) { /* 무시 */ }

    var payload = {
      name: nameInput.value.trim(),
      shop_name: shopInput.value.trim(),
      phone: phoneInput.value.replace(/[^0-9]/g, ''),
      referrer: attribution.referrer || document.referrer || '',
      utm_source: attribution.utm_source || '',
      utm_medium: attribution.utm_medium || '',
      utm_campaign: attribution.utm_campaign || '',
      landing_page: attribution.landing_page || location.pathname,
      submit_page: location.pathname,
      submitted_at: new Date().toISOString(),
      consent: true
    };

    if (!SITE.leadEndpoint) {
      showView('error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '전송 중...';

    fetch(SITE.leadEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { res: res, data: data };
      });
    }).then(function (result) {
      submitBtn.textContent = SUBMIT_LABEL;
      if (!result.res.ok || !result.data.ok) { showView('error'); return; }
      showView('success');
      if (window.ENTER_TRACK) window.ENTER_TRACK('generate_lead');
    }).catch(function () {
      submitBtn.textContent = SUBMIT_LABEL;
      showView('error');
    });
  });

  // ---------- 전역 트리거: [data-lead-trigger] 전부 위임으로 받는다 ----------
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest ? e.target.closest('[data-lead-trigger]') : null;
    if (!trigger) return;
    e.preventDefault();
    open(trigger);
  });

  window.ENTER_LEAD_MODAL = { open: open, close: close };
})();
