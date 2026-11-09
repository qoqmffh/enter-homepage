// static/vendor/three-lite.min.js를 다시 만드는 스크립트(지시서 2026-11-14 "최적화" §1).
//
// 왜 필요한가: static/vendor/three.module.min.js(Three.js 전체 번들, ~671KB)를
// home-ad.js(광고 인트로)가 실제로 쓰는 9개 심볼만 쓰는데도 통째로 내려받고 있었다.
// esbuild로 scripts/three-lite-entry.mjs(이 9개만 re-export하는 진입점)를 번들링해서
// 필요한 코드만 남긴다.
//
// 실측(2026-11-14): 671KB -> 469KB(민) / gzip 170KB -> 123KB. 200KB(민) 목표는
// 못 미쳤다 — WebGLRenderer 자체가 트리셰이킹이 잘 안 되는 구조라서(머티리얼·라이트·
// 섀도맵 등 런타임에 뭐가 들어올지 정적으로 알 수 없어 Three.js가 내부적으로 거의
// 다 끌어안고 있음, three.js 자체의 알려진 한계) 더 줄이려면 WebGLRenderer를 직접
// 깎아 쓰는 수준의 작업이 필요해 이번 범위 밖으로 남겨둔다.
//
// 실행: scripts/ 안에서 "npm install" 한 번(three·esbuild를 받는다) 후 "npm run build:three-lite"
// 또는 "node build-three-lite.mjs". three.module.min.js를 업데이트했으면 scripts/package.json의
// three 버전도 같이 맞추고 다시 돌린다(버전이 다르면 동작이 달라질 수 있다).
import { build } from 'esbuild';
import { writeFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'static', 'vendor', 'three-lite.min.js');

const result = await build({
  entryPoints: [path.join(__dirname, 'three-lite-entry.mjs')],
  bundle: true,
  minify: true,
  format: 'esm',
  treeShaking: true,
  write: false,
  legalComments: 'none',
});

const code = result.outputFiles[0].text;
const banner = '/* static/vendor/three-lite.min.js — scripts/build-three-lite.mjs로 생성.\n   home-ad.js가 쓰는 Three.js 심볼만 남긴 트리셰이킹 번들(지시서 2026-11-14). 손으로 고치지 말 것. */\n';
writeFileSync(OUT_PATH, banner + code);

const minBytes = statSync(OUT_PATH).size;
const gzipBytes = gzipSync(code).length;
console.log('생성됨:', OUT_PATH);
console.log('민: ' + (minBytes / 1024).toFixed(1) + 'KB, gzip: ' + (gzipBytes / 1024).toFixed(1) + 'KB');
