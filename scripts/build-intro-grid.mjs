/* 인트로 시안3의 점묘 한국 지도를 빌드 타임에 사전계산한다.
   static/data/korea-points.json(원본 3,000개 산점도) -> static/intro/korea-grid.json(허브 좌표 + 육각 격자).
   알고리즘은 기획서/마케팅/인트로시안/시안3/intro3.html의 ready() 안 로직을 그대로 옮긴 것 —
   GS(격자 간격)·근접 판정 반경·rnd() 시드 중 어느 것도 바꾸지 않는다. 출력이 달라지면
   지도 점 위치가 기준 구현과 어긋난다. 소스가 바뀌면(korea-points.json 갱신 등) 다시 실행한다:
     node scripts/build-intro-grid.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcPath = path.join(root, 'static', 'data', 'korea-points.json');
const outPath = path.join(root, 'static', 'intro', 'korea-grid.json');

const GS = 0.024;

function rnd(s) {
  const x = Math.sin(s * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const { points: PTS } = JSON.parse(readFileSync(srcPath, 'utf-8'));

// 허브(접속 많은 지점) 찾기 — y>=0.35(북쪽) 후보 중 반경^2<0.012 안에 이웃이 가장 많은 점
let best = -1, bi = 0;
for (let i = 0; i < PTS.length; i++) {
  const q = PTS[i];
  if (q[1] < 0.35) continue;
  let n = 0;
  for (const z of PTS) {
    if ((z[0] - q[0]) ** 2 + (z[1] - q[1]) ** 2 < 0.012) n++;
  }
  if (n > best) { best = n; bi = i; }
}
const hub = PTS[bi];

// 육각 격자: 원래 점에서 가까운 칸만(섬·흩어진 점 제외)
const hash = new Map();
const key = (x, y) => Math.floor(x / .05) + ',' + Math.floor(y / .05);
PTS.forEach((q) => {
  const k = key(q[0], q[1]);
  (hash.get(k) || hash.set(k, []).get(k)).push(q);
});
const near = (x, y, r) => {
  let n = 0;
  const cx = Math.floor(x / .05), cy = Math.floor(y / .05);
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const L = hash.get((cx + i) + ',' + (cy + j));
      if (L) for (const q of L) { if ((q[0] - x) ** 2 + (q[1] - y) ** 2 < r * r) n++; }
    }
  }
  return n;
};

const grid = [];
let row = 0;
for (let y = -1; y <= 1; y += GS * .866, row++) {
  for (let x = -1 + (row % 2 ? GS / 2 : 0); x <= 1; x += GS) {
    if (near(x, y, .04) >= 2) {
      const r = rnd(Math.round(x * 997) + Math.round(y * 991) * 31);
      const d = Math.hypot(x - hub[0], y - hub[1]) / 2.0;
      grid.push([Number(x.toFixed(4)), Number(y.toFixed(4)), Number(r.toFixed(4)), Number(d.toFixed(4))]);
    }
  }
}

writeFileSync(outPath, JSON.stringify({
  hub: [Number(hub[0].toFixed(4)), Number(hub[1].toFixed(4))],
  grid
}));

console.log(`korea-grid.json: hub=${JSON.stringify(hub)} grid=${grid.length}점 -> ${outPath}`);
