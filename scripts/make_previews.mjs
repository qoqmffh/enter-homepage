// 메가 메뉴 커서 추적 미리보기용 영상 생성 — 지시서 2026-11-03 [4].
// dist/<slug>.html을 1440x900으로 열고 3초 동안 천천히 스크롤하는 장면을 녹화해
// static/previews/<slug>.webm(560px 폭) + <slug>.webp(첫 장면 포스터)로 저장한다.
// Playwright 자체 번들 ffmpeg(libvpx_vp9)로 재인코딩해 용량을 맞춘다.
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT = 'C:\\Users\\user\\Desktop\\Dev\\도매홈페이지\\웹사이트';
const DIST_BASE = 'http://127.0.0.1:8921';
const OUT_DIR = path.join(ROOT, 'static', 'previews');
const FFMPEG = 'C:\\Users\\user\\AppData\\Local\\ms-playwright\\ffmpeg-1013\\ffmpeg-win64.exe';

const SLUGS = ['why', 'about', 'stories', 'start', 'settlement', 'products', 'startup', 'blog', 'faq'];

fs.mkdirSync(OUT_DIR, { recursive: true });

async function capture(slug) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-' + slug + '-'));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: tmpDir, size: { width: 560, height: 350 } },
  });
  const page = await context.newPage();
  await page.goto(`${DIST_BASE}/${slug}.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  await page.evaluate(() => new Promise((resolve) => {
    const duration = 3000;
    const start = performance.now();
    const total = Math.min(document.documentElement.scrollHeight - window.innerHeight, window.innerHeight * 2.2);
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      window.scrollTo(0, Math.max(0, total) * eased);
      if (t < 1) requestAnimationFrame(step); else resolve();
    }
    requestAnimationFrame(step);
  }));
  await page.waitForTimeout(150);

  const video = page.video();
  await page.close();
  const rawPath = await video.path();
  await context.close();
  await browser.close();

  return rawPath;
}

function encode(slug, rawPath) {
  const outWebm = path.join(OUT_DIR, `${slug}.webm`);
  const outPng = path.join(OUT_DIR, `${slug}._poster.png`);
  const outWebp = path.join(OUT_DIR, `${slug}.webp`);
  // 녹화는 페이지 로드 대기까지 포함돼 있어서(가변 길이) 끝에서부터 3.3초를 잘라
  // 실제 스크롤 장면만 남긴다(-sseof). 3초/~300KB 목표 -> 대략 700kbps 상한.
  execFileSync(FFMPEG, ['-y', '-sseof', '-3.3', '-i', rawPath, '-t', '3', '-an', '-c:v', 'libvpx-vp9', '-b:v', '700k', '-crf', '34', '-deadline', 'good', outWebm], { stdio: 'pipe' });
  // 포스터: 같은 구간의 첫 프레임을 PNG로 뽑고(이 ffmpeg 빌드엔 libwebp 인코더가 없음)
  // Pillow로 webp 변환.
  execFileSync(FFMPEG, ['-y', '-sseof', '-3.3', '-i', rawPath, '-frames:v', '1', outPng], { stdio: 'pipe' });
  execFileSync('py', ['-c', `from PIL import Image; Image.open(r"${outPng}").save(r"${outWebp}", "WEBP", quality=82)`], { stdio: 'pipe' });
  fs.unlinkSync(outPng);
  return { outWebm, outWebp };
}

const results = [];
for (const slug of SLUGS) {
  process.stdout.write(`capturing ${slug}... `);
  const rawPath = await capture(slug);
  const { outWebm, outWebp } = encode(slug, rawPath);
  const webmSize = fs.statSync(outWebm).size;
  const webpSize = fs.statSync(outWebp).size;
  results.push({ slug, webmSize, webpSize });
  console.log(`webm=${(webmSize/1024).toFixed(1)}KB webp=${(webpSize/1024).toFixed(1)}KB`);
}

const totalWebm = results.reduce((a, r) => a + r.webmSize, 0);
console.log('\nTotal webm size:', (totalWebm / 1024 / 1024).toFixed(2), 'MB');
