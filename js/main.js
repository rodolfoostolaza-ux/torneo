// js/main.js — punto de entrada. Pide alias, crea el torneo y corre el loop de
// combates hasta el cierre contra Uatu.
import { DialogueBox } from './dialogue.js';
import { renderAlias, renderClose, renderFatal } from './render.js';
import { createTournament, isDone } from './state.js';
import { playMatch, resetNarrateThrottle } from './engine-client.js';

// Semilla de la partida. En Fase 1 se genera en el cliente (el resultado de cada
// pelea sigue siendo determinista server-side a partir de ella); mover su origen
// al servidor es parte del anti-cheat de Fase 4 (plan.md §9).
function newSeed() { return Math.floor(Math.random() * 0x7fffffff) >>> 0; }

const MAX_FAILS = 5;   // tope de reintentos del MISMO combate antes de rendirse

async function runTournament(alias) {
  const state = createTournament(alias, newSeed());
  const dialogue = new DialogueBox(document.getElementById('dialogue'));
  resetNarrateThrottle();          // partida nueva: sin espera fantasma heredada
  let fails = 0;
  while (!isDone(state)) {
    try {
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
  renderClose(state, () => runTournament(alias));
}

async function main() {
  const alias = await renderAlias();
  await runTournament(alias);
}

main();
