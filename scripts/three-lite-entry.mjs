// static/home-ad.js가 실제로 쓰는 THREE 심볼만 다시 내보낸다(지시서 2026-11-09).
// esbuild가 이 파일을 번들링하면서 three.module.min.js 안에서 이 심볼들이 실제로
// 필요로 하는 코드만 남기고 나머지(로더·컨트롤·다른 렌더러 등)는 트리셰이킹으로 버린다.
export {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  Points,
  Clock,
  AdditiveBlending,
} from 'three/src/Three.js';
