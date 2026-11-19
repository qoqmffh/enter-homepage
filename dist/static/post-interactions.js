/* 디자인 완성 지시서(2026-11-19) Phase 4 — 블로그 글 작은 인터랙션 둘만.
   1) 작성자 줄 "링크 복사" 버튼 — 현재 URL을 복사하고 1.5초 "복사됨" 토스트.
   2) 헤더 아래 2px 읽기 진행률 바 — 본문(.post-body) 기준 스크롤 비율. */
(function () {
  'use strict';

  var copyBtn = document.querySelector('[data-copy-link]');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var toast = copyBtn.querySelector('.post-copy-toast');
      var url = window.location.href;
      var show = function () {
        if (!toast) return;
        toast.classList.add('is-shown');
        setTimeout(function () { toast.classList.remove('is-shown'); }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(show, show);
      } else {
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        show();
      }
    });
  }

  var bar = document.querySelector('[data-post-progress]');
  var body = document.querySelector('.post-body');
  if (bar && body) {
    var update = function () {
      var rect = body.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var scrolled = -rect.top;
      var pct = total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0;
      bar.style.width = pct + '%';
    };
    document.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
})();
