// js/state.js — estado del torneo (sin tocar el DOM). Arma el bracket sembrado,
// lleva el daño acumulado y el saldo $UATU, y liquida las apuestas.
// El cliente NUNCA decide quién gana: eso lo hace /api/resolve (plan.md §1).
import { mulberry32, hash32 } from '../lib/prng.js';
import { ROSTER, UATU } from './config.js';

// Bono "tu elegido": $UATU que paga TU campeón por cada ronda que sobrevive
// (índice = state.round). Escala para que llegar lejos con tu elegido se sienta.
// No es apuesta: es la recompensa por identificarte (plan.md Lote 3, D2).
const CHAMP_BONUS = [25, 40, 60, 100];

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
// Marvel-vs-DC, inicializa coins y daño. Si pasas championId, ese luchador entra
// GARANTIZADO al bracket (eliges entre los 24 pero siempre compites con tu elegido).
export function createTournament(alias, torneoSeed, championId = null) {
  const marvel = seededShuffle(ROSTER.marvel, hash32(torneoSeed + ':marvel')).slice(0, 8);
  const dc     = seededShuffle(ROSTER.dc,     hash32(torneoSeed + ':dc')).slice(0, 8);

  // Garantía del elegido (Task A): si el shuffle no lo dejó entre los 8 de su
  // bando, lo metemos desplazando al último sembrado de ese lado. Sin esto, elegir
  // de los 24 podría dejar fuera del bracket justo a tu campeón.
  if (championId) {
    const inMarvel = ROSTER.marvel.some(f => f.id === championId);
    const seeded = inMarvel ? marvel : dc;
    if (!seeded.some(f => f.id === championId)) {
      const champ = (inMarvel ? ROSTER.marvel : ROSTER.dc).find(f => f.id === championId);
      if (champ) seeded[seeded.length - 1] = champ;
    }
  }

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
    // myChampion: el luchador con el que TE identificas (D2). champBonus: total
    // $UATU que te ha pagado por sobrevivir rondas (se muestra en el cierre).
    // boostsUsed: impulsos comprados en el taller (encarece el siguiente, Task B).
    myChampion: championId, champBonus: 0, boostsUsed: 0,
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

  // Bono del elegido: si TU campeón gana este combate del torneo, te paga por
  // ronda. No aplica en la pelea de Uatu (esa tiene su propio ×2 en el cierre).
  let champBonus = 0;
  if (state.phase === 'tournament' && state.myChampion && result.winnerId === state.myChampion) {
    champBonus = CHAMP_BONUS[state.round] || 25;
    state.coins += champBonus;
    state.champBonus += champBonus;
  }

  state.history.push({
    matchId: cm.matchId, winnerId: result.winnerId, loserId: result.loserId,
    bet: bet ? { fighterId: bet.fighterId, won, payout } : null,
    champBonus,
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

// ── Taller del elegido (Task B): curar daño / impulsar stats, 100% client-side ──
// El motor (lib/combat) lee stats y daño del fighter que le manda el cliente, y
// playMatch toma esos objetos de state.fighters al resolver. Mutarlos aquí cambia
// de verdad las odds y el resultado — sin tocar el servidor ni el motor.
const BOOST_STEP = 5;   // +5 a la stat elegida por cada impulso (tope 100)

// Costo del próximo impulso: 50 el primero, +25 por cada uno ya comprado.
export function boostCost(state) { return 50 + 25 * (state.boostsUsed || 0); }

// Impulsa una stat del elegido en +BOOST_STEP (tope 100). Cobra y cuenta el uso.
// Devuelve true si se aplicó (había saldo y la stat no estaba al tope).
export function boostStat(state, statKey) {
  const mc = state.myChampion && state.fighters[state.myChampion];
  if (!mc || !(statKey in mc.stats)) return false;
  const cost = boostCost(state);
  if (state.coins < cost || mc.stats[statKey] >= 100) return false;
  mc.stats[statKey] = Math.min(100, mc.stats[statKey] + BOOST_STEP);
  state.coins -= cost;
  state.boostsUsed = (state.boostsUsed || 0) + 1;
  return true;
}

// Cura daño del elegido: 1 $UATU por cada 1% de daño. Cura lo máximo que el saldo
// permita (hasta dejarlo en 0). Devuelve los puntos de daño curados.
export function healChampion(state) {
  const mc = state.myChampion && state.fighters[state.myChampion];
  if (!mc || !mc.damage) return 0;
  const pts = Math.min(Math.round(mc.damage * 100), state.coins);
  if (pts <= 0) return 0;
  mc.damage = Math.max(0, mc.damage - pts / 100);
  state.coins -= pts;
  return pts;
}
