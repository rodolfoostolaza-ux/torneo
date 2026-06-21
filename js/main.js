// js/main.js — punto de entrada. Pide alias, crea el torneo y corre el loop de
// combates hasta el cierre contra Uatu.
import { DialogueBox } from './dialogue.js';
import { renderAlias, renderClose } from './render.js';
import { createTournament, isDone } from './state.js';
import { playMatch } from './engine-client.js';

// Semilla de la partida. En Fase 1 se genera en el cliente (el resultado de cada
// pelea sigue siendo determinista server-side a partir de ella); mover su origen
// al servidor es parte del anti-cheat de Fase 4 (plan.md §9).
function newSeed() { return Math.floor(Math.random() * 0x7fffffff) >>> 0; }

async function runTournament(alias) {
  const state = createTournament(alias, newSeed());
  const dialogue = new DialogueBox(document.getElementById('dialogue'));
  while (!isDone(state)) {
    try {
      await playMatch(state, dialogue);
    } catch (e) {
      // Un combate que truena (red caída, /api/resolve 5xx tras agotar reintentos)
      // NO debe congelar el torneo en silencio. playMatch sólo avanza el bracket al
      // final (settle); si revienta antes, el estado queda intacto y reintentamos
      // el mismo combate. Evita el freeze mudo en semifinales.
      console.error('[torneo] combate falló, reintento en 1.5s:', e.message);
      await new Promise(res => setTimeout(res, 1500));
    }
  }
  renderClose(state, () => runTournament(alias));
}

async function main() {
  const alias = await renderAlias();
  await runTournament(alias);
}

main();
