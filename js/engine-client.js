// js/engine-client.js — orquesta un combate de punta a punta (plan.md §3).
// El cliente nunca decide el ganador: lo pide a /api/resolve y solo viste el
// resultado con /api/narrate (con fallback local si la IA falla).
import { currentMatch, placeBet, settle } from './state.js';
import { renderMatchup, renderBetControls, renderBracket, renderHeader, showDialogue, hideDialogue, applyDamageVisual } from './render.js';
import { BEATS, ARCHETYPES } from './config.js';
import * as audio from './audio.js';

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

// Cerebras free tier = 30 req/min (≈1 cada 2s). lastNarrateAt serializa las
// llamadas a /api/narrate para no reventar ese límite (ver throttle en playMatch):
// así la narración viene de la IA y no del fallback genérico.
const NARRATE_GAP_MS = 2100;
let lastNarrateAt = 0;
// Reinicia el throttle al arrancar una partida nueva: sin esto, el lastNarrateAt de
// la partida anterior puede forzar una espera fantasma de hasta ~2s en la 1ª narración.
export function resetNarrateThrottle() { lastNarrateAt = 0; }

// POST con reintento corto: un fallo transitorio de /api/resolve (red, cold start,
// 5xx) NO debe congelar el torneo, y un 429/5xx de /api/narrate merece otra
// oportunidad antes de caer al fallback. Los 4xx (403 CORS, 400) son
// determinísticos: no se reintentan porque no van a cambiar.
async function api(path, body, { retries = 2, backoff = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let r;
    try {
      r = await fetch(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      lastErr = e;                                    // error de red: reintentable
      if (attempt < retries) { await sleep(backoff * (attempt + 1)); continue; }
      throw lastErr;
    }
    if (r.ok) return r.json();
    if (r.status < 500 && r.status !== 429) throw new Error(`${path} ${r.status}`);
    lastErr = new Error(`${path} ${r.status}`);       // 5xx/429: reintentable
    if (attempt < retries) await sleep(backoff * (attempt + 1));
  }
  throw lastErr;
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
// la verdad; esto solo arma líneas cortas legibles + diálogo crudo del ganador y
// perdedor (winnerLine/loserLine, SIN nombre: el cliente los formatea igual que la IA).
function fallbackNarration(result, f1, f2, isUatu) {
  const winner = winnerOf(result, f1, f2);
  const loser  = loserOf(result, f1, f2);
  if (isUatu) {
    const champ = winner.id === 'uatu' ? loser : winner;
    const champWon = winner.id !== 'uatu';
    if (champWon) {
      return {
        lines: [
          `${champ.name} encara la prueba final del Observador.`,
          `El multiverso entero contiene el aliento.`,
          `Contra todo pronóstico, ${champ.name} sigue en pie.`,
        ],
        winnerLine: `El multiverso no cae hoy.`,             // lo dice el campeón (winner)
        loserLine: `Te has mostrado digno. Pocos lo logran.`, // lo concede Uatu (loser)
      };
    }
    return {
      lines: [
        `${champ.name} encara la prueba final del Observador.`,
        `Uatu lo halla falto.`,
        `${champ.name} se apaga ante la mirada cósmica.`,
      ],
      winnerLine: `Otro multiverso a la basura. Siguiente.`,  // lo dice Uatu (winner)
      loserLine: `No... alcancé...`,                          // lo dice el campeón (loser)
    };
  }
  return {
    lines: [
      `${winner.name} y ${loser.name} chocan sin tregua.`,
      `${buildReason(f1, f2, result)}.`,
      `${winner.name} se impone.`,
    ],
    winnerLine: `Buena pelea. Pero el que queda en pie soy yo.`,
    loserLine: `Esto... no se queda así.`,
  };
}

// Formatea una cita en caja RPG: «lo que dice» atribuido al personaje. Mismo formato
// para el careo local y para el diálogo post de la IA (que viene crudo, sin nombre).
const formatDialogue = (f, line) => `${f.name}: «${line}»`;

// Bravatas de careo por arquetipo (1ª persona). El careo PRE-combate es local (sin
// API: no gasta el cupo de Cerebras) y determinista: mismo combate → mismo careo.
const TAUNTS = {
  fuerza:    ['Te voy a partir en dos.', 'Aquí se acaba tu suerte.', 'No hay nada que aguante esto.'],
  velocista: ['Ni me vas a ver venir.', 'Para cuando reacciones, ya gané.', 'Demasiado lento para mí.'],
  tecnologo: ['Ya calculé tu derrota.', 'Tengo respuesta para todo lo que hagas.', 'La cabeza gana esto, no los puños.'],
  mistico:   ['El destino ya te condenó.', 'Fuerzas que no entiendes te van a tragar.', 'Tu final ya está escrito.'],
  peleador:  ['He vencido cosas peores que tú.', 'Pura técnica contra tu desorden.', 'Lo único que sé hacer es ganar.'],
};

// Careo PRE-combate (DIÁLOGO entre los dos personajes, no narración descriptiva).
// Cada uno suelta una bravata en su voz según su arquetipo, elegida de forma
// determinista. Garantiza "diálogo entre personajes antes de la pelea" aunque la
// IA del post falle, sin gastar cupo de Cerebras.
function preMatchLines(f1, f2, isUatu) {
  if (isUatu) {
    return [
      formatDialogue(f1, 'He cruzado el puente entero. No me detengo aquí.'),
      `Uatu el Observador no responde. La prueba final comienza.`,
    ];
  }
  const pick = (f, salt) => {
    const arr = TAUNTS[f.archetype] || TAUNTS.peleador;
    const h = (f.id + salt).split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return arr[h % arr.length];
  };
  return [
    formatDialogue(f1, pick(f1, f2.id)),
    formatDialogue(f2, pick(f2, f1.id)),
  ];
}

// Línea de DAÑO REAL del motor: result.damageToWinner es el daño total que el ganador
// arrastra (state.fighters[winnerId].damage), y a ≥0.5 su retrato se rompe (DMG_ROTO).
// Esta línea hace VISIBLE ese costo en texto — sustituye la vieja "cicatriz cósmica"
// inventada por el número que el motor ya calculó. Vacía si no hubo daño.
function damageLine(winner, dmg) {
  const d = dmg || 0;
  if (d >= 0.5)  return `${winner.name} avanza malherido: cargará ese daño a la próxima ronda.`;
  if (d >= 0.25) return `${winner.name} sale tocado del combate.`;
  if (d > 0)     return `${winner.name} sale casi intacto.`;
  return '';
}

export async function playMatch(state, dialogue) {
  const { fighter1, fighter2, matchId, isUatuFight } = currentMatch(state);
  audio.music(isUatuFight ? 'uatu' : 'combat');   // el fondo cambia según el peso del combate
  renderHeader(state);

  // 1) odds (sin revelar resultado)
  const odds = await api('/api/resolve',
    { fighter1, fighter2, torneoSeed: state.torneoSeed, matchId, reveal: false });
  renderMatchup(fighter1, fighter2, odds, isUatuFight, state.myChampion);
  renderBracket(state);   // contexto visible mientras apuestas: resultados + daño en vivo

  // En un reintento de combate ya apostaste: no repitas ni el pre-combate ni el
  // widget de apuesta (el estado quedó intacto, settle solo corre al final).
  const existingBet = state.bets[matchId];

  // 1b) PRE-COMBATE: presentación local, un beat propio antes de apostar.
  if (!existingBet) {
    try {
      showDialogue();
      await dialogue.show(preMatchLines(fighter1, fighter2, isUatuFight));
    } finally {
      hideDialogue();
    }
  }

  // 2) apuesta obligatoria.
  if (!existingBet || existingBet.settled) {
    const bet = await renderBetControls(fighter1, fighter2, state.coins);
    placeBet(state, bet.fighterId, bet.amount);
  }

  // 3) resolver (el motor decide)
  const result = await api('/api/resolve',
    { fighter1, fighter2, torneoSeed: state.torneoSeed, matchId, reveal: true });

  // 4) narración (con fallback si la IA falla)
  const winner = winnerOf(result, fighter1, fighter2);
  const loser  = loserOf(result, fighter1, fighter2);
  const reason = buildReason(fighter1, fighter2, result);

  // Throttle anti-429: espacia las narraciones ≥2.1s para no reventar el límite de
  // 30/min de Cerebras. Frena el juego un pelín solo si vas muy rápido; si ya
  // tardaste leyendo, no añade espera. Garantiza narración de IA, no fallback.
  const sinceLast = Date.now() - lastNarrateAt;
  if (sinceLast < NARRATE_GAP_MS) await sleep(NARRATE_GAP_MS - sinceLast);

  let narr;
  try {
    narr = await api('/api/narrate', { winner, loser, reason, matchId, isUatuFight });
  } catch (e) {
    console.warn('[narrate] Cerebras no disponible, uso narración local:', e.message);
    narr = fallbackNarration(result, fighter1, fighter2, isUatuFight);
  }
  lastNarrateAt = Date.now();
  const fb = fallbackNarration(result, fighter1, fighter2, isUatuFight);
  const lines = (narr.lines && narr.lines.length) ? narr.lines : fb.lines;
  const winnerLine = narr.winnerLine || fb.winnerLine;
  const loserLine  = narr.loserLine  || fb.loserLine;

  // CONSECUENCIAS = beat post-golpe: el perdedor reacciona en su voz, el ganador
  // remata, y (solo en combate normal) la línea de DAÑO REAL del motor hace visible
  // el costo que el ganador arrastra. En la prueba de Uatu no reincide nadie: el
  // epílogo cierra esa historia, no una línea de daño que iría a una ronda inexistente.
  const post = [
    formatDialogue(loser, loserLine),
    formatDialogue(winner, winnerLine),
    isUatuFight ? '' : damageLine(winner, result.damageToWinner),
  ].filter(Boolean);

  // DESARROLLO → golpe visual → CONSECUENCIAS. El golpe parte la narración: la
  // pelea revela al ganador, las cartas se sacuden y el perdedor queda roto, y
  // recién entonces caen las consecuencias (diálogo + daño) como beat aparte.
  try {
    showDialogue();
    await dialogue.show(lines);
    await applyDamageVisual(result.winnerId, result.loserId, result.damageToWinner);
    if (post.length) await dialogue.show(post);
  } finally {
    hideDialogue();   // pase lo que pase, no dejar el diálogo ni su listener colgado
  }

  // 5) liquidar y avanzar
  settle(state, result);
  const last = state.history.at(-1);   // ¿premio? acertaste la apuesta o tu elegido avanzó
  if (last && ((last.bet && last.bet.won) || last.champBonus > 0)) audio.sfx('coin');
  renderHeader(state);
  renderBracket(state);
}
