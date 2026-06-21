// js/main.js — punto de entrada. Pide alias, crea el torneo y corre el loop de
// combates hasta el cierre contra Uatu.
import { DialogueBox } from './dialogue.js';
import { renderAlias, renderEnding, renderFatal, renderIntro, renderStatsAttract, renderChampionSelect, renderRoundTransition } from './render.js';
import { createTournament, isDone } from './state.js';
import { playMatch, resetNarrateThrottle } from './engine-client.js';
import * as audio from './audio.js';

// Monta el control de sonido: botón de mute flotante (persistente), desbloqueo del
// AudioContext al primer gesto (política de autoplay) y un blip de navegación en
// cualquier botón del juego. Se llama una sola vez al arrancar.
function mountAudio() {
  const btn = document.createElement('button');
  btn.id = 'audio-toggle';
  btn.type = 'button';
  btn.className = 'audio-toggle';
  const paint = () => {
    btn.textContent = audio.isMuted() ? '🔇' : '🔊';
    btn.setAttribute('aria-label', audio.isMuted() ? 'Activar sonido' : 'Silenciar');
  };
  paint();
  btn.addEventListener('click', e => {
    e.stopPropagation();             // no dispara el blip ni los listeners de pantalla
    audio.unlock();
    audio.toggleMute();
    paint();
  });
  document.body.appendChild(btn);

  // Primer gesto del usuario: reanuda el contexto (los navegadores no dejan sonar antes).
  const unlockOnce = () => audio.unlock();
  document.addEventListener('pointerdown', unlockOnce, { once: true });
  document.addEventListener('keydown', unlockOnce, { once: true });

  // Blip corto en cada botón (navegación). El toggle se excluye (su click no propaga).
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && b.id !== 'audio-toggle') audio.sfx('ui');
  });
}

// Semilla de la partida. En Fase 1 se genera en el cliente (el resultado de cada
// pelea sigue siendo determinista server-side a partir de ella); mover su origen
// al servidor es parte del anti-cheat de Fase 4 (plan.md §9).
function newSeed() { return Math.floor(Math.random() * 0x7fffffff) >>> 0; }

const MAX_FAILS = 5;   // tope de reintentos del MISMO combate antes de rendirse

async function runTournament(alias) {
  audio.music('title');            // ambiente de menú para la selección (y reset en replay)
  const state = createTournament(alias, newSeed());
  state.myChampion = await renderChampionSelect(state);   // D2: eliges tu elegido
  const dialogue = new DialogueBox(document.getElementById('dialogue'));
  resetNarrateThrottle();          // partida nueva: sin espera fantasma heredada
  let fails = 0;
  while (!isDone(state)) {
    try {
      await renderRoundTransition(state);   // pacing: cartel de ronda antes del combate
      await playMatch(state, dialogue);
      fails = 0;                   // avanzó: limpia el contador
    } catch (e) {
      // Un combate que truena (red caída, /api/resolve 5xx tras agotar reintentos)
      // NO debe congelar el torneo en silencio: reintentamos el MISMO combate (el
      // estado queda intacto, settle sólo corre al final). Pero CON TOPE: si el
      // servidor está caído de verdad, no martillamos infinito — avisamos y paramos.
      fails++;
      console.error(`[torneo] combate falló (${fails}/${MAX_FAILS}):`, e.message);
      if (fails >= MAX_FAILS) {
        renderFatal('El torneo no pudo continuar: el servidor no responde. Reintenta.');
        return;
      }
      await new Promise(res => setTimeout(res, 1500 * fails));   // backoff creciente
    }
  }
  await renderEnding(state, () => runTournament(alias));
}

async function main() {
  mountAudio();                    // control de sonido + desbloqueo por gesto
  audio.music('title');            // tema heroico desde la intro (suena al primer toque)
  await renderIntro();             // monta la Convergencia (solo en arranque fresco)
  await renderStatsAttract();      // atract-mode: cómo se lee una ficha (saltable)
  const alias = await renderAlias();
  await runTournament(alias);
}

main();
