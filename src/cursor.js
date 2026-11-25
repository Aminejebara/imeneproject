import gsap from 'gsap';

/* ------------------------------------------------------------------ */
/*  Cursore fluido magnetico + riflessi dinamici sui bordi (solo Web)  */
/* ------------------------------------------------------------------ */

export function initCursor({ reduce = false, sound = null } = {}) {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!finePointer || reduce) return;

  document.documentElement.classList.add('has-custom-cursor');

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  const label = document.createElement('span');
  label.className = 'cursor-ring__label';
  ring.appendChild(label);
  document.body.append(ring, dot);

  const setDotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3.out' });
  const setDotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3.out' });
  const setRingX = gsap.quickTo(ring, 'x', { duration: 0.34, ease: 'power3.out' });
  const setRingY = gsap.quickTo(ring, 'y', { duration: 0.34, ease: 'power3.out' });

  let visible = false;

  const show = () => {
    if (visible) return;
    visible = true;
    dot.classList.add('is-visible');
    ring.classList.add('is-visible');
  };

  const hide = () => {
    visible = false;
    dot.classList.remove('is-visible');
    ring.classList.remove('is-visible');
  };

  // Riflesso luminoso sui bordi dei pannelli e delle carte
  const glowTargets = [...document.querySelectorAll('.panel, .strength, .limit, .format-pill, .step__icon')];

  window.addEventListener('pointermove', (e) => {
    show();
    setDotX(e.clientX);
    setDotY(e.clientY);
    setRingX(e.clientX);
    setRingY(e.clientY);

    for (const el of glowTargets) {
      const r = el.getBoundingClientRect();
      if (e.clientY >= r.top - 120 && e.clientY <= r.bottom + 120 && e.clientX >= r.left - 120 && e.clientX <= r.right + 120) {
        el.style.setProperty('--px', `${e.clientX - r.left}px`);
        el.style.setProperty('--py', `${e.clientY - r.top}px`);
      }
    }
  });

  document.addEventListener('pointerleave', hide);
  window.addEventListener('pointerdown', () => ring.classList.add('is-pressed'));
  window.addEventListener('pointerup', () => ring.classList.remove('is-pressed'));

  // Stati hover contestuali
  const hoverables = document.querySelectorAll('a, button, [data-cursor]');
  hoverables.forEach((el) => {
    el.addEventListener('pointerenter', () => {
      const mode = el.dataset.cursor || 'pointer';
      const text = el.dataset.cursorLabel || '';
      ring.classList.add('is-hover');
      ring.dataset.mode = mode;
      label.textContent = text;
      ring.classList.toggle('has-label', Boolean(text));
      dot.classList.add('is-hover');
      if (sound) sound.playHover();
    });
    el.addEventListener('pointerleave', () => {
      ring.classList.remove('is-hover', 'has-label');
      delete ring.dataset.mode;
      label.textContent = '';
      dot.classList.remove('is-hover');
    });
  });

  // Attrazione magnetica per pulsanti ed elementi chiave
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic) || 0.28;
    const mx = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
    const my = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * strength;
      const dy = (e.clientY - (r.top + r.height / 2)) * strength;
      mx(dx);
      my(dy);
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    });
  });
}
