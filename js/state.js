// js/state.js — estado del torneo (sin tocar el DOM). Arma el bracket sembrado,
// lleva el daño acumulado y el saldo $UATU, y liquida las apuestas.
// El cliente NUNCA decide quién gana: eso lo hace /api/resolve (plan.md §1).
import { mulberry32, hash32 } from '../lib/prng.js';
import { ROSTER, UATU } from './config.js';

// Fisher-Yates sembrado: misma semilla -> mismo orden (rejugabilidad).
function seededShuffle(arr, seed) {
  const a = arr.slice();
  const rng = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Copia mutable de un luchador (para no tocar el ROSTER global al acumular daño).
function fighterCopy(f) {
  return { id: f.id, name: f.name, publisher: f.publisher, archetype: f.archetype,
           stats: { ...f.stats }, damage: 0 };
}

// Crea un torneo: elige 8 de cada bando (shuffle sembrado), arma los octavos
// Marvel-vs-DC, inicializa coins y daño.
export function createTournament(alias, torneoSeed) {
  const marvel = seededShuffle(ROSTER.marvel, hash32(torneoSeed + ':marvel')).slice(0, 8);
  const dc     = seededShuffle(ROSTER.dc,     hash32(torneoSeed + ':dc')).slice(0, 8);

  const fighters = {};
  const reg = f => { fighters[f.id] = fighterCopy(f); return f.id; };

  const r1 = [];
  for (let i = 0; i < 8; i++) {
    r1.push({ matchId: `R1-M${i + 1}`, f1Id: reg(marvel[i]), f2Id: reg(dc[i]),
              winnerId: null, loserId: null, resolved: false });
  }

  return {
    alias, torneoSeed, coins: 0, fighters,
    bracket: [r1], round: 0, matchIndex: 0,
    bets: {}, history: [], phase: 'tournament', champion: null,
  };
}

// El siguiente combate pendiente. Devuelve null si el torneo terminó.
export function currentMatch(state) {
  if (state.phase === 'done') return null;
  if (state.phase === 'uatu') {
    return {
      fighter1: state.fighters[state.champion],
      fighter2: { ...UATU, stats: { ...UATU.stats }, damage: 0 },
      matchId: 'FINAL', isUatuFight: true,
    };
  }
  const m = state.bracket[state.round][state.matchIndex];
  const fighter1 = state.fighters[m.f1Id], fighter2 = state.fighters[m.f2Id];
  if (!fighter1 || !fighter2) {
    // Defensa: si un winnerId de la ronda previa llegó null/desconocido, el match
    // queda sin luchador y reventaría al renderizar (causa probable del freeze
    // en semifinales). Falla con contexto claro en vez de explotar opaco.
    throw new Error(`Combate ${m.matchId} mal formado: f1Id=${m.f1Id} f2Id=${m.f2Id}`);
  }
  return { fighter1, fighter2, matchId: m.matchId, isUatuFight: false };
}

// Registra la apuesta del combate actual. Apostar es obligatorio antes de
// resolver (spec §6) y no arriesga saldo: el acierto paga, el fallo no resta.
export function placeBet(state, fighterId, amount) {
  const cm = currentMatch(state);
  if (!cm) throw new Error('No hay combate activo');
  if (fighterId !== cm.fighter1.id && fighterId !== cm.fighter2.id) {
    throw new Error('Apuesta inválida: el luchador no está en este combate');
  }
  state.bets[cm.matchId] = { fighterId, amount: amount || 0, settled: false };
  return state;
}

// Aplica el resultado del motor: liquida la apuesta, acumula daño al ganador y
// avanza el bracket (generando la siguiente ronda al completar la actual).
export function settle(state, result) {
  const cm = currentMatch(state);
  const bet = state.bets[cm.matchId];

  let won = false, payout = 0;
  if (bet) {
    won = bet.fighterId === result.winnerId;
    if (won) {
      // Cuota tipo casa: pegarle a un underdog (P baja) paga más. Clamp para
      // que un favorito clarísimo no pague 0 y un upset no explote.
      const pPick = bet.fighterId === cm.fighter1.id ? result.probability1 : result.probability2;
      payout = Math.max(1, Math.round(bet.amount / Math.max(pPick, 0.05)));
      state.coins += payout;
    }
    bet.settled = true; bet.won = won; bet.payout = payout;
  }

  // Daño acumulado al ganador (Uatu no se registra en fighters: no reincide).
  if (state.fighters[result.winnerId]) {
    state.fighters[result.winnerId].damage = result.damageToWinner;
  }

  state.history.push({
    matchId: cm.matchId, winnerId: result.winnerId, loserId: result.loserId,
    bet: bet ? { fighterId: bet.fighterId, won, payout } : null,
  });

  if (state.phase === 'uatu') { state.phase = 'done'; return state; }

  const round = state.bracket[state.round];
  const m = round[state.matchIndex];
  m.winnerId = result.winnerId; m.loserId = result.loserId; m.resolved = true;
  state.matchIndex++;

  if (state.matchIndex >= round.length) {
    if (round.length === 1) {
      state.champion = result.winnerId;   // ganó la final del torneo
      state.phase = 'uatu';
    } else {
      const next = [];
      for (let i = 0; i < round.length; i += 2) {
        next.push({ matchId: `R${state.round + 2}-M${i / 2 + 1}`,
                    f1Id: round[i].winnerId, f2Id: round[i + 1].winnerId,
                    winnerId: null, loserId: null, resolved: false });
      }
      state.bracket.push(next);
      state.round++; state.matchIndex = 0;
    }
  }
  return state;
}

export function isUatuFight(state) { return state.phase === 'uatu'; }
export function isDone(state) { return state.phase === 'done'; }
export function champion(state) { return state.champion ? state.fighters[state.champion] : null; }
