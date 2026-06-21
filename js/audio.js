// js/audio.js — chiptune 100% sintetizado con WebAudio (cero archivos, cero costo).
// Música de fondo por contexto (title/combate/Uatu) + SFX puntuales, todo generado
// con osciladores. El AudioContext arranca suspendido (política de autoplay de los
// navegadores) y se reanuda en el primer gesto del jugador (unlock).
const MUTE_KEY = 'conv_muted';

let ctx = null, master = null, musicGain = null, sfxGain = null;
let muted = false;

// Scheduler de música (patrón look-ahead estándar de WebAudio).
let musicTimer = null, curTrack = null, step = 0, nextTime = 0;
const LOOKAHEAD = 0.12, TICK_MS = 25;

const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;                          // navegador sin WebAudio: el juego sigue mudo
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.10; musicGain.connect(master);  // fondo discreto
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.32; sfxGain.connect(master);
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }  // storage off (modo privado): arranca con sonido
  master.gain.value = muted ? 0 : 0.9;
  return ctx;
}

// Reanuda el contexto tras un gesto del usuario. Resincroniza el reloj de música
// para que no se acumulen notas agendadas mientras estuvo suspendido.
export function unlock() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  nextTime = c.currentTime + 0.06;
}

// ── SFX: notita con envelope corto ─────────────────────────────────
function blip(midi, dur, type = 'square', when = 0, vol = 1) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.value = midiToFreq(midi);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(sfxGain);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// Ráfaga de ruido que decae: el impacto del golpe.
function noiseBurst(dur, vol = 0.5) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(g); g.connect(sfxGain);
  src.start(t0);
}

const seq = (notes, dur, type, vol) => notes.forEach((m, i) => blip(m, dur, type, i * dur * 0.9, vol));

const SFX = {
  ui:       () => blip(81, 0.05, 'square', 0, 0.4),                       // navegación
  hit:      () => { noiseBurst(0.16, 0.55); blip(45, 0.16, 'sawtooth', 0, 0.5); },
  coin:     () => { blip(83, 0.05, 'square', 0, 0.5); blip(88, 0.14, 'square', 0.05, 0.5); },
  win:      () => seq([72, 76, 79, 84], 0.10, 'square', 0.45),            // arpegio alegre
  lose:     () => seq([59, 55, 50], 0.16, 'triangle', 0.45),             // descenso
  champion: () => seq([72, 76, 79, 84, 79, 84], 0.14, 'square', 0.5),     // fanfarria
  gameover: () => seq([55, 51, 47, 43], 0.28, 'triangle', 0.45),         // sombrío
};

export function sfx(name) {
  if (!ensureCtx() || muted) return;
  const fn = SFX[name]; if (fn) fn();
}

// ── Música: loops chiptune por contexto ────────────────────────────
// Rejilla de corcheas: cada step toca una nota de lead + una de bass (0 = silencio).
// Notas en MIDI. Tracks cortos que loopean.
const TRACKS = {
  title: {
    bpm: 96,
    lead: [69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 67, 0, 69, 0, 0, 0],
    bass: [57, 0, 57, 0, 52, 0, 52, 0, 53, 0, 53, 0, 52, 0, 52, 0],
  },
  combat: {
    bpm: 144,
    lead: [69, 72, 76, 72, 69, 72, 76, 72, 67, 71, 74, 71, 67, 71, 74, 71],
    bass: [57, 57, 52, 52, 57, 57, 52, 52, 55, 55, 50, 50, 55, 55, 50, 50],
  },
  uatu: {
    bpm: 112,
    lead: [76, 0, 77, 0, 76, 0, 75, 0, 76, 0, 81, 0, 80, 0, 76, 0],
    bass: [57, 0, 57, 58, 57, 0, 57, 58, 53, 0, 53, 54, 53, 0, 53, 54],
  },
};

function noteAt(midi, t0, dur, type, vol) {
  if (!midi) return;                              // 0 = silencio
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.value = midiToFreq(midi);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(musicGain);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function scheduleMusic() {
  if (!ctx || !curTrack) return;
  const tr = TRACKS[curTrack];
  const stepDur = 60 / tr.bpm / 2;                // corchea
  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    noteAt(tr.lead[step % tr.lead.length], nextTime, stepDur * 0.9, 'square', 0.5);
    noteAt(tr.bass[step % tr.bass.length], nextTime, stepDur * 0.9, 'triangle', 0.55);
    nextTime += stepDur;
    step++;
  }
}

// Cambia el loop de fondo. music(null) lo detiene. Cambiar de track reinicia el loop.
export function music(track) {
  if (!ensureCtx()) return;
  if (track === curTrack) return;
  curTrack = track;
  if (!track) { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } return; }
  step = 0; nextTime = ctx.currentTime + 0.06;
  if (!musicTimer) musicTimer = setInterval(scheduleMusic, TICK_MS);
}

// ── Mute (persistente) ─────────────────────────────────────────────
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { /* sin storage: sesión */ }
  if (master) master.gain.value = m ? 0 : 0.9;
}
export function toggleMute() { setMuted(!muted); return muted; }
export function isMuted() { ensureCtx(); return muted; }
