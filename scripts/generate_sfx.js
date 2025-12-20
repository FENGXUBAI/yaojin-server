const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function writeWav16Mono(filePath, samplesFloat, sampleRate = SAMPLE_RATE) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  const dataSize = samplesFloat.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM
  buffer.writeUInt16LE(1, 20); // audio format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // samples
  for (let i = 0; i < samplesFloat.length; i++) {
    const s = clamp(samplesFloat[i], -1, 1);
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

function envelope(t, duration, a, d, s, r) {
  // ADSR in seconds, sustain level s in [0..1]
  const attackEnd = a;
  const decayEnd = a + d;
  const releaseStart = Math.max(decayEnd, duration - r);

  if (t < 0) return 0;
  if (t < attackEnd) return a <= 0 ? 1 : t / a;
  if (t < decayEnd) {
    if (d <= 0) return s;
    const k = (t - attackEnd) / d;
    return 1 - (1 - s) * k;
  }
  if (t < releaseStart) return s;
  if (t < duration) {
    if (r <= 0) return 0;
    const k = (t - releaseStart) / r;
    return s * (1 - k);
  }
  return 0;
}

function osc(type, phase) {
  const x = phase % (Math.PI * 2);
  if (type === 'sine') return Math.sin(x);
  if (type === 'square') return x < Math.PI ? 1 : -1;
  if (type === 'triangle') {
    // triangle from phase
    const p = x / (Math.PI * 2);
    return 1 - 4 * Math.abs(p - 0.5);
  }
  return 0;
}

function makeTone({
  freq,
  durationMs,
  wave = 'sine',
  volume = 0.6,
  attackMs = 5,
  decayMs = 40,
  sustain = 0.25,
  releaseMs = 60,
  sweepToFreq,
  noise = false,
}) {
  const duration = durationMs / 1000;
  const a = attackMs / 1000;
  const d = decayMs / 1000;
  const r = releaseMs / 1000;

  const n = Math.max(1, Math.floor(duration * SAMPLE_RATE));
  const out = new Float32Array(n);
  let phase = 0;

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(t, duration, a, d, sustain, r);

    let f = freq;
    if (typeof sweepToFreq === 'number') {
      const k = t / duration;
      f = freq + (sweepToFreq - freq) * clamp(k, 0, 1);
    }

    phase += (Math.PI * 2 * f) / SAMPLE_RATE;

    let v;
    if (noise) {
      v = (Math.random() * 2 - 1) * 0.7;
    } else {
      v = osc(wave, phase);
    }

    out[i] = v * env * volume;
  }

  // soft clip
  for (let i = 0; i < out.length; i++) {
    const x = out[i];
    out[i] = Math.tanh(x * 1.5);
  }

  return out;
}

function concat(...chunks) {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function silence(ms) {
  const n = Math.max(1, Math.floor((ms / 1000) * SAMPLE_RATE));
  return new Float32Array(n);
}

function mix(a, b, gainA = 1, gainB = 1) {
  const n = Math.max(a.length, b.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const va = i < a.length ? a[i] * gainA : 0;
    const vb = i < b.length ? b[i] * gainB : 0;
    out[i] = clamp(va + vb, -1, 1);
  }
  return out;
}

function genAll(outDir) {
  fs.mkdirSync(outDir, { recursive: true });

  const files = [
    // UI
    {
      name: 'sfx_select.wav',
      data: makeTone({ freq: 1200, durationMs: 55, wave: 'square', volume: 0.25, attackMs: 1, decayMs: 10, sustain: 0.0, releaseMs: 25 }),
    },

    // Core play SFX
    {
      name: 'sfx_play_single.wav',
      data: makeTone({ freq: 520, durationMs: 90, wave: 'sine', volume: 0.35, attackMs: 2, decayMs: 20, sustain: 0.05, releaseMs: 50 }),
    },
    {
      name: 'sfx_play_pair.wav',
      data: concat(
        makeTone({ freq: 520, durationMs: 75, wave: 'sine', volume: 0.33, attackMs: 2, decayMs: 20, sustain: 0.08, releaseMs: 40 }),
        silence(35),
        makeTone({ freq: 660, durationMs: 75, wave: 'sine', volume: 0.33, attackMs: 2, decayMs: 20, sustain: 0.08, releaseMs: 40 })
      ),
    },
    {
      name: 'sfx_play_triple.wav',
      data: concat(
        makeTone({ freq: 520, durationMs: 60, wave: 'triangle', volume: 0.34, attackMs: 2, decayMs: 12, sustain: 0.05, releaseMs: 35 }),
        silence(25),
        makeTone({ freq: 620, durationMs: 60, wave: 'triangle', volume: 0.34, attackMs: 2, decayMs: 12, sustain: 0.05, releaseMs: 35 }),
        silence(25),
        makeTone({ freq: 740, durationMs: 70, wave: 'triangle', volume: 0.34, attackMs: 2, decayMs: 12, sustain: 0.05, releaseMs: 40 })
      ),
    },
    {
      name: 'sfx_play_straight.wav',
      data: makeTone({ freq: 320, sweepToFreq: 980, durationMs: 220, wave: 'sine', volume: 0.35, attackMs: 3, decayMs: 60, sustain: 0.18, releaseMs: 70 }),
    },
    {
      name: 'sfx_play_double_sequence.wav',
      data: concat(
        makeTone({ freq: 440, durationMs: 75, wave: 'sine', volume: 0.28, attackMs: 2, decayMs: 20, sustain: 0.08, releaseMs: 40 }),
        silence(20),
        makeTone({ freq: 554.37, durationMs: 75, wave: 'sine', volume: 0.28, attackMs: 2, decayMs: 20, sustain: 0.08, releaseMs: 40 }),
        silence(20),
        makeTone({ freq: 659.25, durationMs: 95, wave: 'sine', volume: 0.28, attackMs: 2, decayMs: 20, sustain: 0.08, releaseMs: 55 })
      ),
    },

    // Special cards
    {
      name: 'sfx_high.wav',
      data: makeTone({ freq: 880, durationMs: 110, wave: 'sine', volume: 0.32, attackMs: 2, decayMs: 25, sustain: 0.08, releaseMs: 60 }),
    },
    {
      name: 'sfx_joker.wav',
      data: concat(
        makeTone({ freq: 980, durationMs: 80, wave: 'square', volume: 0.24, attackMs: 1, decayMs: 12, sustain: 0.05, releaseMs: 55 }),
        silence(15),
        makeTone({ freq: 1308.0, durationMs: 100, wave: 'square', volume: 0.22, attackMs: 1, decayMs: 15, sustain: 0.05, releaseMs: 65 })
      ),
    },

    // Bombs
    {
      name: 'sfx_bomb.wav',
      data: mix(
        makeTone({ freq: 140, durationMs: 260, wave: 'triangle', volume: 0.55, attackMs: 1, decayMs: 80, sustain: 0.15, releaseMs: 140 }),
        makeTone({ freq: 420, durationMs: 220, wave: 'square', volume: 0.18, attackMs: 1, decayMs: 50, sustain: 0.1, releaseMs: 120 }),
        1,
        1
      ),
    },
    {
      name: 'sfx_king_bomb.wav',
      data: concat(
        mix(
          makeTone({ freq: 220, durationMs: 180, wave: 'triangle', volume: 0.55, attackMs: 1, decayMs: 60, sustain: 0.12, releaseMs: 110 }),
          makeTone({ freq: 880, durationMs: 180, wave: 'sine', volume: 0.25, attackMs: 1, decayMs: 60, sustain: 0.12, releaseMs: 110 }),
          1,
          1
        ),
        silence(35),
        makeTone({ freq: 520, sweepToFreq: 1400, durationMs: 220, wave: 'sine', volume: 0.32, attackMs: 2, decayMs: 70, sustain: 0.15, releaseMs: 120 })
      ),
    },

    // Flow
    {
      name: 'sfx_pass.wav',
      data: mix(
        makeTone({ freq: 180, durationMs: 130, wave: 'triangle', volume: 0.35, attackMs: 2, decayMs: 40, sustain: 0.05, releaseMs: 60 }),
        makeTone({ freq: 0, durationMs: 130, noise: true, volume: 0.07, attackMs: 1, decayMs: 30, sustain: 0.0, releaseMs: 60 }),
        1,
        1
      ),
    },
    {
      name: 'sfx_deal.wav',
      data: mix(
        makeTone({ freq: 0, durationMs: 140, noise: true, volume: 0.09, attackMs: 1, decayMs: 40, sustain: 0.0, releaseMs: 80 }),
        makeTone({ freq: 520, durationMs: 60, wave: 'sine', volume: 0.12, attackMs: 1, decayMs: 15, sustain: 0.03, releaseMs: 35 }),
        1,
        1
      ),
    },
    {
      name: 'sfx_start.wav',
      data: concat(
        makeTone({ freq: 440, durationMs: 90, wave: 'sine', volume: 0.28, attackMs: 2, decayMs: 20, sustain: 0.08, releaseMs: 55 }),
        silence(20),
        makeTone({ freq: 554.37, durationMs: 90, wave: 'sine', volume: 0.28, attackMs: 2, decayMs: 20, sustain: 0.08, releaseMs: 55 }),
        silence(20),
        makeTone({ freq: 659.25, durationMs: 120, wave: 'sine', volume: 0.30, attackMs: 2, decayMs: 25, sustain: 0.10, releaseMs: 75 })
      ),
    },
    {
      name: 'sfx_qi.wav',
      data: makeTone({ freq: 300, sweepToFreq: 900, durationMs: 260, wave: 'triangle', volume: 0.30, attackMs: 5, decayMs: 80, sustain: 0.15, releaseMs: 130 }),
    },
  ];

  for (const f of files) {
    const p = path.join(outDir, f.name);
    writeWav16Mono(p, f.data);
  }

  return files.map(f => f.name);
}

function main() {
  const outDir = path.join(__dirname, '..', 'assets', 'sounds');
  const names = genAll(outDir);
  console.log('Generated SFX wav files in:', outDir);
  for (const n of names) console.log(' -', n);
}

main();
