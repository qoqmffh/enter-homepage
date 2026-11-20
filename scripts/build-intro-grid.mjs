/* 인트로(시안4 기준)의 점묘 한국 지도 + 지방 도시 + 연결선을 빌드 타임에 사전계산한다.
   static/data/korea-points.json(원본 3,000개 산점도) -> static/intro/korea-grid.json
   (허브 좌표 + 육각 격자 + 지방 도시 좌표 + 연결선 29개의 지도 좌표 끝점).
   알고리즘은 기획서/마케팅/인트로시안/시안4/intro4.html의 ready() 로직을 그대로 옮긴 것 —
   GS(격자 간격)·근접 판정 반경·rnd() 시드·도시 선택 규칙(x*.9-y 최대, 제주 y<-.72 제외)·
   연결선 선택 규칙(r<.35, 허브에서 거리>.25, 후보를 r 오름차순 정렬 후 균등 간격으로 28개)
   중 어느 것도 바꾸지 않는다. 출력이 달라지면 지도가 기준 구현과 어긋난다. 소스가 바뀌면
   (korea-points.json 갱신 등) 다시 실행한다:
     node scripts/build-intro-grid.mjs
   links의 pts(3D 호 점 배열)는 저장하지 않는다 — 지도 좌표 끝점(a,b)·lift·n만 저장하고,
   호 모양은 브라우저에서 arcPts(a,b,lift,n)로 한 번만 재계산한다(순수 함수라 결과는 같다). */
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

const GRID = []; // 원본 정밀도(선택 로직용)
let row = 0;
for (let y = -1; y <= 1; y += GS * .866, row++) {
  for (let x = -1 + (row % 2 ? GS / 2 : 0); x <= 1; x += GS) {
    if (near(x, y, .04) >= 2) {
      const r = rnd(Math.round(x * 997) + Math.round(y * 991) * 31);
      const d = Math.hypot(x - hub[0], y - hub[1]) / 2.0;
      GRID.push({ x, y, r, d });
    }
  }
}

// 지방 도시: x*.9 - y가 최대인 격자점, 제주(y<-.72) 제외
let bs = -9, city = null;
for (const q of GRID) {
  if (q.y < -.72) continue;
  const sc = q.x * .9 - q.y;
  if (sc > bs) { bs = sc; city = [q.x, q.y]; }
}

// 연결선: 첫째는 ENTER -> 지방 도시(주요, lift .22), 나머지는 r<.35·허브에서 거리>.25인
// 후보를 r 오름차순 정렬해 균등 간격으로 28개 뽑는다(lift .18). 지도 좌표 끝점만 저장.
const links = [{ a: [hub[0], hub[1]], b: city, lift: 0.22, n: 48, main: true }];
const cand = GRID
  .filter((q) => q.r < .35 && Math.hypot(q.x - hub[0], q.y - hub[1]) > .25)
  .sort((a, b) => a.r - b.r);
const step = Math.max(1, Math.floor(cand.length / 28));
for (let i = 0; i < cand.length && links.length < 29; i += step) {
  const q = cand[i];
  links.push({ a: [hub[0], hub[1]], b: [q.x, q.y], lift: 0.18, n: 32, main: false });
}

const round4 = (v) => Number(v.toFixed(4));
const grid = GRID.map((g) => [round4(g.x), round4(g.y), round4(g.r), round4(g.d)]);
const roundPt = (p) => [round4(p[0]), round4(p[1])];

writeFileSync(outPath, JSON.stringify({
  hub: roundPt(hub),
  grid,
  city: roundPt(city),
  links: links.map((l) => ({ a: roundPt(l.a), b: roundPt(l.b), lift: l.lift, n: l.n, main: l.main }))
}));

console.log(`korea-grid.json: hub=${JSON.stringify(hub)} city=${JSON.stringify(city)} grid=${grid.length}점 links=${links.length}개 -> ${outPath}`);
