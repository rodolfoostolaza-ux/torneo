// js/engine-client.js — orquesta un combate de punta a punta (plan.md §3).
// El cliente nunca decide el ganador: lo pide a /api/resolve y solo viste el
// resultado con /api/narrate (con fallback local si la IA falla).
import { currentMatch, placeBet, settle } from './state.js';
import { renderMatchup, renderBetControls, renderBracket, renderHeader, showDialogue, hideDialogue, applyDamageVisual } from './render.js';
import { BEATS, ARCHETYPES } from './config.js';

async function api(path, body) {
  const r = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

const winnerOf = (result, f1, f2) => (result.winnerId === f1.id ? f1 : f2);
const loserOf  = (result, f1, f2) => (result.winnerId === f1.id ? f2 : f1);

const STAT_ES = {
  intelligence: 'inteligencia', strength: 'fuerza', speed: 'velocidad',
  durability: 'resistencia', power: 'poder', combat: 'combate',
};

// Frase corta de por qué ganó: ventaja de arquetipo si la hubo, si no el stat
// donde el ganador más aventaja al perdedor. Con cierre apretado, lo matiza.
function buildReason(f1, f2, result) {
  const winner = winnerOf(result, f1, f2);
  const loser  = loserOf(result, f1, f2);
  let core;
  if (BEATS[winner.archetype] === loser.archetype) {
    core = `la ventaja ${ARCHETYPES[winner.archetype].label.toLowerCase()} fue decisiva`;
  } else {
    let bestK = 'combat', bestD = -Infinity;
    for (const k of Object.keys(STAT_ES)) {
      const d = (winner.stats[k] || 0) - (loser.stats[k] || 0);
      if (d > bestD) { bestD = d; bestK = k; }
    }
    core = `su ${STAT_ES[bestK]} superior lo decidió`;
  }
  if (result.closeness != null && result.closeness > 0.85) return `${core}, pero por un pelo`;
  return core;
}

// Narración de respaldo (cosmética) si Cerebras falla o tarda. El motor ya tiene
// la verdad; esto solo arma líneas cortas legibles.
function fallbackNarration(result, f1, f2, isUatu) {
  const winner = winnerOf(result, f1, f2);
  const loser  = loserOf(result, f1, f2);
  if (isUatu) {
    const champ = winner.id === 'uatu' ? loser : winner;
    const champWon = winner.id !== 'uatu';
    if (champWon) {
      return {
        lines: [
          `Uatu pone a prueba a ${champ.name}.`,
          `${buildReason(f1, f2, result)}.`,
          `El multiverso contiene el aliento.`,
        ],
        loserFate: `Uatu se inclina: la prueba ha sido superada.`,
        winnerScar: `${champ.name} arde con cicatrices cósmicas.`,
      };
    }
    return {
      lines: [
        `Uatu pone a prueba a ${champ.name}.`,
        `${champ.name} no da el ancho.`,
        `Uatu suspira: otro multiverso a la basura.`,
      ],
      loserFate: `${champ.name} cae; el Observador ni se inmuta.`,
      winnerScar: `El multiverso colapsa. Uatu ya busca al siguiente.`,
    };
  }
  return {
    lines: [
      `${winner.name} se impone sobre ${loser.name}.`,
      `${buildReason(f1, f2, result)}.`,
      `El público enmudece.`,
    ],
    loserFate: `${loser.name} cae derrotado.`,
    winnerScar: `${winner.name} sigue en pie, marcado por el duelo.`,
  };
}

export async function playMatch(state, dialogue) {
  const { fighter1, fighter2, matchId, isUatuFight } = currentMatch(state);
  renderHeader(state);

  // 1) odds (sin revelar resultado)
  const odds = await api('/api/resolve',
    { fighter1, fighter2, torneoSeed: state.torneoSeed, matchId, reveal: false });
  renderMatchup(fighter1, fighter2, odds, isUatuFight);

  // 2) apuesta obligatoria
  const bet = await renderBetControls(fighter1, fighter2, state.coins);
  placeBet(state, bet.fighterId, bet.amount);

  // 3) resolver (el motor decide)
  const result = await api('/api/resolve',
    { fighter1, fighter2, torneoSeed: state.torneoSeed, matchId, reveal: true });

  // 4) narración (con fallback si la IA falla)
  const winner = winnerOf(result, fighter1, fighter2);
  const loser  = loserOf(result, fighter1, fighter2);
  const reason = buildReason(fighter1, fighter2, result);
  let narr;
  try {
    narr = await api('/api/narrate', { winner, loser, reason, matchId, isUatuFight });
  } catch {
    narr = fallbackNarration(result, fighter1, fighter2, isUatuFight);
  }
  const lines = (narr.lines && narr.lines.length)
    ? narr.lines : fallbackNarration(result, fighter1, fighter2, isUatuFight).lines;
  const tail = [narr.loserFate, narr.winnerScar].filter(Boolean);
  showDialogue();
  await dialogue.show([...lines, ...tail]);
  hideDialogue();

  // 4b) golpe visual sobre las cartas aún en pantalla: el perdedor queda roto.
  await applyDamageVisual(result.winnerId, result.loserId, result.damageToWinner);

  // 5) liquidar y avanzar
  settle(state, result);
  renderHeader(state);
  renderBracket(state);
}
