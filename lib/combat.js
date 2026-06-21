// lib/combat.js — motor puro de combate (sin I/O). Es la fuente de verdad del
// resultado de cada pelea (constitution #2). Todas las constantes son de arranque
// y se afinan jugando (plan.md §9).
import { mulberry32, hash32 } from './prng.js';

export const BEATS = {
  mistico:   'fuerza',
  fuerza:    'peleador',
  peleador:  'tecnologo',
  tecnologo: 'velocista',
  velocista: 'mistico',
};

export const ADV_BONUS = 0.25; // +25% al poder del que tiene ventaja de arquetipo
export const DMG_CAP   = 0.50; // el daño acumulado merma hasta 50% del poder
export const K         = 2;    // exponente Bradley-Terry (acentúa al favorito)
export const DMG_BLOW  = 0.35; // daño base que recibe el ganador

// Media simple de los 6 stats.
export function cpBase(f) {
  const s = f.stats;
  return (s.intelligence + s.strength + s.speed + s.durability + s.power + s.combat) / 6;
}

// Multiplicador por ventaja de arquetipo de `f` frente a `opp`.
export function multArq(f, opp) {
  return BEATS[f.archetype] === opp.archetype ? 1 + ADV_BONUS : 1;
}

// Poder efectivo: base * ventaja * merma por daño. El daño se clampa a [0,1] y el
// resultado lleva un piso > 0: con data inesperada (stats en 0 o daño fuera de
// rango) cpEff jamás es 0 ni negativo, así winProb nunca devuelve NaN ni 0/1.
export function cpEff(f, opp) {
  const dmg = Math.min(1, Math.max(0, f.damage || 0));
  return Math.max(1e-6, cpBase(f) * multArq(f, opp) * (1 - DMG_CAP * dmg));
}

// Probabilidad de que f1 gane (Bradley-Terry con exponente K).
export function winProb(f1, f2) {
  const a = Math.pow(cpEff(f1, f2), K);
  const b = Math.pow(cpEff(f2, f1), K);
  return a / (a + b);
}

// Resuelve el combate. reveal:false -> solo odds. reveal:true -> ganador real.
export function resolve(f1, f2, torneoSeed, matchId, reveal) {
  const p1 = winProb(f1, f2);
  const p2 = 1 - p1;
  if (!reveal) return { probability1: p1, probability2: p2 };

  const rng = mulberry32(hash32(torneoSeed + ':' + matchId));
  const f1Wins = rng() < p1;
  const winner = f1Wins ? f1 : f2;
  const pWinner = f1Wins ? p1 : p2;
  const damageToWinner = Math.min(1, (winner.damage || 0) + DMG_BLOW * (1 - pWinner));

  return {
    winnerId: winner.id,
    loserId:  f1Wins ? f2.id : f1.id,
    probability1: p1,
    probability2: p2,
    damageToWinner,
    closeness: 1 - Math.abs(p1 - p2), // 1 = parejísimo, 0 = paliza
  };
}
