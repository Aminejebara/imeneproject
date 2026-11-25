import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createNoise3D } from 'simplex-noise';

/* ------------------------------------------------------------------ */
/*  Costanti                                                           */
/* ------------------------------------------------------------------ */

const TAU = Math.PI * 2;
const noise3D = createNoise3D();

// Dimensioni di un libro (unità Three.js)
const BOOK_W = 0.72;
const BOOK_H = 1.02;
const BOOK_T = 0.21;
const COVER_T = 0.022;

const GLOBE_R = 2.65;

const GOLD = new THREE.Color('#e9c46a');
const GOLD_BRIGHT = new THREE.Color('#fff0c2');
const WARM_GLOW = new THREE.Color('#ffd384');
const CYAN = new THREE.Color('#4fdcff');
const CYAN_BRIGHT = new THREE.Color('#a8f6ff');
const GREY = new THREE.Color('#8b95a3');

const BG_BASE = new THREE.Color('#050812');
const BG_WARM = new THREE.Color('#130c06');
const BG_DIGITAL = new THREE.Color('#03121e');
const BG_COLD = new THREE.Color('#0c1016');
const BG_GLOBE = new THREE.Color('#060a18');

const KEY_COOL = new THREE.Color('#ccd8ff');
const KEY_WARM = new THREE.Color('#ffc773');
const KEY_COLD = new THREE.Color('#aab4c2');
const HEMI_COOL = new THREE.Color('#6f86d0');
const HEMI_WARM = new THREE.Color('#dfb979');
const HEMI_COLD = new THREE.Color('#9aa3ad');

// Palette copertine rinascimentali: cuoio veneziano, bordeaux, smeraldo, indaco, ocra
const COVER_COLORS = [
  '#7c1e26', '#5c1832', '#1d4c3c', '#1a2f56', '#5e3a20',
  '#8d6722', '#16464f', '#3d2a54', '#72301a', '#2c3d2a',
  '#96322b', '#233b63', '#4e2736', '#214242',
];

const LETTER_CHARS = ['L', 'I', 'B', 'E', 'R', 'A', 'M', 'D', 'Q', 'V', 'S', '&', '§', '¶', '✦'];

const KEYS = [
  'camX', 'camY', 'camZ',
  'lookX', 'lookY', 'lookZ',
  'codex', 'shelf', 'digital', 'cold', 'globe', 'warm', 'glow',
];

const preset = (o) => ({
  camX: 0, camY: 0, camZ: 14,
  lookX: 0, lookY: 0, lookZ: 0,
  codex: 0, shelf: 0, digital: 0, cold: 0, globe: 0, warm: 0.35, glow: 0,
  ...o,
});

const PRESETS = [
  preset({ camY: 0.2, camZ: 13.8, lookY: -0.25, codex: 1, warm: 0.55, glow: 0.4 }), // 0 · Home
  preset({ camX: 2.5, camY: 0.9, camZ: 10.6, lookX: 1.1, warm: 0.5 }), // 1 · Introduzione
  preset({ camX: -1.45, camY: 0.55, camZ: 7.4, lookX: 0.45, shelf: 1, warm: 1 }), // 2 · Storia
  preset({ camX: 1.55, camY: -0.25, camZ: 7.9, lookX: -0.95, digital: 1, warm: 0.12 }), // 3 · Che cosa offre
  preset({ camX: -2.9, camY: 1.9, camZ: 7.4, lookX: 0.35, lookY: 0.2, digital: 1, warm: 0.05 }), // 4 · Come funziona
  preset({ camX: 0, camY: -1.35, camZ: 6.4, lookY: 0.55, digital: 1, warm: 0.52, glow: 0.2 }), // 5 · Punti di forza
  preset({ camX: 3.4, camY: 0.35, camZ: 9.4, lookX: -0.45, digital: 0.5, cold: 1, warm: 0 }), // 6 · Limiti
  preset({ camX: 0, camY: 0.25, camZ: 9.8, lookX: -2.55, globe: 1, warm: 0.65, glow: 1.05 }), // 7 · Conclusione
  preset({ camX: 0, camY: 0.05, camZ: 11.4, lookY: 0, globe: 1, warm: 0.78, glow: 1.65 }), // 8 · Grazie
];

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (min, max) => min + Math.random() * (max - min);

function fibonacciSphere(n, i) {
  const y = 1 - ((i + 0.5) / n) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * Math.PI * (3 - Math.sqrt(5));
  return new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------------------------------------------------------------ */
/*  Shader cinematografici e particelle                                */
/* ------------------------------------------------------------------ */

// Post-processing: grana pellicola sottile, leggera aberrazione cromatica reattiva e vignetta calda
const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.0006 },
    uGrain: { value: 0.024 },
    uVignette: { value: 0.42 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uGrain;
    uniform float uVignette;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      vec2 offset = center * dist * uAberration * 2.2;

      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 col = vec3(r, g, b);

      // Vignetta morbida
      float vig = 1.0 - smoothstep(0.36, 1.15, dist * 1.45) * uVignette;
      col *= vig;

      // Grana analogica finissima
      float n = (hash(vUv * vec2(1200.0, 800.0) + fract(uTime * 13.7)) - 0.5) * uGrain;
      col += n;

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

// Polvere dorata interattiva con campo magnetico del cursore e onda d'urto al clic
const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uGlobe;
  uniform float uRot;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3 uMouse3D;
  uniform float uMouseActive;
  uniform vec3 uRippleOrigin;
  uniform float uRippleAge;
  attribute vec3 aGlobe;
  attribute float aRand;
  varying float vAlpha;
  varying float vBoost;

  vec3 rotY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  void main() {
    vec3 p = position;
    float t = uTime * (0.22 + aRand * 0.35);
    p.x += sin(t + aRand * 40.0) * 0.65;
    p.z += cos(t * 0.8 + aRand * 25.0) * 0.65;

    float h = 15.0;
    p.y = mod(p.y + uTime * (0.09 + aRand * 0.13) + h * 0.5, h) - h * 0.5;
    float edge = smoothstep(-h * 0.5, -h * 0.5 + 1.6, p.y) * (1.0 - smoothstep(h * 0.5 - 1.6, h * 0.5, p.y));

    float g = smoothstep(aRand * 0.35, aRand * 0.35 + 0.65, uGlobe);
    vec3 gp = rotY(aGlobe, uRot);
    gp += normalize(aGlobe) * sin(uTime * 1.6 + aRand * 30.0) * 0.06;
    p = mix(p, gp, g);

    // Campo interattivo attorno al cursore
    float boost = 0.0;
    if (uMouseActive > 0.01) {
      vec3 diff = p - uMouse3D;
      float d = length(diff);
      float influence = smoothstep(3.6, 0.0, d) * uMouseActive;
      vec3 dir = normalize(diff + vec3(0.0001));
      // Leggero vortice tangenziale + respingimento morbido
      vec3 swirl = cross(dir, vec3(0.0, 0.0, 1.0));
      p += (dir * 0.45 + swirl * 0.55) * influence;
      boost += influence * 0.9;
    }

    // Onda d'urto luminosa al clic
    if (uRippleAge >= 0.0 && uRippleAge < 2.4) {
      float radius = uRippleAge * 5.8;
      float d = length(p - uRippleOrigin);
      float band = exp(-pow((d - radius) * 1.35, 2.0)) * (1.0 - uRippleAge / 2.4);
      vec3 dir = normalize(p - uRippleOrigin + vec3(0.0001));
      p += dir * band * 0.75;
      boost += band * 1.4;
    }

    float twinkle = 0.58 + 0.42 * sin(uTime * (0.85 + aRand * 2.2) + aRand * 50.0);
    vAlpha = mix(edge, 1.0, g) * twinkle;
    vBoost = boost;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float sizeBoost = 1.0 + boost * 0.65;
    gl_PointSize = min(uSize * sizeBoost * (0.45 + aRand) * uPixelRatio * (8.5 / max(-mv.z, 1.0)), 68.0);
  }
`;

const pointFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vBoost;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.16, 0.0, d);
    float halo = pow(smoothstep(0.5, 0.0, d), 1.8);
    float a = halo + core * 0.65;
    vec3 col = mix(uColor, uAccent, clamp(vBoost * 0.75, 0.0, 1.0));
    col += core * 0.35;
    gl_FragColor = vec4(col, a * vAlpha * uOpacity * (1.0 + vBoost * 0.5));
    #include <colorspace_fragment>
  }
`;

// Particelle digitali
const digitalVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aAlpha;
  attribute float aRand;
  varying float vAlpha;
  varying float vBoost;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aAlpha < 0.001 ? 0.0 : min(uSize * (0.5 + aRand) * uPixelRatio * (8.5 / max(-mv.z, 1.0)), 54.0);
    float pulse = 0.65 + 0.35 * sin(uTime * 3.2 + aRand * 60.0);
    vAlpha = aAlpha * pulse;
    vBoost = step(0.86, aRand) * 0.65;
  }
`;

const fresnelVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fresnelFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.3);
    gl_FragColor = vec4(uColor, f * uOpacity);
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ */
/*  Texture procedurali su canvas                                      */
/* ------------------------------------------------------------------ */

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.16, 'rgba(255,240,198,0.82)');
  g.addColorStop(0.42, 'rgba(255,205,122,0.22)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Grana cuoio antico + cornice dorata impressa a caldo per le copertine
function makeLeatherBumpTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  // Grana fine della pelle
  for (let i = 0; i < 3600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 0.6 + Math.random() * 1.8;
    const shade = 110 + Math.floor(Math.random() * 38);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  // Cornice rinascimentale in rilievo
  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, 220, 220);
  ctx.strokeStyle = '#a8a8a8';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, 200, 200);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Texture blocco pagine con sottili righe dei fogli
function makePagesTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe2c3';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 3) {
    ctx.fillStyle = i % 6 === 0 ? 'rgba(130, 100, 58, 0.16)' : 'rgba(255, 250, 236, 0.18)';
    ctx.fillRect(0, i, 256, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Texture pergamena manoscritta/stampata per i fogli svolazzanti e il codice aperto
function makeManuscriptPageTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const ctx = c.getContext('2d');

  // Fondo pergamena calda luminosa
  const grad = ctx.createLinearGradient(0, 0, 256, 384);
  grad.addColorStop(0, '#f7ebd2');
  grad.addColorStop(0.55, '#eedbb4');
  grad.addColorStop(1, '#dfc28d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 384);

  // Sottile cornice dorata
  ctx.strokeStyle = 'rgba(176, 130, 48, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 18, 224, 348);

  // Capilettera miniato
  ctx.fillStyle = 'rgba(155, 42, 42, 0.72)';
  ctx.fillRect(28, 34, 40, 42);
  ctx.strokeStyle = '#d4a64a';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 34, 40, 42);
  ctx.fillStyle = '#f6e3a8';
  ctx.font = 'italic 700 30px "Cormorant Garamond", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('L', 48, 57);

  // Righe tipografiche aldine stilizzate
  ctx.fillStyle = 'rgba(68, 48, 26, 0.42)';
  for (let row = 0; row < 20; row++) {
    const y = 40 + row * 15;
    const xStart = row < 3 ? 78 : 28;
    const width = row % 5 === 4 ? 140 : 185 - (row % 3) * 12;
    ctx.fillRect(xStart, y, Math.max(40, width - (xStart - 28)), 3);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLetterTexture(ch) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 600 96px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 64, 68);
    tex.needsUpdate = true;
  };
  draw();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('italic 600 96px "Cormorant Garamond"').then(draw).catch(() => {});
  }
  return tex;
}

function makeGlobeLinesGeometry(r) {
  const pts = [];
  const seg = 96;
  for (let lat = -60; lat <= 60; lat += 30) {
    const phi = (lat * Math.PI) / 180;
    const y = Math.sin(phi) * r;
    const rr = Math.cos(phi) * r;
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * TAU;
      const a1 = ((s + 1) / seg) * TAU;
      pts.push(Math.cos(a0) * rr, y, Math.sin(a0) * rr, Math.cos(a1) * rr, y, Math.sin(a1) * rr);
    }
  }
  for (let m = 0; m < 8; m++) {
    const th = (m / 8) * Math.PI;
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * TAU;
      const a1 = ((s + 1) / seg) * TAU;
      pts.push(
        Math.cos(th) * Math.cos(a0) * r, Math.sin(a0) * r, Math.sin(th) * Math.cos(a0) * r,
        Math.cos(th) * Math.cos(a1) * r, Math.sin(a1) * r, Math.sin(th) * Math.cos(a1) * r,
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

// Crea una geometria pagina arcuata (lato sinistro = -1, destro = +1)
function makeCurvedLeafGeometry(side, width = 1.32, height = 1.72, arch = 0.28) {
  const geo = new THREE.PlaneGeometry(width, height, 20, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); // -w/2 .. +w/2
    const u = side > 0 ? (x + width / 2) / width : (width / 2 - x) / width; // 0 al dorso, 1 al bordo esterno
    const shiftedX = side * u * width;
    const z = Math.sin(u * Math.PI) * arch + u * 0.08;
    pos.setXYZ(i, shiftedX, pos.getY(i), z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Materiale libri con desaturazione controllabile (sezione Limiti)
function makeBookMaterial(params, desatUniform) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDesat = desatUniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uDesat;\nvoid main() {')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum), uDesat);`,
      );
  };
  return m;
}

/* ------------------------------------------------------------------ */
/*  Scena principale                                                   */
/* ------------------------------------------------------------------ */

export function createScene(canvas, { isMobile = false, reduce = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.warn('WebGL non disponibile:', err);
    document.documentElement.classList.add('no-webgl');
    return {
      setProgress() {},
      setPointer() {},
      setVelocity() {},
      triggerRipple() {},
      pulse() {},
      render() {},
    };
  }

  const BOOKS = isMobile ? 32 : 72;
  const PER_BOOK = isMobile ? 20 : 34;
  const DUST = isMobile ? 700 : 2100;
  const LOOSE_PAGES = isMobile ? 6 : 16;
  const LETTERS = isMobile ? 8 : 18;
  const SHELF_X = isMobile ? 0 : 2.15;
  const SPREAD_X = isMobile ? 6.5 : 10.8;

  const pixelRatio = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const bg = BG_BASE.clone();
  scene.background = bg;
  scene.fog = new THREE.FogExp2(bg.clone(), 0.036);

  const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.position.set(0, 0.2, 13.8);
  const look = new THREE.Vector3();

  /* ---------------- Post-Processing (Bloom + Grana + Vignetta) ---------------- */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.46, // strength
    0.58, // radius
    0.7,  // threshold
  );
  composer.addPass(bloomPass);

  const cinematicPass = new ShaderPass(CinematicShader);
  composer.addPass(cinematicPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  /* ---------------- Luci ---------------- */
  const hemi = new THREE.HemisphereLight(HEMI_COOL.clone(), new THREE.Color('#1d150e'), 1.0);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(KEY_COOL.clone(), 2.2);
  key.position.set(5.5, 7, 9);
  scene.add(key);

  const rim = new THREE.PointLight(CYAN.clone(), 34, 0, 2);
  rim.position.set(-6.5, 3.2, -2);
  scene.add(rim);

  const warmLight = new THREE.PointLight(new THREE.Color('#ffba5e'), 20, 0, 2);
  warmLight.position.set(4.5, -0.8, 6.5);
  scene.add(warmLight);

  const cursorLight = new THREE.PointLight(GOLD_BRIGHT.clone(), 0, 9, 2);
  cursorLight.position.set(0, 0, 4);
  scene.add(cursorLight);

  const leatherBump = makeLeatherBumpTexture();
  const pagesTex = makePagesTexture();
  const manuscriptTex = makeManuscriptPageTexture();
  const glowTex = makeGlowTexture();
  const desat = { value: 0 };

  /* ---------------- Codice Aperto Scultoreo (Hero Centerpiece) ---------------- */
  const codexGroup = new THREE.Group();
  codexGroup.position.set(0, -1.85, 3.2);
  codexGroup.rotation.set(-0.56, 0, 0);
  scene.add(codexGroup);

  const codexCoverMat = new THREE.MeshStandardMaterial({
    color: '#2a1812',
    roughness: 0.42,
    metalness: 0.45,
    bumpMap: leatherBump,
    bumpScale: 0.02,
    transparent: true,
    opacity: 1,
  });
  const codexGoldMat = new THREE.MeshStandardMaterial({
    color: '#f0cb75',
    emissive: '#9b6d1e',
    emissiveIntensity: 0.35,
    roughness: 0.24,
    metalness: 0.92,
    transparent: true,
    opacity: 1,
  });
  const codexPageMat = new THREE.MeshStandardMaterial({
    map: manuscriptTex,
    color: '#fff4da',
    emissive: '#3b2c12',
    emissiveIntensity: 0.25,
    roughness: 0.72,
    metalness: 0.06,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.96,
  });

  // Copertine rigide aperte a V con bordo dorato
  const coverBoardGeo = new THREE.BoxGeometry(1.42, 1.84, 0.045);
  const leftBoard = new THREE.Mesh(coverBoardGeo, codexCoverMat);
  leftBoard.position.set(-0.74, 0, -0.14);
  leftBoard.rotation.y = 0.22;
  const rightBoard = new THREE.Mesh(coverBoardGeo, codexCoverMat);
  rightBoard.position.set(0.74, 0, -0.14);
  rightBoard.rotation.y = -0.22;

  const spineCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.84, 18), codexGoldMat);
  spineCylinder.position.set(0, 0, -0.04);

  // Blocchi pagine scolpiti
  const leftBaseLeaf = new THREE.Mesh(makeCurvedLeafGeometry(-1, 1.32, 1.72, 0.22), codexPageMat);
  leftBaseLeaf.position.set(0, 0, -0.02);
  const rightBaseLeaf = new THREE.Mesh(makeCurvedLeafGeometry(1, 1.32, 1.72, 0.22), codexPageMat);
  rightBaseLeaf.position.set(0, 0, -0.02);

  codexGroup.add(leftBoard, rightBoard, spineCylinder, leftBaseLeaf, rightBaseLeaf);

  // 4 pagine superiori leggere che respirano dolcemente
  const codexFloatingLeaves = [];
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const layer = Math.floor(i / 2);
    const leafGeo = makeCurvedLeafGeometry(side, 1.28, 1.68, 0.34 + layer * 0.14);
    const leafMat = codexPageMat.clone();
    leafMat.opacity = 0.85 - layer * 0.22;
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(0, 0, 0.03 + layer * 0.03);
    leaf.userData = { side, layer, phase: i * 1.4 };
    codexFloatingLeaves.push(leaf);
    codexGroup.add(leaf);
  }

  // Stella/faro luminoso ciano-oro sopra la rilegatura del codice aperto
  const codexSparkMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: CYAN_BRIGHT.clone(),
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const codexSpark = new THREE.Sprite(codexSparkMat);
  codexSpark.position.set(0, 0.25, 0.65);
  codexSpark.scale.set(2.4, 2.4, 1);
  codexGroup.add(codexSpark);

  const codexRingGeo = new THREE.RingGeometry(0.46, 0.485, 64);
  const codexRingMat = new THREE.MeshBasicMaterial({
    color: GOLD_BRIGHT,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const codexRing = new THREE.Mesh(codexRingGeo, codexRingMat);
  codexRing.position.set(0, 0.22, 0.58);
  codexGroup.add(codexRing);

  /* ---------------- Libri (InstancedMesh con bande dorate sul dorso) ---------------- */
  const front = new THREE.BoxGeometry(BOOK_W, BOOK_H, COVER_T);
  front.translate(0, 0, BOOK_T / 2 - COVER_T / 2);
  const back = front.clone();
  back.translate(0, 0, -(BOOK_T - COVER_T));
  const spine = new THREE.BoxGeometry(COVER_T, BOOK_H, BOOK_T);
  spine.translate(-BOOK_W / 2 + COVER_T / 2, 0, 0);
  const coverGeo = mergeGeometries([front, back, spine]);

  // 4 nervi dorati in rilievo lungo il dorso di ciascun volume
  const bandGeos = [-0.34, -0.14, 0.14, 0.34].map((yPos) => {
    const g = new THREE.BoxGeometry(0.016, 0.022, BOOK_T + 0.012);
    g.translate(-BOOK_W / 2 + 0.004, yPos, 0);
    return g;
  });
  const spineBandsGeo = mergeGeometries(bandGeos);

  const pagesGeo = new THREE.BoxGeometry(BOOK_W - 0.04, BOOK_H - 0.04, BOOK_T - COVER_T * 2 - 0.004);
  pagesGeo.translate(0.005, 0, 0);

  const coverMat = makeBookMaterial({
    roughness: 0.48,
    metalness: 0.22,
    bumpMap: leatherBump,
    bumpScale: 0.018,
  }, desat);
  const pagesMat = makeBookMaterial({
    color: '#f2e6ca',
    map: pagesTex,
    roughness: 0.9,
    metalness: 0.02,
  }, desat);
  const goldBandsMat = makeBookMaterial({
    color: '#f2cf7c',
    emissive: '#6e4c10',
    emissiveIntensity: 0.28,
    roughness: 0.24,
    metalness: 0.92,
  }, desat);

  const covers = new THREE.InstancedMesh(coverGeo, coverMat, BOOKS);
  const pages = new THREE.InstancedMesh(pagesGeo, pagesMat, BOOKS);
  const goldBands = new THREE.InstancedMesh(spineBandsGeo, goldBandsMat, BOOKS);
  [covers, pages, goldBands].forEach((mesh) => {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
  });

  // Orientamenti scaffale
  const qUpright = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)),
  );
  const qFlat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)),
  );
  const AXIS_Y = new THREE.Vector3(0, 1, 0);
  const AXIS_Z = new THREE.Vector3(0, 0, 1);

  const ROWS = 4;
  const perRow = Math.ceil(BOOKS / ROWS);
  const flatPerRow = Math.max(1, Math.floor(perRow / 5));
  const uprightPerRow = perRow - flatPerRow;
  const SPACING = 0.235;
  const rowWidth = uprightPerRow * SPACING + 0.18 + BOOK_H;
  const rowYs = [];

  const books = [];
  const tmpColor = new THREE.Color();
  for (let i = 0; i < BOOKS; i++) {
    const row = Math.floor(i / perRow);
    const k = i % perRow;
    const rowY = (row - (ROWS - 1) / 2) * 1.38 - 0.42;
    if (k === 0) rowYs.push(rowY);
    const startX = SHELF_X - rowWidth / 2;

    const shelfPos = new THREE.Vector3();
    const shelfQ = new THREE.Quaternion();
    let shelfScale;
    if (k < uprightPerRow) {
      shelfScale = rand(0.86, 1.08);
      shelfPos.set(startX + k * SPACING + SPACING / 2, rowY + (BOOK_H * shelfScale) / 2, rand(-0.06, 0.06));
      shelfQ.copy(qUpright).premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, rand(-0.045, 0.045)));
    } else {
      const j = k - uprightPerRow;
      shelfScale = 1;
      shelfPos.set(
        startX + uprightPerRow * SPACING + 0.18 + BOOK_H / 2,
        rowY + BOOK_T / 2 + j * (BOOK_T + 0.005),
        rand(-0.04, 0.04),
      );
      shelfQ.copy(qFlat).premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y, rand(-0.12, 0.12)));
    }

    // Teniamo lo spazio centrale più libero in Home attorno al codice aperto
    let sx = rand(-SPREAD_X, SPREAD_X);
    let sy = rand(-5.5, 5.5);
    let sz = rand(-15, 2.2);
    if (Math.abs(sx) < 2.6 && Math.abs(sy) < 2.2 && sz > -2) {
      sx += sx < 0 ? -3.0 : 3.0;
    }

    books.push({
      scatterPos: new THREE.Vector3(sx, sy, sz),
      rot: new THREE.Vector3(rand(0, TAU), rand(0, TAU), rand(0, TAU)),
      spin: new THREE.Vector3(rand(-0.22, 0.22), rand(-0.28, 0.28), rand(-0.18, 0.18)),
      phase: rand(0, TAU),
      noiseSeed: rand(0, 100),
      scatterScale: rand(0.78, 1.24),
      shelfPos,
      shelfQ,
      shelfScale,
      globeDir: fibonacciSphere(BOOKS, i),
      delay: Math.random(),
      pos: new THREE.Vector3(),
      size: 1,
      dissolve: 0,
    });

    tmpColor.set(COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)]);
    covers.setColorAt(i, tmpColor);
  }
  covers.instanceColor.needsUpdate = true;

  // Mensole in noce antico con filetto d'ottone
  const plankMat = new THREE.MeshStandardMaterial({ color: '#3b2414', roughness: 0.72, metalness: 0.1, transparent: true, opacity: 0 });
  const plankTrimMat = new THREE.MeshStandardMaterial({ color: '#d4a64a', roughness: 0.3, metalness: 0.85, transparent: true, opacity: 0 });
  const plankGeo = new THREE.BoxGeometry(rowWidth + 0.55, 0.065, 0.98);
  const trimGeo = new THREE.BoxGeometry(rowWidth + 0.56, 0.012, 0.02);
  const planks = new THREE.Group();
  rowYs.forEach((y) => {
    const plank = new THREE.Mesh(plankGeo, plankMat);
    plank.position.set(SHELF_X, y - 0.032, 0);
    const trim = new THREE.Mesh(trimGeo, plankTrimMat);
    trim.position.set(SHELF_X, y - 0.005, 0.49);
    planks.add(plank, trim);
  });
  planks.visible = false;
  scene.add(planks);

  /* ---------------- Pagine sciolte svolazzanti (Simplex Noise) ---------------- */
  const loosePageGeo = new THREE.PlaneGeometry(0.46, 0.64, 8, 8);
  {
    const pos = loosePageGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 5.2) * 0.055 + Math.cos(y * 3.8) * 0.03);
    }
    loosePageGeo.computeVertexNormals();
  }
  const loosePageMat = new THREE.MeshStandardMaterial({
    map: manuscriptTex,
    color: '#fff2d2',
    emissive: '#453114',
    emissiveIntensity: 0.18,
    roughness: 0.75,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
  });
  const loosePages = [];
  for (let i = 0; i < LOOSE_PAGES; i++) {
    const m = new THREE.Mesh(loosePageGeo, loosePageMat);
    m.userData = {
      base: new THREE.Vector3(rand(-SPREAD_X * 0.9, SPREAD_X * 0.9), rand(-4.8, 4.8), rand(-9, 3.2)),
      rot: new THREE.Vector3(rand(0, TAU), rand(0, TAU), rand(0, TAU)),
      seed: rand(0, 100),
      scale: rand(0.7, 1.15),
    };
    m.scale.setScalar(m.userData.scale);
    loosePages.push(m);
    scene.add(m);
  }

  /* ---------------- Polvere dorata interattiva ---------------- */
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  const dustGlobe = new Float32Array(DUST * 3);
  const dustRand = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = rand(-SPREAD_X - 2, SPREAD_X + 2);
    dustPos[i * 3 + 1] = rand(-7.5, 7.5);
    dustPos[i * 3 + 2] = rand(-16, 6.5);
    const dir = fibonacciSphere(DUST, i);
    const r = Math.random() < 0.2 ? GLOBE_R * rand(0.18, 0.95) : GLOBE_R * (1 + Math.pow(Math.random(), 2) * 0.48);
    dustGlobe[i * 3] = dir.x * r;
    dustGlobe[i * 3 + 1] = dir.y * r;
    dustGlobe[i * 3 + 2] = dir.z * r;
    dustRand[i] = Math.random();
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aGlobe', new THREE.BufferAttribute(dustGlobe, 3));
  dustGeo.setAttribute('aRand', new THREE.BufferAttribute(dustRand, 1));

  const dustMat = new THREE.ShaderMaterial({
    vertexShader: dustVertex,
    fragmentShader: pointFragment,
    uniforms: {
      uTime: { value: 0 },
      uGlobe: { value: 0 },
      uRot: { value: 0 },
      uSize: { value: isMobile ? 7.5 : 6.5 },
      uPixelRatio: { value: pixelRatio },
      uColor: { value: GOLD.clone() },
      uAccent: { value: CYAN_BRIGHT.clone() },
      uOpacity: { value: 0.9 },
      uMouse3D: { value: new THREE.Vector3(999, 999, 999) },
      uMouseActive: { value: 0 },
      uRippleOrigin: { value: new THREE.Vector3() },
      uRippleAge: { value: 10 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  /* ---------------- Particelle digitali + Filamenti di costellazione ---------------- */
  const DIGI = BOOKS * PER_BOOK;
  const GRID_Y = -2.6;
  const digiGeo = new THREE.BufferGeometry();
  const digiPos = new Float32Array(DIGI * 3);
  const digiAlpha = new Float32Array(DIGI);
  const digiRand = new Float32Array(DIGI);
  const digiOff = new Float32Array(DIGI * 3);
  const digiBase = new Float32Array(DIGI * 3);
  const digiType = new Uint8Array(DIGI);
  const digiSpeed = new Float32Array(DIGI);
  const digiGlobe = new Float32Array(DIGI * 3);

  const gridCount = Math.floor(DIGI * 0.62);
  const cols = Math.ceil(Math.sqrt(gridCount * 1.8));
  const rows = Math.ceil(gridCount / cols);
  const gridW = isMobile ? 10 : 19;
  const slots = shuffle([...Array(DIGI).keys()]);

  for (let i = 0; i < DIGI; i++) {
    digiRand[i] = Math.random();
    digiOff[i * 3] = rand(-BOOK_W / 2, BOOK_W / 2);
    digiOff[i * 3 + 1] = rand(-BOOK_H / 2, BOOK_H / 2);
    digiOff[i * 3 + 2] = rand(-BOOK_T / 2, BOOK_T / 2);

    const slot = slots[i];
    if (slot < gridCount) {
      const c = slot % cols;
      const r = Math.floor(slot / cols);
      digiType[i] = 0;
      digiBase[i * 3] = -gridW / 2 + (c / Math.max(1, cols - 1)) * gridW;
      digiBase[i * 3 + 2] = -10.5 + (r / Math.max(1, rows - 1)) * 13.5;
    } else {
      digiType[i] = 1;
      digiBase[i * 3] = rand(0, TAU);
      digiBase[i * 3 + 1] = rand(-5, 5);
      digiBase[i * 3 + 2] = rand(3.5, isMobile ? 6.5 : 9.5);
      digiSpeed[i] = rand(0.4, 1.25);
    }

    const dir = fibonacciSphere(DIGI, i);
    const gr = GLOBE_R * rand(0.98, 1.06);
    digiGlobe[i * 3] = dir.x * gr;
    digiGlobe[i * 3 + 1] = dir.y * gr;
    digiGlobe[i * 3 + 2] = dir.z * gr;
  }

  digiGeo.setAttribute('position', new THREE.BufferAttribute(digiPos, 3).setUsage(THREE.DynamicDrawUsage));
  digiGeo.setAttribute('aAlpha', new THREE.BufferAttribute(digiAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  digiGeo.setAttribute('aRand', new THREE.BufferAttribute(digiRand, 1));

  const digiMat = new THREE.ShaderMaterial({
    vertexShader: digitalVertex,
    fragmentShader: pointFragment,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: isMobile ? 8 : 7.2 },
      uPixelRatio: { value: pixelRatio },
      uColor: { value: CYAN.clone() },
      uAccent: { value: GOLD_BRIGHT.clone() },
      uOpacity: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const digital = new THREE.Points(digiGeo, digiMat);
  digital.frustumCulled = false;
  digital.visible = false;
  scene.add(digital);

  // Filamenti di costellazione (linee leggere che collegano nodi vicini nella fase digitale)
  const MAX_LINKS = isMobile ? 90 : 210;
  const linkPos = new Float32Array(MAX_LINKS * 2 * 3);
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3).setUsage(THREE.DynamicDrawUsage));
  linkGeo.setDrawRange(0, 0);
  const linkMat = new THREE.LineBasicMaterial({
    color: CYAN.clone(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const constellationLines = new THREE.LineSegments(linkGeo, linkMat);
  constellationLines.frustumCulled = false;
  constellationLines.visible = false;
  scene.add(constellationLines);

  /* ---------------- Lettere calligrafiche fluttuanti ---------------- */
  const letterTextures = {};
  const letters = [];
  for (let i = 0; i < LETTERS; i++) {
    const ch = LETTER_CHARS[i % LETTER_CHARS.length];
    if (!letterTextures[ch]) letterTextures[ch] = makeLetterTexture(ch);
    const mat = new THREE.SpriteMaterial({
      map: letterTextures[ch],
      color: GOLD.clone(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    const s = rand(0.48, 1.15);
    sprite.scale.set(s, s, 1);
    sprite.userData = {
      base: new THREE.Vector3(rand(-SPREAD_X, SPREAD_X), rand(-4.6, 4.6), rand(-10, 2.2)),
      phase: rand(0, TAU),
      spin: rand(-0.2, 0.2),
    };
    letters.push(sprite);
    scene.add(sprite);
  }

  /* ---------------- Globo celeste + Sfere armillari rinascimentali ---------------- */
  const globeGroup = new THREE.Group();
  globeGroup.visible = false;
  scene.add(globeGroup);

  const atmosphereMat = new THREE.ShaderMaterial({
    vertexShader: fresnelVertex,
    fragmentShader: fresnelFragment,
    uniforms: { uColor: { value: CYAN_BRIGHT.clone() }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R * 1.13, 56, 36), atmosphereMat);
  globeGroup.add(atmosphere);

  const linesMat = new THREE.LineBasicMaterial({
    color: CYAN.clone(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const globeLines = new THREE.LineSegments(makeGlobeLinesGeometry(GLOBE_R * 0.99), linesMat);
  globeGroup.add(globeLines);

  // 3 anelli armillari dorati rotanti attorno al globo (Rinascimento + Internet)
  const armillaryMat = new THREE.MeshStandardMaterial({
    color: '#f2cf7e',
    emissive: '#a87822',
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.92,
    transparent: true,
    opacity: 0,
  });
  const armillaryRings = [
    { r: GLOBE_R * 1.24, tube: 0.014, rx: 0.42, rz: 0.18, speed: 0.22 },
    { r: GLOBE_R * 1.38, tube: 0.011, rx: -0.78, rz: 0.55, speed: -0.17 },
    { r: GLOBE_R * 1.52, tube: 0.008, rx: 1.12, rz: -0.35, speed: 0.13 },
  ].map((cfg) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(cfg.r, cfg.tube, 12, 128), armillaryMat);
    mesh.rotation.set(cfg.rx, 0, cfg.rz);
    mesh.userData = cfg;
    globeGroup.add(mesh);
    return mesh;
  });

  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: WARM_GLOW.clone(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  globeGroup.add(glow);

  /* ---------------- Stato & interpolazione ---------------- */
  let progress = 0;
  let scrollVelocity = 0;
  let pulseEnergy = 0;
  let rippleAge = 10;
  const target = { ...PRESETS[0] };
  const cur = { ...PRESETS[0] };
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  let pointerEntered = false;
  const pointerAmount = reduce ? 0 : 1;

  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const mouseWorld = new THREE.Vector3(999, 999, 999);
  const mouseWorldSmooth = new THREE.Vector3(0, 0, 0);

  function computeTarget() {
    const p = Math.min(Math.max(progress, 0), PRESETS.length - 1);
    const i = Math.floor(p);
    const j = Math.min(i + 1, PRESETS.length - 1);
    const f = smooth(p - i);
    for (const k of KEYS) target[k] = lerp(PRESETS[i][k], PRESETS[j][k], f);
  }

  /* ---------------- Aggiornamenti per frame ---------------- */
  const _p = new THREE.Vector3();
  const _g = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _qg = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _s = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _c = new THREE.Color();

  function updateCodex(t) {
    const vis = smooth(cur.codex);
    codexGroup.visible = vis > 0.005;
    if (!codexGroup.visible) return;

    const bob = Math.sin(t * 0.95) * 0.14;
    const scale = 0.68 + vis * 0.34;
    codexGroup.scale.setScalar(scale);
    codexGroup.position.set(
      pointerSmooth.x * 0.35 * pointerAmount,
      -1.82 + bob + (1 - vis) * 1.4,
      3.15 - (1 - vis) * 2.2,
    );
    codexGroup.rotation.set(
      -0.58 + Math.sin(t * 0.5) * 0.05 - pointerSmooth.y * 0.12 * pointerAmount,
      Math.sin(t * 0.38) * 0.14 + pointerSmooth.x * 0.18 * pointerAmount,
      Math.cos(t * 0.42) * 0.04,
    );

    codexCoverMat.opacity = vis;
    codexGoldMat.opacity = vis;
    codexPageMat.opacity = vis * 0.96;
    codexSparkMat.opacity = vis * (0.62 + 0.18 * Math.sin(t * 2.4) + pulseEnergy * 0.35);
    const sparkScale = 2.2 + 0.35 * Math.sin(t * 2.0) + pulseEnergy * 0.8;
    codexSpark.scale.set(sparkScale, sparkScale, 1);
    codexRingMat.opacity = vis * 0.4;
    codexRing.rotation.z = t * 0.32;
    codexRing.rotation.x = Math.sin(t * 0.5) * 0.25;

    for (const leaf of codexFloatingLeaves) {
      const { side, layer, phase } = leaf.userData;
      const flutter = Math.sin(t * 1.35 + phase) * 0.09 + noise3D(t * 0.3, phase, layer) * 0.05;
      leaf.rotation.y = side * (0.12 + layer * 0.14) + flutter;
      leaf.material.opacity = vis * (0.86 - layer * 0.24);
    }
  }

  function updateBooks(t, rot) {
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    for (let i = 0; i < BOOKS; i++) {
      const b = books[i];

      // 1) Libri sospesi guidati da simplex noise
      const nx = noise3D(b.noiseSeed, t * 0.14, 0) * 0.65;
      const ny = noise3D(b.noiseSeed + 31.7, t * 0.16, 1.3) * 0.65;
      const nz = noise3D(b.noiseSeed + 63.1, t * 0.12, 2.7) * 0.5;

      _p.set(
        b.scatterPos.x + nx,
        b.scatterPos.y + ny,
        b.scatterPos.z + nz,
      );
      _e.set(b.rot.x + t * b.spin.x, b.rot.y + t * b.spin.y, b.rot.z + t * b.spin.z);
      _q.setFromEuler(_e);
      let s = b.scatterScale;

      // 2) Scaffale (Storia)
      const sh = smooth(cur.shelf * 1.4 - b.delay * 0.4);
      if (sh > 0) {
        _p.lerp(b.shelfPos, sh);
        _q.slerp(b.shelfQ, sh);
        s = lerp(s, b.shelfScale, sh);
      }

      // 3) Globo (Conclusione)
      const ge = smooth(cur.globe * 1.4 - b.delay * 0.4);
      if (ge > 0) {
        const d = b.globeDir;
        _g.set(cosR * d.x + sinR * d.z, d.y, -sinR * d.x + cosR * d.z);
        _qg.setFromUnitVectors(AXIS_Z, _g);
        _g.multiplyScalar(GLOBE_R + 0.16);
        _p.lerp(_g, ge);
        _q.slerp(_qg, ge);
      }

      b.pos.copy(_p);
      b.size = s;

      // 4) Dissoluzione digitale
      const dis = smooth(cur.digital * 1.5 - b.delay * 0.5);
      b.dissolve = dis;

      let finalScale = s * (1 - dis);
      finalScale = lerp(finalScale, 0.28, ge);
      _s.setScalar(Math.max(finalScale, 1e-4));
      _m.compose(_p, _q, _s);
      covers.setMatrixAt(i, _m);
      pages.setMatrixAt(i, _m);
      goldBands.setMatrixAt(i, _m);
    }
    covers.instanceMatrix.needsUpdate = true;
    pages.instanceMatrix.needsUpdate = true;
    goldBands.instanceMatrix.needsUpdate = true;
  }

  function updateLoosePages(t) {
    const vis = (1 - cur.digital * 0.85) * (1 - cur.globe * 0.9) * (1 - cur.cold * 0.4);
    loosePageMat.opacity = vis * 0.68;
    const show = vis > 0.02;
    for (const pg of loosePages) {
      pg.visible = show;
      if (!show) continue;
      const u = pg.userData;
      const nt = t * 0.22;
      pg.position.set(
        u.base.x + noise3D(u.seed, nt, 0) * 1.3,
        u.base.y + noise3D(u.seed + 19, nt, 1) * 1.1,
        u.base.z + noise3D(u.seed + 41, nt, 2) * 0.9,
      );
      pg.rotation.set(
        u.rot.x + Math.sin(t * 0.6 + u.seed) * 0.45,
        u.rot.y + t * 0.25 + noise3D(u.seed, nt, 3) * 0.5,
        u.rot.z + Math.cos(t * 0.5 + u.seed) * 0.35,
      );
    }
  }

  function updateDigital(t, rot) {
    if (cur.digital < 0.001 && cur.globe < 0.001) {
      digital.visible = false;
      constellationLines.visible = false;
      return;
    }
    digital.visible = true;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const g = cur.globe;

    for (let i = 0; i < BOOKS; i++) {
      const b = books[i];
      const dis = b.dissolve;
      for (let k = 0; k < PER_BOOK; k++) {
        const idx = i * PER_BOOK + k;
        const i3 = idx * 3;
        const r = digiRand[idx];

        let x = b.pos.x + digiOff[i3] * b.size;
        let y = b.pos.y + digiOff[i3 + 1] * b.size;
        let z = b.pos.z + digiOff[i3 + 2] * b.size;
        let a = 0;

        if (dis > 0) {
          const flow = smooth((dis - r * 0.3) / 0.7);
          let tx;
          let ty;
          let tz;
          let edge = 1;
          if (digiType[idx] === 0) {
            tx = digiBase[i3];
            tz = digiBase[i3 + 2];
            ty = GRID_Y + Math.sin(tx * 0.55 + t * 1.15) * 0.3 + Math.cos(tz * 0.45 + t * 0.85) * 0.3;
          } else {
            const ang = digiBase[i3] + t * 0.06 * (0.5 + r);
            const rad = digiBase[i3 + 2];
            tx = Math.cos(ang) * rad;
            tz = Math.sin(ang) * rad - 3;
            ty = ((((digiBase[i3 + 1] + t * digiSpeed[idx] + 5) % 10) + 10) % 10) - 5;
            edge = smooth((ty + 5) / 1.5) * smooth((5 - ty) / 1.5);
          }
          x = lerp(x, tx, flow);
          y = lerp(y, ty, flow);
          z = lerp(z, tz, flow);
          a = smooth(dis * 3) * lerp(1, edge, flow);
        }

        if (g > 0) {
          const ge = smooth(g * 1.4 - r * 0.4);
          if (ge > 0) {
            const gx = digiGlobe[i3];
            const gy = digiGlobe[i3 + 1];
            const gz = digiGlobe[i3 + 2];
            x = lerp(x, cosR * gx + sinR * gz, ge);
            y = lerp(y, gy, ge);
            z = lerp(z, -sinR * gx + cosR * gz, ge);
            a = Math.max(a, ge);
          }
        }

        digiPos[i3] = x;
        digiPos[i3 + 1] = y;
        digiPos[i3 + 2] = z;
        digiAlpha[idx] = a;
      }
    }
    digiGeo.attributes.position.needsUpdate = true;
    digiGeo.attributes.aAlpha.needsUpdate = true;

    // Costellazione di filamenti tra un sottoinsieme leggero di nodi attivi
    const linkStrength = Math.max(cur.digital * (1 - cur.cold * 0.7), cur.globe * 0.85);
    if (linkStrength > 0.08) {
      constellationLines.visible = true;
      linkMat.opacity = linkStrength * 0.16;
      linkMat.color.copy(CYAN).lerp(GOLD_BRIGHT, cur.globe * 0.55);

      let count = 0;
      const step = Math.max(1, Math.floor(DIGI / 88));
      const maxDistSq = cur.globe > 0.5 ? 2.4 : 4.2;
      for (let i = 0; i < DIGI && count < MAX_LINKS; i += step) {
        if (digiAlpha[i] < 0.35) continue;
        const ix = digiPos[i * 3];
        const iy = digiPos[i * 3 + 1];
        const iz = digiPos[i * 3 + 2];
        for (let j = i + step; j < DIGI && count < MAX_LINKS; j += step) {
          if (digiAlpha[j] < 0.35) continue;
          const dx = ix - digiPos[j * 3];
          const dy = iy - digiPos[j * 3 + 1];
          const dz = iz - digiPos[j * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < maxDistSq && d2 > 0.15) {
            const base = count * 6;
            linkPos[base] = ix;
            linkPos[base + 1] = iy;
            linkPos[base + 2] = iz;
            linkPos[base + 3] = digiPos[j * 3];
            linkPos[base + 4] = digiPos[j * 3 + 1];
            linkPos[base + 5] = digiPos[j * 3 + 2];
            count++;
          }
        }
      }
      linkGeo.setDrawRange(0, count * 2);
      linkGeo.attributes.position.needsUpdate = true;
    } else {
      constellationLines.visible = false;
    }
  }

  function updateLetters(t) {
    const visibility = 0.58 * (1 - cur.digital * 0.7) * (1 - cur.globe) * (1 - cur.shelf * 0.45);
    for (const sp of letters) {
      const u = sp.userData;
      sp.position.set(
        u.base.x + Math.sin(t * 0.22 + u.phase) * 0.65,
        u.base.y + Math.sin(t * 0.34 + u.phase * 2.0) * 0.55,
        u.base.z,
      );
      sp.material.rotation = Math.sin(t * 0.3 + u.phase) * 0.4 + t * u.spin;
      sp.material.opacity = visibility * (0.6 + 0.4 * Math.sin(t * 0.8 + u.phase));
      sp.material.color.copy(dustMat.uniforms.uColor.value);
      sp.visible = visibility > 0.005;
    }
  }

  function updateAtmosphere(t, rot) {
    bg.copy(BG_BASE)
      .lerp(BG_WARM, cur.warm * 0.85)
      .lerp(BG_DIGITAL, cur.digital * 0.75)
      .lerp(BG_COLD, cur.cold)
      .lerp(BG_GLOBE, cur.globe * 0.55);
    scene.fog.color.copy(bg);
    scene.fog.density = 0.036 + cur.cold * 0.03 - cur.globe * 0.012;

    key.color.copy(KEY_COOL).lerp(KEY_WARM, cur.warm).lerp(KEY_COLD, cur.cold);
    key.intensity = 1.7 + cur.warm * 1.45 - cur.cold * 0.5 + pulseEnergy * 0.6;
    hemi.color.copy(HEMI_COOL).lerp(HEMI_WARM, cur.warm).lerp(HEMI_COLD, cur.cold);
    rim.color.copy(CYAN).lerp(GREY, cur.cold * 0.8);
    rim.intensity = 28 + cur.digital * 65 - cur.cold * 16 + pulseEnergy * 30;
    warmLight.intensity = cur.warm * 48 * (1 - cur.cold) + cur.codex * 24;
    desat.value = cur.cold * 0.85;
    renderer.toneMappingExposure = 1.06 + cur.glow * 0.09 + pulseEnergy * 0.08;

    // Bloom dinamico calibrato per capitolo
    bloomPass.strength = 0.42 + cur.glow * 0.18 + cur.digital * 0.08 - cur.cold * 0.16 + pulseEnergy * 0.22;
    bloomPass.radius = 0.52 + cur.glow * 0.15;

    // Aberrazione cromatica dinamica legata alla velocità di scroll
    const velMag = Math.min(Math.abs(scrollVelocity) * 0.00018, 0.0038);
    cinematicPass.uniforms.uAberration.value = 0.00045 + velMag + pulseEnergy * 0.0012;
    cinematicPass.uniforms.uTime.value = t;

    _c.copy(GOLD).lerp(CYAN, cur.digital * 0.48).lerp(GREY, cur.cold * 0.85).lerp(WARM_GLOW, cur.globe * 0.82);
    dustMat.uniforms.uColor.value.copy(_c);
    dustMat.uniforms.uOpacity.value = 0.9 * (1 - cur.cold * 0.35) + cur.glow * 0.1;
    digiMat.uniforms.uColor.value.copy(CYAN).lerp(GREY, cur.cold * 0.8).lerp(CYAN_BRIGHT, cur.globe * 0.55);

    // Mensole
    const plankOp = smooth(cur.shelf * 1.3 - 0.3);
    plankMat.opacity = plankOp;
    plankTrimMat.opacity = plankOp * 0.9;
    planks.visible = plankOp > 0.01;

    // Globo + Sfere Armillari
    const g = cur.globe;
    globeGroup.visible = g > 0.001;
    if (globeGroup.visible) {
      const pulse = 0.92 + 0.08 * Math.sin(t * 2.1);
      globeLines.rotation.y = rot;
      linesMat.opacity = g * 0.2;
      atmosphereMat.uniforms.uOpacity.value = g * (0.65 + cur.glow * 0.22);
      glowMat.opacity = g * (0.55 + cur.glow * 0.16) * pulse;
      const gs = GLOBE_R * (2.7 + cur.glow * 0.5) * (0.4 + g * 0.6);
      glow.scale.set(gs, gs, 1);

      armillaryMat.opacity = g * 0.72;
      for (const ring of armillaryRings) {
        const cfg = ring.userData;
        ring.rotation.y = t * cfg.speed;
        ring.rotation.x = cfg.rx + Math.sin(t * 0.35) * 0.12;
      }
    }
  }

  function updateCamera(dt) {
    const narrow = camera.aspect < 0.85;
    const kx = narrow ? 0.3 : 1;
    const kl = narrow ? 0.15 : 1;
    const kz = narrow ? 1.35 : 1;

    // Respiro sottile del FOV in base alla velocità di scroll
    const targetFov = 44 + Math.min(Math.abs(scrollVelocity) * 0.16, 4.5);
    camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-dt * 6));
    camera.updateProjectionMatrix();

    camera.position.set(
      cur.camX * kx + pointerSmooth.x * 0.72 * pointerAmount,
      cur.camY - pointerSmooth.y * 0.48 * pointerAmount,
      cur.camZ * kz,
    );
    look.set(
      cur.lookX * kl + pointerSmooth.x * 0.18 * pointerAmount,
      cur.lookY - pointerSmooth.y * 0.12 * pointerAmount,
      cur.lookZ,
    );
    camera.lookAt(look);

    // Proiezione 3D del puntatore per luce e forza sulle particelle
    if (pointerEntered && !reduce && !isMobile) {
      raycaster.setFromCamera(new THREE.Vector2(pointerSmooth.x, -pointerSmooth.y), camera);
      interactionPlane.constant = 0;
      raycaster.ray.intersectPlane(interactionPlane, mouseWorld);
      mouseWorldSmooth.lerp(mouseWorld, 1 - Math.exp(-dt * 8));
      dustMat.uniforms.uMouse3D.value.copy(mouseWorldSmooth);
      dustMat.uniforms.uMouseActive.value = lerp(dustMat.uniforms.uMouseActive.value, 1, 1 - Math.exp(-dt * 5));
      cursorLight.position.set(mouseWorldSmooth.x, mouseWorldSmooth.y, mouseWorldSmooth.z + 2.4);
      cursorLight.intensity = 10 * (1 - cur.cold * 0.7);
    } else {
      dustMat.uniforms.uMouseActive.value = lerp(dustMat.uniforms.uMouseActive.value, 0, 1 - Math.exp(-dt * 4));
      cursorLight.intensity = 0;
    }
  }

  /* ---------------- Ridimensionamento ---------------- */
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloomPass.resolution.set(w, h);
    dustMat.uniforms.uPixelRatio.value = pr;
    digiMat.uniforms.uPixelRatio.value = pr;
  }
  window.addEventListener('resize', resize);

  /* ---------------- API pubblica ---------------- */
  return {
    setProgress(p) {
      progress = p;
      computeTarget();
    },
    setPointer(x, y) {
      pointer.set(x, y);
      pointerEntered = true;
    },
    setVelocity(v) {
      scrollVelocity = v || 0;
    },
    triggerRipple(ndcX = 0, ndcY = 0) {
      if (reduce) return;
      const origin = new THREE.Vector3();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, -ndcY), camera);
      raycaster.ray.intersectPlane(interactionPlane, origin);
      dustMat.uniforms.uRippleOrigin.value.copy(origin);
      rippleAge = 0;
      pulseEnergy = Math.min(pulseEnergy + 0.65, 1.1);
    },
    pulse(amount = 0.55) {
      if (reduce) return;
      pulseEnergy = Math.min(pulseEnergy + amount, 1.1);
    },
    render(time, delta) {
      const dt = Math.min(delta || 0.016, 0.1);
      const t = time * (reduce ? 0.3 : 1);

      const a = 1 - Math.exp(-dt * (reduce ? 6 : 2.8));
      for (const k of KEYS) cur[k] += (target[k] - cur[k]) * a;
      pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 3.0));
      pulseEnergy *= Math.exp(-dt * 3.2);
      scrollVelocity *= Math.exp(-dt * 5.0);
      if (rippleAge < 3.0) {
        rippleAge += dt;
        dustMat.uniforms.uRippleAge.value = rippleAge;
      }

      const rot = t * 0.13;
      updateCodex(t);
      updateBooks(t, rot);
      updateLoosePages(t);
      updateDigital(t, rot);
      updateAtmosphere(t, rot);
      updateLetters(t);

      dustMat.uniforms.uTime.value = t;
      dustMat.uniforms.uGlobe.value = cur.globe;
      dustMat.uniforms.uRot.value = rot;
      digiMat.uniforms.uTime.value = t;

      updateCamera(dt);
      composer.render();
    },
  };
}
