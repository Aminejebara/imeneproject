import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitType from 'split-type';
import VanillaTilt from 'vanilla-tilt';
import confetti from 'canvas-confetti';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away-subtle.css';

gsap.registerPlugin(ScrollTrigger);

const GOLD = '#e9c46a';
const GOLD_GLOW = '0 0 18px rgba(233, 196, 106, 0.6)';

/* ------------------------------------------------------------------ */
/*  Divisione accessibile dei titoli con SplitType                     */
/* ------------------------------------------------------------------ */
function splitHeading(el) {
  const original = el.textContent.trim().replace(/\s+/g, ' ');
  el.setAttribute('aria-label', original);
  const split = new SplitType(el, { types: 'words,chars', tagName: 'span' });
  (split.words || []).forEach((w) => {
    w.classList.add('w');
    w.setAttribute('aria-hidden', 'true');
  });
  (split.chars || []).forEach((c) => {
    c.classList.add('c');
  });
  return split.chars || [];
}

/* ------------------------------------------------------------------ */
/*  Scintille dorate & ciano con canvas-confetti                       */
/* ------------------------------------------------------------------ */
export function launchStardust(reduce = false) {
  if (reduce) return;
  const colors = ['#f6e3a8', '#e9c46a', '#5ee7ff', '#ffffff', '#d4a64a'];
  confetti({
    particleCount: 44,
    angle: 60,
    spread: 62,
    startVelocity: 42,
    gravity: 0.72,
    scalar: 0.9,
    ticks: 220,
    origin: { x: 0.08, y: 0.72 },
    colors,
  });
  confetti({
    particleCount: 44,
    angle: 120,
    spread: 62,
    startVelocity: 42,
    gravity: 0.72,
    scalar: 0.9,
    ticks: 220,
    origin: { x: 0.92, y: 0.72 },
    colors,
  });
  window.setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: 95,
      startVelocity: 26,
      gravity: 0.55,
      scalar: 0.75,
      ticks: 240,
      origin: { x: 0.5, y: 0.45 },
      colors,
    });
  }, 240);
}

/* ------------------------------------------------------------------ */
/*  Sipario iniziale cinematografico                                   */
/* ------------------------------------------------------------------ */
export function runPreloader({ reduce = false, onReveal } = {}) {
  const preloader = document.getElementById('preloader');
  if (!preloader) {
    onReveal?.();
    return;
  }

  if (reduce) {
    preloader.remove();
    onReveal?.();
    return;
  }

  const tl = gsap.timeline({
    onComplete: () => {
      preloader.remove();
    },
  });

  tl.fromTo('.preloader__medallion', { scale: 0.84, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.55, ease: 'power3.out' })
    .fromTo('.preloader__brand, .preloader__meta', { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.45, ease: 'power2.out' }, '-=0.35')
    .to('.preloader__fill', { scaleX: 1, duration: 0.72, ease: 'power2.inOut' }, '-=0.35')
    .add(() => onReveal?.(), '-=0.05')
    .to('.preloader__inner', { y: -24, autoAlpha: 0, duration: 0.45, ease: 'power3.in' })
    .to(preloader, { autoAlpha: 0, duration: 0.55, ease: 'power2.inOut' }, '-=0.25');
}

/* ------------------------------------------------------------------ */
/*  Inizializzazione animazioni & micro-interazioni                    */
/* ------------------------------------------------------------------ */
export function initAnimations({ scene, sound, reduce = false }) {
  const M = reduce ? 0 : 1;
  const dur = (d) => (reduce ? Math.min(d, 0.35) : d);
  const stag = (s) => (reduce ? 0 : s);

  const splitMap = new Map();
  document.querySelectorAll('[data-split]').forEach((el) => splitMap.set(el, splitHeading(el)));

  setupSceneProgress(scene);
  setupProgressBar(reduce);

  const heroTimeline = buildHeroTimeline(splitMap, M, dur, stag);
  heroTimeline.pause(0);

  document.querySelectorAll('.section .panel').forEach((panel) => {
    buildSectionTimeline(panel, splitMap, M, dur, stag, reduce);
  });

  setupFinale(splitMap, M, dur, stag, scene, sound, reduce);
  setupVanillaTilt(reduce);
  setupTooltips();
  setupInteractiveWidgets({ scene, sound, reduce });

  // Avvia il sipario e lancia la Hero al momento del reveal
  runPreloader({
    reduce,
    onReveal: () => {
      heroTimeline.play(0);
      scene.pulse(0.45);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Collega lo scroll alla scena 3D                                    */
/* ------------------------------------------------------------------ */
function setupSceneProgress(scene) {
  const sections = gsap.utils.toArray('[data-scene]');
  let tops = [];

  const measure = () => {
    tops = sections.map((s) => s.getBoundingClientRect().top + window.scrollY);
  };

  const update = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    let p = 0;
    for (let i = 1; i < sections.length; i++) {
      p += gsap.utils.clamp(0, 1, (y - (tops[i] - vh)) / vh);
    }
    scene.setProgress(p);
  };

  ScrollTrigger.addEventListener('refresh', () => {
    measure();
    update();
  });
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: update });
  measure();
  update();
}

/* ------------------------------------------------------------------ */
/*  Barra superiore + binario laterale progressivo                     */
/* ------------------------------------------------------------------ */
function setupProgressBar(reduce) {
  gsap.to('.progress__bar', {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: reduce ? true : 0.28 },
  });

  const railFill = document.querySelector('.sidenav__rail-fill');
  if (railFill) {
    gsap.to(railFill, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: '#introduzione',
        start: 'top center',
        endTrigger: '#conclusione',
        end: 'center center',
        scrub: reduce ? true : 0.3,
      },
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Schermata iniziale (Hero)                                          */
/* ------------------------------------------------------------------ */
function buildHeroTimeline(splitMap, M, dur, stag) {
  const title = document.querySelector('.hero__title');
  const chars = splitMap.get(title) || [];

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.hero__crest', { autoAlpha: 0, scale: M ? 0.7 : 1, y: 18 * M, duration: dur(1.1) })
    .from('.hero__kicker', { autoAlpha: 0, y: 12 * M, duration: dur(0.85) }, '-=0.75')
    .from(
      chars,
      {
        yPercent: 120 * M,
        rotateX: -78 * M,
        transformPerspective: 900,
        autoAlpha: 0,
        duration: dur(1.35),
        stagger: stag(0.052),
      },
      '-=0.6',
    )
    .from('.hero__ornament span', { scaleX: 0, duration: dur(1.1), ease: 'power3.inOut' }, '-=0.95')
    .from('.hero__ornament i', { autoAlpha: 0, rotate: -180 * M, scale: M ? 0 : 1, duration: dur(0.9) }, '<0.18')
    .from('.hero__subtitle', { autoAlpha: 0, y: 18 * M, ...(M ? { letterSpacing: '0.54em' } : {}), duration: dur(1.3) }, '-=0.85')
    .from('.hero__hint', { autoAlpha: 0, y: 12 * M, duration: dur(0.9) }, '-=0.75')
    .from('.hero__scroll', { autoAlpha: 0, y: 14 * M, duration: dur(0.9) }, '-=0.65');

  gsap.to('.hero__inner', {
    yPercent: -24 * M,
    autoAlpha: 0,
    ease: 'none',
    scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom 25%', scrub: true },
  });
  gsap.to('.hero__scroll', {
    autoAlpha: 0,
    ease: 'none',
    scrollTrigger: { trigger: '#home', start: 'top top', end: '22% top', scrub: true },
  });

  return tl;
}

/* ------------------------------------------------------------------ */
/*  Timeline di ogni sezione                                           */
/* ------------------------------------------------------------------ */
function glowKeywords(tl, scope, position = '-=0.35', stagger = 0.14) {
  const kws = scope.querySelectorAll('strong');
  if (!kws.length) return;
  tl.to(kws, { color: GOLD, textShadow: GOLD_GLOW, duration: 0.65, stagger, ease: 'power2.out' }, position);
}

function buildSectionTimeline(panel, splitMap, M, dur, stag, reduce) {
  const section = panel.closest('.section');
  const title = panel.querySelector('[data-split]');

  const tl = gsap.timeline({
    defaults: { ease: 'power3.out', duration: dur(0.88) },
    scrollTrigger: { trigger: section, start: 'top 66%', toggleActions: 'play none none reverse' },
  });

  tl.from(panel, { autoAlpha: 0, y: 56 * M, scale: M ? 0.975 : 1, duration: dur(1.05) });
  tl.from(panel.querySelectorAll('.section__num, .section__tag'), { autoAlpha: 0, x: -16 * M, stagger: 0.08 }, '-=0.7');
  tl.from(panel.querySelector('.section__rule'), { scaleX: 0, duration: dur(0.95), ease: 'power3.inOut' }, '<');

  if (title) {
    tl.from(
      splitMap.get(title),
      {
        yPercent: 108 * M,
        rotateX: -68 * M,
        transformPerspective: 700,
        autoAlpha: 0,
        stagger: stag(0.032),
        duration: dur(0.82),
      },
      '-=0.78',
    );
  }

  panel.querySelectorAll('.reveal, [data-anim]').forEach((el, i) => {
    const pos = i === 0 ? '-=0.45' : '-=0.42';
    const type = el.dataset.anim;

    if (!type) {
      tl.from(el, { autoAlpha: 0, y: 26 * M, duration: dur(0.78) }, pos);
      glowKeywords(tl, el);
    } else if (type === 'pills') {
      tl.from(el.children, { autoAlpha: 0, y: 16 * M, scale: M ? 0.92 : 1, stagger: stag(0.09), duration: dur(0.65) }, pos);
    } else if (type === 'timeline') {
      buildTimeline(tl, el, M, dur, pos);
    } else if (type === 'cards') {
      tl.from(
        el.querySelectorAll('.author-card'),
        { autoAlpha: 0, y: 44 * M, rotateX: -20 * M, transformPerspective: 900, stagger: stag(0.14), duration: dur(0.85) },
        pos,
      );
      tl.from(
        el.querySelectorAll('.author-card__initial'),
        { scale: M ? 0.45 : 1, autoAlpha: 0, stagger: stag(0.14), duration: dur(0.75), ease: 'back.out(2)' },
        '<0.18',
      );
    } else if (type === 'quote') {
      tl.from(el, { autoAlpha: 0, y: 20 * M, duration: dur(0.75) }, pos);
    } else if (type === 'steps') {
      buildSteps(tl, el, M, dur, stag, reduce, pos);
    } else if (type === 'button') {
      tl.from(el, { autoAlpha: 0, y: 20 * M, scale: M ? 0.9 : 1, duration: dur(0.88), ease: 'back.out(1.6)' }, pos);
    } else if (type === 'strengths') {
      el.querySelectorAll('.strength').forEach((card, ci) => {
        tl.from(card, { autoAlpha: 0, y: 52 * M, scale: M ? 0.94 : 1, duration: dur(0.78) }, ci === 0 ? pos : '-=0.38');
        tl.from(card.querySelector('.strength__num'), { autoAlpha: 0, x: -18 * M, duration: dur(0.55) }, '<0.14');
        glowKeywords(tl, card, '-=0.3');
      });
    } else if (type === 'limits') {
      el.querySelectorAll('.limit').forEach((item, li) => {
        tl.from(item, { autoAlpha: 0, x: -28 * M, duration: dur(0.78) }, li === 0 ? pos : '-=0.4');
        glowKeywords(tl, item, '-=0.3');
      });
    }
  });
}

function buildTimeline(tl, el, M, dur, pos) {
  const line = el.querySelector('.timeline__line');
  const items = el.querySelectorAll('.timeline__item');
  tl.addLabel('tl-start', pos);
  tl.from(el, { autoAlpha: 0, duration: dur(0.35) }, 'tl-start');
  tl.fromTo(line, { '--p': 0 }, { '--p': 1, duration: dur(1.8), ease: 'power2.inOut' }, 'tl-start');
  items.forEach((item, i) => {
    const at = `tl-start+=${0.12 + i * 0.4}`;
    tl.from(item.querySelector('.timeline__dot'), { scale: 0, duration: dur(0.55), ease: 'back.out(3)' }, at);
    tl.from(item.querySelectorAll('.timeline__date, .timeline__label'), { autoAlpha: 0, y: 14 * M, stagger: 0.07, duration: dur(0.55) }, at);
  });
}

function buildSteps(tl, el, M, dur, stag, reduce, pos) {
  const line = el.querySelector('.steps__line');
  const steps = el.querySelectorAll('.step');
  tl.addLabel('steps-start', pos);
  tl.fromTo(line, { '--p': 0 }, { '--p': 1, duration: dur(1.5), ease: 'power2.inOut' }, 'steps-start');
  steps.forEach((step, i) => {
    const at = `steps-start+=${i * 0.36}`;
    tl.from(step.querySelector('.step__icon'), { autoAlpha: 0, scale: M ? 0.5 : 1, duration: dur(0.68), ease: 'back.out(2)' }, at);
    if (!reduce) {
      tl.from(step.querySelectorAll('[pathLength]'), { strokeDashoffset: 1, duration: 0.85, stagger: 0.09, ease: 'power2.inOut' }, at);
    }
    tl.from(step.querySelectorAll('.step__num, .step__title, .step__text'), { autoAlpha: 0, y: 14 * M, stagger: stag(0.07), duration: dur(0.58) }, `${at}+=0.18`);
  });
}

/* ------------------------------------------------------------------ */
/*  Schermata finale + celebrazione stardust                           */
/* ------------------------------------------------------------------ */
function setupFinale(splitMap, M, dur, stag, scene, sound, reduce) {
  const title = document.querySelector('.finale__title');
  let celebratedOnce = false;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#grazie',
      start: 'top 56%',
      toggleActions: 'play none none reverse',
      onEnter: () => {
        if (!celebratedOnce) {
          celebratedOnce = true;
          launchStardust(reduce);
          scene.pulse(0.9);
          sound?.playFinale();
        }
      },
    },
  });

  tl.from('.finale__crest', { autoAlpha: 0, scale: M ? 0.65 : 1, y: 24 * M, duration: dur(0.9), ease: 'back.out(1.7)' })
    .from(
      splitMap.get(title),
      {
        yPercent: 100 * M,
        rotateX: -88 * M,
        transformPerspective: 850,
        autoAlpha: 0,
        stagger: stag(0.036),
        duration: dur(1.05),
        ease: 'expo.out',
      },
      '-=0.5',
    )
    .from('.finale__sub', { autoAlpha: 0, y: 14 * M, duration: dur(0.75), ease: 'power3.out' }, '-=0.55')
    .from('.finale__actions', { autoAlpha: 0, y: 16 * M, duration: dur(0.75), ease: 'power3.out' }, '-=0.5');
}

/* ------------------------------------------------------------------ */
/*  VanillaTilt con riflesso metallico olografico                      */
/* ------------------------------------------------------------------ */
function setupVanillaTilt(reduce) {
  if (reduce || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const targets = document.querySelectorAll('[data-tilt]');
  if (!targets.length) return;

  VanillaTilt.init(targets, {
    max: 11,
    speed: 550,
    perspective: 1000,
    scale: 1.025,
    glare: true,
    'max-glare': 0.22,
    gyroscope: false,
  });
}

/* ------------------------------------------------------------------ */
/*  Tooltip glassmorphism con Tippy.js                                 */
/* ------------------------------------------------------------------ */
function setupTooltips() {
  tippy('[data-tippy-content]', {
    theme: 'liber',
    allowHTML: true,
    animation: 'shift-away-subtle',
    duration: [240, 180],
    delay: [80, 40],
    maxWidth: 270,
    offset: [0, 12],
  });
}

/* ------------------------------------------------------------------ */
/*  Micro-interazioni (Citazioni autori, Formati, Timeline, Finale)    */
/* ------------------------------------------------------------------ */
function setupInteractiveWidgets({ scene, sound, reduce }) {
  // 1. Selezione card autore → transizione fluida dell'incipit letterario
  const authorCards = [...document.querySelectorAll('.author-card')];
  const quoteBox = document.getElementById('author-quote');
  const quoteText = quoteBox?.querySelector('.incipit__text');
  const quoteSource = quoteBox?.querySelector('.incipit__source');

  const selectAuthor = (card) => {
    if (!quoteBox || !quoteText || !quoteSource) return;
    authorCards.forEach((c) => c.classList.toggle('is-selected', c === card));
    const nextQuote = card.dataset.quote;
    const nextSource = card.dataset.source;
    sound?.playClick(true);
    scene.pulse(0.45);

    if (reduce) {
      quoteText.textContent = nextQuote;
      quoteSource.textContent = nextSource;
      return;
    }

    gsap.to([quoteText, quoteSource], {
      autoAlpha: 0,
      y: -8,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        quoteText.textContent = nextQuote;
        quoteSource.textContent = nextSource;
        gsap.fromTo(
          [quoteText, quoteSource],
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power3.out' },
        );
      },
    });
  };

  authorCards.forEach((card) => {
    card.addEventListener('click', () => selectAuthor(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectAuthor(card);
      }
    });
  });

  // 2. Pillole formato interattive (Come funziona)
  const formatPills = [...document.querySelectorAll('.format-pill')];
  formatPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      formatPills.forEach((p) => p.classList.toggle('is-active', p === pill));
      sound?.playClick();
      scene.pulse(0.38);
    });
  });

  // 3. Tappe timeline interattive
  document.querySelectorAll('.timeline__item').forEach((item) => {
    item.addEventListener('mouseenter', () => scene.pulse(0.25));
    item.addEventListener('click', () => {
      sound?.playClick(true);
      scene.pulse(0.5);
    });
  });

  // 4. Celebrazione manuale nella schermata finale
  const triggerCelebration = () => {
    launchStardust(reduce);
    scene.pulse(0.95);
    sound?.playFinale();
  };
  document.getElementById('btn-celebrate')?.addEventListener('click', triggerCelebration);
  document.getElementById('btn-celebrate-crest')?.addEventListener('click', triggerCelebration);
}
