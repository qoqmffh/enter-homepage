/* ENTER 메가 메뉴 — 지시서 2026-11-03. 열기/닫기 지연, 열 강조, 커서를 따라다니는
   미리보기 카드(지연 로드 영상)를 전부 여기서 다룬다. static/megamenu.css와 짝. */
(function () {
  'use strict';
  var header = document.getElementById('hpHeader');
  var nav = document.getElementById('hpMegaNav');
  var panel = document.getElementById('hpMegaPanel');
  var grid = document.getElementById('hpMegaGrid');
  if (!header || !nav || !panel || !grid) return;

  var groupBtns = Array.prototype.slice.call(nav.querySelectorAll('.hp-nav-group'));
  var cols = Array.prototype.slice.call(grid.querySelectorAll('.hp-mega-col[data-col]'));
  var links = Array.prototype.slice.call(grid.querySelectorAll('.hp-mega-link[data-preview]'));
  var preview = document.getElementById('hpMegaPreview');
  var previewPoster = document.getElementById('hpMegaPreviewPoster');
  var previewVideo = document.getElementById('hpMegaPreviewVideo');

  function isDesktop() { return window.matchMedia('(min-width:1024px)').matches; }
  var reduceMotion = false, canHover = true;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  try { canHover = window.matchMedia('(hover: hover)').matches; } catch (e) {}
  var previewEnabled = !reduceMotion && canHover && !!preview;

  var openTimer = null, closeTimer = null, isOpen = false;

  function setExpanded(val) {
    groupBtns.forEach(function (b) { b.setAttribute('aria-expanded', val ? 'true' : 'false'); });
  }

  function openPanel() {
    if (!isDesktop() || isOpen) return;
    isOpen = true;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    header.classList.add('mega-open');
    setExpanded(true);
  }
  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    header.classList.remove('mega-open');
    setExpanded(false);
    grid.removeAttribute('data-hover-col');
    cols.forEach(function (c) { c.classList.remove('is-dimmed'); });
    hidePreview();
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

  [nav, panel].forEach(function (el) {
    el.addEventListener('mouseenter', scheduleOpen);
    el.addEventListener('mouseleave', scheduleClose);
  });

  groupBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { isOpen ? closePanel() : openPanel(); });
    btn.addEventListener('focus', scheduleOpen);
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
      grid.setAttribute('data-hover-col', col.getAttribute('data-col'));
      cols.forEach(function (c) { c.classList.toggle('is-dimmed', c !== col); });
    });
  });
  grid.addEventListener('mouseleave', function () {
    grid.removeAttribute('data-hover-col');
    cols.forEach(function (c) { c.classList.remove('is-dimmed'); });
  });

  /* ---------- 커서를 따라다니는 미리보기 카드 ---------- */
  if (!previewEnabled) return;

  var mouseX = 0, mouseY = 0, curX = 0, curY = 0, rafId = null, previewVisible = false;
  var loadedSlug = null, currentSlug = null;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function positionPreview(x, y) {
    var w = 280, h = 175, offset = 18;
    var vw = window.innerWidth, vh = window.innerHeight;
    var left = x + offset, top = y + offset;
    if (left + w > vw - 8) left = x - offset - w;
    if (top + h > vh - 8) top = y - offset - h;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    preview.style.transform = 'translate(' + left + 'px,' + top + 'px)';
  }

  function tick() {
    curX = lerp(curX, mouseX, 0.22);
    curY = lerp(curY, mouseY, 0.22);
    positionPreview(curX, curY);
    if (previewVisible) rafId = requestAnimationFrame(tick);
    else rafId = null;
  }

  function loadVideo(slug) {
    previewPoster.src = 'static/previews/' + slug + '.webp';
    previewVideo.classList.remove('is-ready');
    if (loadedSlug === slug) {
      try { previewVideo.currentTime = 0; previewVideo.play(); } catch (e) {}
      previewVideo.classList.add('is-ready');
      return;
    }
    try { previewVideo.pause(); } catch (e) {}
    previewVideo.src = 'static/previews/' + slug + '.webm';
    previewVideo.load();
    var onReady = function () {
      if (currentSlug !== slug) return;
      previewVideo.classList.add('is-ready');
      try { previewVideo.play(); } catch (e) {}
      loadedSlug = slug;
    };
    previewVideo.addEventListener('canplay', onReady, { once: true });
  }

  function showPreview(slug) {
    currentSlug = slug;
    curX = mouseX; curY = mouseY;
    positionPreview(curX, curY);
    preview.classList.add('is-visible');
    if (!previewVisible) { previewVisible = true; tick(); }
    loadVideo(slug);
  }
  function hidePreview() {
    previewVisible = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    preview.classList.remove('is-visible');
    previewVideo.classList.remove('is-ready');
    try { previewVideo.pause(); } catch (e) {}
    currentSlug = null;
  }

  document.addEventListener('mousemove', function (e) { mouseX = e.clientX; mouseY = e.clientY; });
  links.forEach(function (link) {
    link.addEventListener('mouseenter', function () { showPreview(link.getAttribute('data-preview')); });
    link.addEventListener('mouseleave', hidePreview);
  });
})();
