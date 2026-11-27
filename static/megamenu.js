/* ENTER 메가 메뉴 — 지시서 2026-11-03(개정: 영상 미리보기 제거, 초록 CTA 카드에
   페이지 요약 표시). 열기/닫기 지연, 열 강조, CTA 카드 요약 크로스페이드를 전부
   여기서 다룬다. static/megamenu.css와 짝. 데이터는 menu_summaries(빌드 시점에
   site_header.html이 JSON 스크립트 태그로 박아 넣음)만 읽고 런타임 fetch는 없다. */
(function () {
  'use strict';
  var header = document.getElementById('hpHeader');
  var nav = document.getElementById('hpMegaNav');
  var panel = document.getElementById('hpMegaPanel');
  var grid = document.getElementById('hpMegaGrid');
  if (!header || !nav || !panel || !grid) return;

  /* 메뉴구조 개편(2026-11-27) §1 — nav 1단은 이제 드롭다운 그룹 버튼과 바로가기
     링크(취급상품·정산·DB보호·거래 시작하기)가 섞여 있다. 패널을 여닫는 건
     버튼(groupBtns)뿐이고, 인디케이터·초록 글자 이동은 둘 다(allNavItems)
     대상이다. */
  var allNavItems = Array.prototype.slice.call(nav.querySelectorAll('.hp-nav-group'));
  var groupBtns = allNavItems.filter(function (el) { return el.tagName === 'BUTTON'; });
  var directLinks = allNavItems.filter(function (el) { return el.tagName === 'A'; });
  var indicator = document.getElementById('hpNavIndicator');
  var cols = Array.prototype.slice.call(grid.querySelectorAll('.hp-mega-col[data-col]'));
  var links = Array.prototype.slice.call(grid.querySelectorAll('.hp-mega-link[data-slug]'));

  function isDesktop() { return window.matchMedia('(min-width:1024px)').matches; }
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var openTimer = null, closeTimer = null, isOpen = false;

  function setExpanded(val) {
    groupBtns.forEach(function (b) { b.setAttribute('aria-expanded', val ? 'true' : 'false'); });
  }

  /* ---------- 움직이는 밑줄 인디케이터 + 초록 글자 ----------
     nav의 data-active-group 하나로 초록 글자(static/megamenu.css)와 인디케이터 위치를
     같이 제어한다. 기본값은 템플릿이 서버에서 렌더한 현재 페이지 그룹. */
  var defaultActiveGroup = nav.getAttribute('data-active-group') || '';

  function setActiveGroup(num) {
    nav.setAttribute('data-active-group', num);
    if (!indicator) return;
    var btn = allNavItems.filter(function (b) { return b.getAttribute('data-group') === num; })[0];
    var label = btn && btn.querySelector('.hp-nav-group-label');
    if (!label) return;
    var left = label.offsetLeft;
    var width = label.offsetWidth;
    var top = label.offsetTop + label.offsetHeight + 8;
    indicator.style.transform = 'translate(' + left + 'px,' + top + 'px)';
    indicator.style.width = width + 'px';
    indicator.style.opacity = '1';
  }
  function resetActiveGroup() {
    nav.setAttribute('data-active-group', defaultActiveGroup);
    if (indicator) indicator.style.opacity = '0';
  }

  function openPanel() {
    if (!isDesktop() || isOpen) return;
    isOpen = true;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    header.classList.add('mega-open');
    setExpanded(true);
  }
  /* 패널을 "숨기기만" 하는 부분과 "인디케이터까지 기본값으로 되돌리기"를 분리했다
     (메뉴구조 개편 2026-11-27 §1) — 바로가기 링크를 호버했을 때는 패널만 닫고
     인디케이터는 그 링크 위치에 그대로 둬야 하기 때문이다(resetActiveGroup까지
     같이 부르면 250ms 뒤 인디케이터가 기본값으로 튀어버린다). */
  function hidePanel() {
    /* 마우스가 링크를 벗어날 때 이미 300ms 복귀 타이머가 걸려 있으면 그대로 두고(지시서의
       "목록에서 빠지면 300ms 뒤" 기준이 되는 그 타이머), 키보드 Escape/포커스 이탈처럼
       그 타이머가 아예 없을 때만 즉시 되돌린다 — 패널 닫힘 지연(250ms)에 또 300ms를
       더 얹어 900ms 가까이 늘어지는 것을 막는다. */
    if (ctaRevertTimer === null) revertCtaNow();
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    header.classList.remove('mega-open');
    setExpanded(false);
    grid.removeAttribute('data-hover-col');
    cols.forEach(function (c) { c.classList.remove('is-dimmed'); });
  }
  function closePanel() {
    resetActiveGroup();
    hidePanel();
  }
  function scheduleOpen() {
    clearTimeout(closeTimer); closeTimer = null;
    clearTimeout(openTimer);
    openTimer = setTimeout(openPanel, 100);
  }
  function scheduleClose() {
    clearTimeout(openTimer); openTimer = null;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closePanel, 250);
  }

  panel.addEventListener('mouseenter', scheduleOpen);
  [nav, panel].forEach(function (el) {
    el.addEventListener('mouseleave', scheduleClose);
  });

  groupBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { isOpen ? closePanel() : openPanel(); });
    btn.addEventListener('mouseenter', function () { setActiveGroup(btn.getAttribute('data-group')); scheduleOpen(); });
    btn.addEventListener('focus', function () { setActiveGroup(btn.getAttribute('data-group')); scheduleOpen(); });
  });

  /* 바로가기 링크(취급상품·정산·DB보호·거래 시작하기)는 패널이 없다 — 호버·포커스
     때 인디케이터만 그 위치로 옮기고, 열려 있던 패널은 인디케이터는 그대로 둔 채
     숨긴다. 클릭은 href 그대로 평범하게 이동한다(JS 불필요). */
  directLinks.forEach(function (a) {
    var onEnter = function () {
      clearTimeout(openTimer); openTimer = null;
      clearTimeout(closeTimer); closeTimer = null;
      setActiveGroup(a.getAttribute('data-group'));
      hidePanel();
    };
    a.addEventListener('mouseenter', onEnter);
    a.addEventListener('focus', onEnter);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) {
      closePanel();
      var activeBtn = nav.querySelector('.hp-nav-group:focus') || groupBtns[0];
      if (activeBtn) activeBtn.focus();
    }
  });

  header.addEventListener('focusout', function (e) {
    if (!header.contains(e.relatedTarget)) scheduleClose();
  });

  window.addEventListener('resize', function () {
    if (!isDesktop() && isOpen) closePanel();
  });

  /* ---------- 열 강조: 패널 안에서 마우스가 올라간 열만 잉크, 나머지는 회색 ---------- */
  cols.forEach(function (col) {
    col.addEventListener('mouseenter', function () {
      var num = col.getAttribute('data-col');
      grid.setAttribute('data-hover-col', num);
      cols.forEach(function (c) { c.classList.toggle('is-dimmed', c !== col); });
      setActiveGroup(num);
    });
  });
  grid.addEventListener('mouseleave', function () {
    grid.removeAttribute('data-hover-col');
    cols.forEach(function (c) { c.classList.remove('is-dimmed'); });
  });

  /* ---------- 초록 CTA 카드: 호버한 페이지 요약으로 글 영역만 교체 ---------- */
  var ctaText = document.getElementById('hpMegaCtaText');
  var summariesEl = document.getElementById('hpMegaSummaries');
  var ctaDefaultEl = document.getElementById('hpMegaCtaDefault');
  var summaries = {}, ctaDefault = null;
  try { summaries = JSON.parse(summariesEl.textContent); } catch (e) {}
  try { ctaDefault = JSON.parse(ctaDefaultEl.textContent); } catch (e) {}

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function defaultCtaHtml() {
    if (!ctaDefault) return '';
    return '<span class="hp-mega-cta-title">' + escapeHtml(ctaDefault.title) + '</span>' +
      '<span class="hp-mega-cta-sub">' + escapeHtml(ctaDefault.sub) + '</span>';
  }

  function summaryCtaHtml(data) {
    var html = '<span class="hp-mega-cta-eyebrow">' + escapeHtml(data.groupNum) + ' · ' + escapeHtml(data.pageLabel) + '</span>';
    html += '<h3 class="hp-mega-cta-headline">' + data.headline.map(escapeHtml).join('<br>') + '</h3>';
    if (data.numbers && data.numbers.length) {
      html += '<div class="hp-mega-cta-numbers">';
      data.numbers.forEach(function (n) {
        html += '<div class="hp-mega-cta-number"><span class="hp-mega-cta-number-value">' + escapeHtml(n.value) +
          '</span><span class="hp-mega-cta-number-label">' + escapeHtml(n.label) + '</span></div>';
      });
      html += '</div>';
    } else if (data.specialText) {
      html += '<p class="hp-mega-cta-special">' + escapeHtml(data.specialText) + '</p>';
    }
    return html;
  }

  var ctaFadeTimer = null, ctaRevertTimer = null, ctaCurrentSlug = null;

  function setCtaContent(html) {
    if (!ctaText) return;
    clearTimeout(ctaFadeTimer);
    if (reduceMotion) {
      ctaText.innerHTML = html;
      return;
    }
    ctaText.classList.add('is-fading');
    ctaFadeTimer = setTimeout(function () {
      ctaText.innerHTML = html;
      ctaText.classList.remove('is-fading');
    }, 180);
  }

  function showCtaSummary(slug) {
    var data = summaries[slug];
    if (!data || !ctaText) return;
    clearTimeout(ctaRevertTimer);
    ctaCurrentSlug = slug;
    setCtaContent(summaryCtaHtml(data));
  }
  function revertCtaNow() {
    ctaRevertTimer = null;
    if (ctaCurrentSlug === null) return;
    ctaCurrentSlug = null;
    setCtaContent(defaultCtaHtml());
  }
  function scheduleCtaRevert() {
    clearTimeout(ctaRevertTimer);
    ctaRevertTimer = setTimeout(revertCtaNow, 300);
  }

  if (ctaText && Object.keys(summaries).length) {
    links.forEach(function (link) {
      link.addEventListener('mouseenter', function () { showCtaSummary(link.getAttribute('data-slug')); });
      link.addEventListener('focus', function () { showCtaSummary(link.getAttribute('data-slug')); });
      link.addEventListener('mouseleave', scheduleCtaRevert);
    });
  }
})();
