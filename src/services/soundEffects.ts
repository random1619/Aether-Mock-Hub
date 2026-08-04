/**
 * Synthesizes the iconic Netflix "Ta-Dum" audio effect using native Web Audio API.
 * Completely client-side, zero external assets or audio file dependencies.
 */
export function playNetflixTaDum() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Note 1: First "TA" (Low punch hit at t=0)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(95, now);
    osc1.frequency.exponentialRampToValueAtTime(50, now + 0.18);

    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.22);

    // Note 2: Second "DUM" (Resonant sub hit + chord at t=0.14)
    const startTime2 = now + 0.14;

    // Sub bass oscillator
    const osc2Sub = ctx.createOscillator();
    const gain2Sub = ctx.createGain();

    osc2Sub.type = 'sine';
    osc2Sub.frequency.setValueAtTime(73.42, startTime2); // D2
    osc2Sub.frequency.exponentialRampToValueAtTime(36.71, startTime2 + 1.2);

    gain2Sub.gain.setValueAtTime(0.7, startTime2);
    gain2Sub.gain.exponentialRampToValueAtTime(0.001, startTime2 + 1.4);

    osc2Sub.connect(gain2Sub);
    gain2Sub.connect(ctx.destination);

    osc2Sub.start(startTime2);
    osc2Sub.stop(startTime2 + 1.45);

    // Chord layer for cinematic resonance
    const osc2Chord = ctx.createOscillator();
    const gain2Chord = ctx.createGain();

    osc2Chord.type = 'sawtooth';
    osc2Chord.frequency.setValueAtTime(146.83, startTime2); // D3
    osc2Chord.frequency.exponentialRampToValueAtTime(110.0, startTime2 + 0.8);

    gain2Chord.gain.setValueAtTime(0.2, startTime2);
    gain2Chord.gain.exponentialRampToValueAtTime(0.001, startTime2 + 0.9);

    osc2Chord.connect(gain2Chord);
    gain2Chord.connect(ctx.destination);

    osc2Chord.start(startTime2);
    osc2Chord.stop(startTime2 + 0.95);
  } catch (e) {
    console.warn('AudioContext playback failed or muted', e);
  }
}
