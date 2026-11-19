/* 디자인 완성 지시서(2026-11-19) Phase 1 — 레이아웃 자동 점검기.
   dist/*.html 전부를 1440x900(데스크톱)·390x844(모바일)로 열어서 <main> 아래
   섹션급 블록을 순서대로 보고 7개 위반 유형을 점검한다. 결과는
   기획서/마케팅/점검_1119/audit.md + 페이지·폭별 스크린샷으로 남긴다.
   영구 도구다(스크래치 아님) — 지울 때 유의. node scripts/audit_layout.mjs로 실행. */
import { chromium } from 'playwright';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
// 지시서·피드백 캡처가 있는 프로젝트 폴더(웹사이트/ 상위, git 저장소 밖)에 결과를 남긴다.
const outDir = path.join(root, '..', '기획서', '마케팅', '점검_1119');
mkdirSync(outDir, { recursive: true });

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
];

const EDGE_MIN = { 1440: 96, 390: 56 };
const TOL = 3; // px, 서브픽셀/반올림 오차 허용

function listHtmlFiles() {
  return readdirSync(distDir)
    .filter((f) => f.endsWith('.html'))
    .sort();
}

async function auditPage(page, file, viewport) {
  const violations = [];
  const url = 'file:///' + path.join(distDir, file).replace(/\\/g, '/');
  await page.goto(url);
  await page.waitForTimeout(250);
  // 하단 고정 바가 뜨는 스크롤 중간 지점까지 한 번 내려서(G 점검용) IntersectionObserver를 흔든다.
  await page.evaluate(() => window.scrollTo(0, Math.max(1, document.body.scrollHeight * 0.4)));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);

  const data = await page.evaluate((edgeMin) => {
    function bg(el) {
      let node = el;
      while (node && node !== document.documentElement) {
        const c = getComputedStyle(node).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    }
    const main = document.querySelector('main');
    if (!main) return { sections: [], orphans: [], barGap: null };
    // sp-/hp- 디자인 시스템 블록만 "섹션"으로 본다 — 블로그/가이드 본문의 무클래스 <section>
    // 조각(Phase 4 전까지는 공용 클래스가 없다)은 이 섹션 경계·여백 규칙 대상이 아니다.
    const kids = Array.from(main.children).filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const cls = (el.className || '').toString();
      return r.height > 20 && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.position !== 'fixed' && /\b(sp|hp)-/.test(cls);
    });
    const sections = kids.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // 섹션 안 첫 "내용" 자식 — 장식용 흡수 레이어(.hp-trail, ::before 등)는 제외.
      const firstChild = Array.from(el.children).find((c) => {
        const cr = c.getBoundingClientRect();
        return cr.height > 0 && !c.classList.contains('hp-trail') && getComputedStyle(c).position !== 'absolute';
      });
      const fcTop = firstChild ? firstChild.getBoundingClientRect().top - r.top : null;
      // 콘텐츠 폭 래퍼(가장 넓은 직계/손자 블록)로 편중(D) 판단.
      let wrap = null;
      const candidates = [];
      (function collect(node, depth) {
        if (depth > 2) return;
        Array.from(node.children).forEach((c) => {
          const cr = c.getBoundingClientRect();
          if (cr.width > 40 && cr.height > 40) candidates.push(c);
          collect(c, depth + 1);
        });
      })(el, 0);
      if (candidates.length) {
        wrap = candidates.reduce((a, b) => (b.getBoundingClientRect().width > a.getBoundingClientRect().width ? b : a));
      }
      const wr = wrap ? wrap.getBoundingClientRect() : null;
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: el.className || '',
        top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width,
        paddingTop: parseFloat(cs.paddingTop) || 0,
        paddingBottom: parseFloat(cs.paddingBottom) || 0,
        bg: bg(el),
        fcTop,
        wrap: wr ? { left: wr.left, right: wr.right, width: wr.width } : null,
      };
    });

    // F. 고아 링크 — <main> 안에서 "-foot" 류 클래스에 링크 하나 + 텍스트 하나뿐이고,
    // 바로 위에 그 내용을 설명하는 제목/목록이 없는 패턴. 전역 footer·모달·네비는 애초에
    // <main> 밖이라 제외되고, sp-detail-foot처럼 목록 바로 아래 붙어 맥락이 있는 것도 제외한다.
    const orphanCandidates = Array.from(main.querySelectorAll('[class*="-foot"]'));
    const orphans = orphanCandidates
      .filter((el) => {
        if (el.closest('.sp-cta, .hp-closing, [data-fn-bottombar], nav, header, [data-fn-cta-band]')) return false;
        if (el.classList.contains('sp-detail-foot')) return false; // 목록/표 바로 아래 요약행 — 맥락 있음
        const links = el.querySelectorAll('a');
        if (links.length !== 1 || el.children.length > 2) return false;
        const prev = el.previousElementSibling;
        return !prev || !/^(h1|h2|h3|h4)$/i.test(prev.tagName);
      })
      .map((el) => ({ cls: el.className, text: el.textContent.trim().slice(0, 40) }));

    // G. 고정 바 가림.
    const bar = document.querySelector('[data-fn-bottombar]');
    let barGap = null;
    if (bar) {
      const visible = bar.classList.contains('is-visible');
      const barH = bar.getBoundingClientRect().height;
      const bodyPad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
      barGap = { visible, barH, bodyPad };
    }

    return { sections, orphans, barGap };
  }, EDGE_MIN[viewport.width]);

  const edgeMin = EDGE_MIN[viewport.width];
  const secs = data.sections;
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  // A. 경계밀착 — 실제로 배경색이 바뀌는 경계(직전 섹션, 또는 첫 섹션이면 body 기본색과 다를 때)에서만
  // padding-top을 edge-min과 비교한다. 같은 배경이 이어지는 곳은 애초에 "경계"가 아니다.
  secs.forEach((s, i) => {
    const prevBg = i === 0 ? bodyBg : secs[i - 1].bg;
    if (prevBg === s.bg) return;
    if (s.paddingTop >= 0 && s.paddingTop < edgeMin - TOL) {
      violations.push({ type: 'A', page: file, vp: viewport.name, target: describeSec(s), detail: `padding-top ${Math.round(s.paddingTop)}px < edge-min ${edgeMin}px` });
    }
  });

  // B/C/E — 인접 섹션 간 간격.
  for (let i = 1; i < secs.length; i++) {
    const prev = secs[i - 1];
    const next = secs[i];
    const gap = next.top - prev.bottom;
    if (gap > edgeMin * 0.2 + TOL) {
      // 20px 이상이면 눈에 띄는 빈 띠(C), 그보다 작은데도 기준보다 크면 간격 불일치(B).
      const type = gap > 20 ? 'C' : 'B';
      violations.push({ type, page: file, vp: viewport.name, target: `${describeSec(prev)} → ${describeSec(next)}`, detail: `간격 ${Math.round(gap)}px (배경 ${prev.bg === next.bg ? '동일' : '다름'})` });
    } else if (gap < -TOL) {
      violations.push({ type: 'E', page: file, vp: viewport.name, target: `${describeSec(prev)} → ${describeSec(next)}`, detail: `겹침 ${Math.round(-gap)}px` });
    }
  }

  // D. 편중 — 콘텐츠 래퍼가 섹션 폭의 60% 미만이면서 좌우 여백이 2배 이상 차이.
  secs.forEach((s) => {
    if (!s.wrap || s.width < 200) return;
    const widthRatio = s.wrap.width / s.width;
    if (widthRatio < 0.6) {
      const leftGap = s.wrap.left - s.left;
      const rightGap = s.right - s.wrap.right;
      const lo = Math.min(leftGap, rightGap), hi = Math.max(leftGap, rightGap);
      if (hi > lo * 2 + 20) {
        violations.push({ type: 'D', page: file, vp: viewport.name, target: describeSec(s), detail: `콘텐츠 폭 ${Math.round(widthRatio * 100)}%, 좌${Math.round(leftGap)}/우${Math.round(rightGap)}px` });
      }
    }
  });

  // F. 고아 요소.
  data.orphans.forEach((o) => {
    violations.push({ type: 'F', page: file, vp: viewport.name, target: o.cls, detail: `"${o.text}"` });
  });

  // G. 고정 바 가림.
  if (data.barGap && data.barGap.visible && data.barGap.bodyPad + TOL < data.barGap.barH) {
    violations.push({ type: 'G', page: file, vp: viewport.name, target: 'body', detail: `padding-bottom ${Math.round(data.barGap.bodyPad)}px < 바 높이 ${Math.round(data.barGap.barH)}px` });
  }

  return violations;
}

function describeSec(s) {
  if (s.id) return `#${s.id}`;
  const cls = (s.cls || '').toString().split(/\s+/).filter(Boolean)[0];
  return cls ? `.${cls}` : s.tag;
}

async function main() {
  const files = listHtmlFiles();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const allViolations = [];

  for (const file of files) {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const vs = await auditPage(page, file, vp);
      allViolations.push(...vs);
      if (vs.length) {
        const shotPath = path.join(outDir, `${file.replace('.html', '')}_${vp.name}.png`);
        await page.screenshot({ path: shotPath, fullPage: true });
      }
    }
    process.stdout.write('.');
  }
  console.log('');

  await browser.close();

  const byType = {};
  allViolations.forEach((v) => { byType[v.type] = (byType[v.type] || 0) + 1; });

  const lines = [];
  lines.push('# 레이아웃 점검 결과');
  lines.push('');
  lines.push(`총 위반: ${allViolations.length}건`);
  lines.push('');
  lines.push('| 유형 | 건수 |');
  lines.push('|---|---|');
  const labels = { A: 'A 경계밀착', B: 'B 간격불일치', C: 'C 빈 띠', D: 'D 편중', E: 'E 겹침', F: 'F 고아요소', G: 'G 고정바가림' };
  Object.keys(labels).forEach((t) => lines.push(`| ${labels[t]} | ${byType[t] || 0} |`));
  lines.push('');
  lines.push('## 상세');
  lines.push('');
  allViolations.forEach((v) => {
    lines.push(`- [${v.type}] ${v.page} (${v.vp}px) — ${v.target}: ${v.detail}`);
  });
  writeFileSync(path.join(outDir, 'audit.md'), lines.join('\n') + '\n', 'utf-8');

  console.log(`위반 ${allViolations.length}건 — ${path.join(outDir, 'audit.md')}`);
  process.exitCode = allViolations.length > 0 ? 1 : 0;
}

main();
