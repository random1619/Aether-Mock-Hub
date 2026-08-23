/* FOCUS SERVICE — Aether Mock Hub
   Native Web Audio binaural alpha wave, brown noise, and rain generators
   for deep exam concentration with zero external audio assets. */

export type AmbientSoundType = 'off' | 'binaural_alpha' | 'brown_noise' | 'rain_library';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let activeNodes: { stop?: () => void; disconnect?: () => void }[] = [];

function getOrCreateContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('[focusService] AudioContext unavailable', e);
    return null;
  }
}

/** Stop any currently playing ambient soundscape. */
export function stopAmbientSound(): void {
  activeNodes.forEach((node) => {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch {
      /* ignore */
    }
  });
  activeNodes = [];
  if (masterGain) {
    masterGain.disconnect();
    masterGain = null;
  }
}

/** Set volume dynamically (0.0 to 1.0) */
export function setAmbientVolume(volume: number): void {
  if (masterGain && audioCtx) {
    const clamped = Math.max(0, Math.min(1, volume));
    masterGain.gain.setTargetAtTime(clamped, audioCtx.currentTime, 0.05);
  }
}

/**
 * Starts a synthesized ambient soundscape.
 * @param type 'binaural_alpha' (40Hz gamma/alpha beat), 'brown_noise' (deep focus rumble), or 'rain_library'
 * @param volume 0.0 to 1.0
 */
export function startAmbientSound(type: AmbientSoundType, volume = 0.35): void {
  stopAmbientSound();
  if (type === 'off') return;

  const ctx = getOrCreateContext();
  if (!ctx) return;

  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);
  masterGain.connect(ctx.destination);

  if (type === 'binaural_alpha') {
    // Binaural Alpha Beat: Left Ear 210 Hz, Right Ear 220 Hz => 10 Hz Alpha Entrainment
    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    const panL = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const panR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    oscL.type = 'sine';
    oscL.frequency.setValueAtTime(210, ctx.currentTime);

    oscR.type = 'sine';
    oscR.frequency.setValueAtTime(220, ctx.currentTime);

    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    gainL.gain.setValueAtTime(0.18, ctx.currentTime);
    gainR.gain.setValueAtTime(0.18, ctx.currentTime);

    if (panL && panR) {
      panL.pan.setValueAtTime(-1, ctx.currentTime);
      panR.pan.setValueAtTime(1, ctx.currentTime);

      oscL.connect(gainL).connect(panL).connect(masterGain);
      oscR.connect(gainR).connect(panR).connect(masterGain);
    } else {
      oscL.connect(gainL).connect(masterGain);
      oscR.connect(gainR).connect(masterGain);
    }

    oscL.start();
    oscR.start();
    activeNodes.push(oscL, oscR, gainL, gainR);
  } else if (type === 'brown_noise') {
    // Brown noise: filtered integration of white noise
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // Gain compensation
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Low-pass filter for smooth deep drone
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);

    whiteNoise.connect(filter).connect(masterGain);
    whiteNoise.start();
    activeNodes.push(whiteNoise, filter);
  } else if (type === 'rain_library') {
    // Ambient Rain/Library: Bandpassed pink noise with subtle randomized filter sweeps
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }

    const pinkNoise = ctx.createBufferSource();
    pinkNoise.buffer = noiseBuffer;
    pinkNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, ctx.currentTime);
    filter.Q.setValueAtTime(0.8, ctx.currentTime);

    pinkNoise.connect(filter).connect(masterGain);
    pinkNoise.start();
    activeNodes.push(pinkNoise, filter);
  }
}

/** Calculate focus quality score from 0 to 100% */
export function calculateFocusScore(tabSwitches = 0, fsExits = 0, _durationMinutes = 60): {
  score: number;
  rating: 'Flawless Flow' | 'High Focus' | 'Moderate Focus' | 'Distracted';
  penaltyReasons: string[];
} {
  let score = 100;
  const penalties: string[] = [];

  if (tabSwitches > 0) {
    const tabPenalty = Math.min(40, tabSwitches * 8);
    score -= tabPenalty;
    penalties.push(`${tabSwitches} tab switch${tabSwitches > 1 ? 'es' : ''} (-${tabPenalty}%)`);
  }

  if (fsExits > 0) {
    const fsPenalty = Math.min(30, fsExits * 10);
    score -= fsPenalty;
    penalties.push(`${fsExits} fullscreen exit${fsExits > 1 ? 's' : ''} (-${fsPenalty}%)`);
  }

  score = Math.max(10, Math.min(100, score));

  let rating: 'Flawless Flow' | 'High Focus' | 'Moderate Focus' | 'Distracted' = 'Flawless Flow';
  if (score >= 90) rating = 'Flawless Flow';
  else if (score >= 75) rating = 'High Focus';
  else if (score >= 50) rating = 'Moderate Focus';
  else rating = 'Distracted';

  return { score, rating, penaltyReasons: penalties };
}
