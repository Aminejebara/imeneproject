import 'lenis/dist/lenis.css';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import {
  createIcons,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Keyboard,
  Sparkles,
  BookOpen,
  GraduationCap,
  Landmark,
  Quote,
  Headphones,
  Music,
  FileText,
  Tablet,
  Gift,
  Compass,
  AudioLines,
  Hourglass,
  LayoutPanelTop,
  ArrowUpRight,
  RotateCcw,
  MousePointerClick,
} from 'lucide';

import { createScene } from './scene.js';
import { createSoundEngine } from './audio.js';
import { initCursor } from './cursor.js';
import { initAnimations } from './animations.js';

gsap.registerPlugin(ScrollTrigger);

// Idrata tutte le icone vettoriali Lucide
createIcons({
  icons: {
    Volume2,
    VolumeX,
    Maximize2,
    Minimize2,
    Keyboard,
    Sparkles,
    BookOpen,
    GraduationCap,
    Landmark,
    Quote,
    Headphones,
    Music,
    FileText,
    Tablet,
    Gift,
    Compass,
    AudioLines,
    Hourglass,
    LayoutPanelTop,
    ArrowUpRight,
    RotateCcw,
    MousePointerClick,
  },
  attrs: { 'stroke-width': 1.75 },
});

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

// La presentazione parte sempre dall'inizio
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ------------------------------------------------------------------ */
/*  Motore sonoro & Scena 3D                                           */
/* ------------------------------------------------------------------ */
const sound = createSoundEngine();
const scene = createScene(document.getElementById('webgl'), { isMobile, reduce });

if (!reduce && !isMobile) {
  window.addEventListener('pointermove', (e) => {
    scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  });
}

// Clic nello spazio libero → onda stellare 3D interattiva
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button, .author-card, .timeline__item, .hud, .sidenav')) return;
  const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
  const ndcY = (e.clientY / window.innerHeight) * 2 - 1;
  scene.triggerRipple(ndcX, ndcY);
  sound.playRipple();
});

/* ------------------------------------------------------------------ */
/*  Cursore fluido & magnetico (solo Web desktop)                      */
/* ------------------------------------------------------------------ */
initCursor({ reduce, sound });

/* ------------------------------------------------------------------ */
/*  Lenis (scroll fluido) sincronizzato con ScrollTrigger + 3D         */
/* ------------------------------------------------------------------ */
let lenis = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.082, smoothWheel: true, wheelMultiplier: 0.92 });
  lenis.on('scroll', (e) => {
    ScrollTrigger.update();
    scene.setVelocity(e.velocity);
  });
}

gsap.ticker.add((time, deltaTime) => {
  if (lenis) lenis.raf(time * 1000);
  scene.render(time, deltaTime / 1000);
});
gsap.ticker.lagSmoothing(0);

/* ------------------------------------------------------------------ */
/*  Animazioni & Widget interattivi                                    */
/* ------------------------------------------------------------------ */
initAnimations({ scene, sound, reduce });

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}
window.addEventListener('load', () => ScrollTrigger.refresh());

/* ------------------------------------------------------------------ */
/*  Controlli HUD: Audio, Schermo intero, Capitolo attivo              */
/* ------------------------------------------------------------------ */
const btnAudio = document.getElementById('btn-audio');
const btnFullscreen = document.getElementById('btn-fullscreen');
const hudChapterNum = document.querySelector('.hud__chapter-num');
const hudChapterLabel = document.querySelector('.hud__chapter-label');

async function toggleAudio() {
  const on = await sound.toggle();
  if (btnAudio) {
    btnAudio.classList.toggle('is-active', on);
    btnAudio.setAttribute('aria-pressed', String(on));
  }
  if (on) scene.pulse(0.45);
}

btnAudio?.addEventListener('click', toggleAudio);

function toggleFullscreen() {
  sound.playClick();
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

btnFullscreen?.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  btnFullscreen?.classList.toggle('is-active', Boolean(document.fullscreenElement));
});

function updateHudChapter(num, name) {
  if (!hudChapterNum || !hudChapterLabel) return;
  if (hudChapterNum.textContent === num && hudChapterLabel.textContent === name) return;
  if (reduce) {
    hudChapterNum.textContent = num;
    hudChapterLabel.textContent = name;
    return;
  }
  gsap.to([hudChapterNum, hudChapterLabel], {
    y: -6,
    autoAlpha: 0,
    duration: 0.18,
    ease: 'power2.in',
    onComplete: () => {
      hudChapterNum.textContent = num;
      hudChapterLabel.textContent = name;
      gsap.fromTo([hudChapterNum, hudChapterLabel], { y: 6, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.32, ease: 'power3.out' });
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Navigazione                                                        */
/* ------------------------------------------------------------------ */
const screens = [...document.querySelectorAll('[data-scene]')];
const dots = [...document.querySelectorAll('.sidenav__dot')];

const topOf = (el) => el.getBoundingClientRect().top + window.scrollY;
const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
const currentY = () => (lenis ? lenis.targetScroll : window.scrollY);

function scrollToY(y) {
  const target = Math.min(Math.max(y, 0), maxScroll());
  if (lenis) {
    lenis.scrollTo(target, { duration: 1.45, easing: (t) => 1 - Math.pow(1 - t, 4) });
  } else {
    window.scrollTo(0, target);
  }
}

let lastNavIndex = -1;
function setActive(index) {
  dots.forEach((dot, i) => {
    const active = i === index;
    dot.classList.toggle('is-active', active);
    if (active) dot.setAttribute('aria-current', 'step');
    else dot.removeAttribute('aria-current');
  });
  if (index >= 0 && index !== lastNavIndex) {
    sound.playChapter(index);
  }
  lastNavIndex = index;
}

screens.forEach((section) => {
  const navAttr = section.dataset.nav;
  const num = section.dataset.chapterNum || '';
  const name = section.dataset.chapterName || '';
  ScrollTrigger.create({
    trigger: section,
    start: 'top center',
    end: 'bottom center',
    onToggle: (self) => {
      if (!self.isActive) return;
      updateHudChapter(num, name);
      if (navAttr !== undefined) setActive(Number(navAttr));
      else setActive(-1);
    },
  });
});

// Clic sui punti della navigazione laterale
dots.forEach((dot) => {
  dot.addEventListener('click', () => {
    sound.playClick();
    const target = document.querySelector(dot.dataset.target);
    if (target) scrollToY(topOf(target));
  });
});

// Link brand HUD, "Scorri per iniziare" e "Torna all'inizio"
document.querySelector('.hud__brand')?.addEventListener('click', (e) => {
  e.preventDefault();
  sound.playClick();
  scrollToY(0);
});

document.querySelector('.hero__scroll')?.addEventListener('click', (e) => {
  e.preventDefault();
  sound.playClick(true);
  scrollToY(topOf(document.querySelector('#introduzione')));
});

document.getElementById('btn-restart')?.addEventListener('click', () => {
  sound.playClick(true);
  scrollToY(0);
});

// Sezione successiva / precedente
function go(direction) {
  const y = currentY();
  const vh = window.innerHeight;
  const tops = screens.map(topOf);

  let i = 0;
  for (let k = 0; k < tops.length; k++) if (tops[k] <= y + 4) i = k;
  const top = tops[i];
  const height = screens[i].offsetHeight;
  const bottom = top + height;

  let target;
  if (direction > 0) {
    if (bottom - (y + vh) > 8) target = Math.min(y + vh * 0.85, bottom - vh);
    else target = tops[Math.min(i + 1, tops.length - 1)];
  } else if (y - top > 8) {
    target = height > vh * 1.05 ? Math.max(top, y - vh * 0.85) : top;
  } else {
    target = tops[Math.max(i - 1, 0)];
  }
  scrollToY(target);
}

window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const el = e.target;
  const tag = el && el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;

  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowRight':
    case 'PageDown':
      e.preventDefault();
      go(1);
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
    case 'PageUp':
      e.preventDefault();
      go(-1);
      break;
    case ' ':
    case 'Spacebar':
      if (tag === 'BUTTON' || tag === 'A') return;
      e.preventDefault();
      go(e.shiftKey ? -1 : 1);
      break;
    case 'Home':
      e.preventDefault();
      scrollToY(0);
      break;
    case 'End':
      e.preventDefault();
      scrollToY(maxScroll());
      break;
    case 'm':
    case 'M':
      e.preventDefault();
      toggleAudio();
      break;
    case 'f':
    case 'F':
      e.preventDefault();
      toggleFullscreen();
      break;
    default:
  }
});
