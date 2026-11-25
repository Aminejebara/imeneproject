import * as Tone from 'tone';

/* ------------------------------------------------------------------ */
/*  Motore sonoro procedurale (Tone.js) — arpa/celesta da sala museale */
/* ------------------------------------------------------------------ */

// Accordi modali calibrati sull'atmosfera di ciascun capitolo (D Lydian / D Major)
const CHAPTER_NOTES = [
  ['D4', 'A4'],          // 0 · Introduzione
  ['D4', 'F#4', 'A4'],   // 1 · Storia (caldo rinascimentale)
  ['E4', 'B4', 'F#5'],   // 2 · Che cosa offre (luminoso)
  ['A4', 'C#5', 'E5'],   // 3 · Come funziona (chiaro, digitale)
  ['D4', 'A4', 'E5'],    // 4 · Punti di forza (aperto)
  ['B3', 'D4', 'F#4'],   // 5 · Limiti (riflessivo, morbido)
  ['D4', 'F#4', 'A4', 'D5'], // 6 · Conclusione (compiuto)
];

const HOVER_SCALE = ['A4', 'B4', 'D5', 'E5', 'F#5', 'A5'];

export function createSoundEngine() {
  let enabled = false;
  let ready = false;
  let synth = null;
  let sparkle = null;
  let lastHoverAt = 0;
  let hoverIdx = 0;

  async function init() {
    if (ready) return;
    await Tone.start();

    const reverb = new Tone.Reverb({ decay: 3.2, wet: 0.42 }).toDestination();
    await reverb.generate();

    const filter = new Tone.Filter({ frequency: 2400, type: 'lowpass', rolloff: -12 }).connect(reverb);

    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.45, sustain: 0.08, release: 1.8 },
      volume: -17,
    }).connect(filter);

    sparkle = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.008, decay: 0.22, sustain: 0.0, release: 0.9 },
      volume: -23,
    }).connect(reverb);

    ready = true;
  }

  return {
    get isEnabled() {
      return enabled;
    },
    async toggle() {
      if (!enabled) {
        try {
          await init();
          enabled = true;
          this.playClick(true);
        } catch (err) {
          console.warn('Audio non avviabile:', err);
          enabled = false;
        }
      } else {
        enabled = false;
      }
      return enabled;
    },
    playHover() {
      if (!enabled || !ready || !sparkle) return;
      const now = performance.now();
      if (now - lastHoverAt < 95) return;
      lastHoverAt = now;
      const note = HOVER_SCALE[hoverIdx % HOVER_SCALE.length];
      hoverIdx++;
      sparkle.triggerAttackRelease(note, '16n');
    },
    playClick(warm = false) {
      if (!enabled || !ready || !sparkle) return;
      sparkle.triggerAttackRelease(warm ? ['D5', 'A5'] : 'F#5', '16n');
    },
    playChapter(index) {
      if (!enabled || !ready || !synth) return;
      const chord = CHAPTER_NOTES[index];
      if (!chord) return;
      const now = Tone.now();
      chord.forEach((n, i) => {
        synth.triggerAttackRelease(n, '4n', now + i * 0.065, 0.55);
      });
    },
    playRipple() {
      if (!enabled || !ready || !sparkle) return;
      const now = Tone.now();
      ['D5', 'F#5', 'A5'].forEach((n, i) => {
        sparkle.triggerAttackRelease(n, '8n', now + i * 0.045, 0.5);
      });
    },
    playFinale() {
      if (!enabled || !ready || !synth) return;
      const now = Tone.now();
      ['D4', 'F#4', 'A4', 'C#5', 'E5', 'A5'].forEach((n, i) => {
        synth.triggerAttackRelease(n, '2n', now + i * 0.085, 0.65);
      });
    },
  };
}
