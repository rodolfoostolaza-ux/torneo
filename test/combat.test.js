import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, winProb, BEATS } from '../lib/combat.js';

const FLAT = { intelligence: 50, strength: 50, speed: 50, durability: 50, power: 50, combat: 50 };
const mk = (id, archetype, stats = FLAT, damage = 0) => ({ id, name: id, archetype, stats, damage });

test('mismo seed + matchId -> mismo resultado (reproducible)', () => {
  const a = mk('A', 'fuerza'), b = mk('B', 'peleador');
  const r1 = resolve(a, b, 12345, 'R1-M1', true);
  const r2 = resolve(a, b, 12345, 'R1-M1', true);
  assert.equal(r1.winnerId, r2.winnerId);
  assert.equal(r1.damageToWinner, r2.damageToWinner);
});

test('ventaja de arquetipo sesga la probabilidad con stats iguales (>=0.6)', () => {
  assert.equal(BEATS.fuerza, 'peleador'); // fuerza vence a peleador
  const p = winProb(mk('F', 'fuerza'), mk('P', 'peleador'));
  assert.ok(p >= 0.6, `esperaba P>=0.6, fue ${p}`);
});

test('más daño acumulado reduce la probabilidad', () => {
  const rival = mk('R', 'peleador');
  const sano = winProb(mk('S', 'peleador', FLAT, 0), rival);
  const herido = winProb(mk('S', 'peleador', FLAT, 0.5), rival);
  assert.ok(herido < sano, `herido ${herido} debe ser < sano ${sano}`);
});

test('la probabilidad nunca es 0 ni 1', () => {
  const fuerte = mk('F', 'fuerza', { intelligence:100,strength:100,speed:100,durability:100,power:100,combat:100 });
  const debil  = mk('D', 'tecnologo', { intelligence:1,strength:1,speed:1,durability:1,power:1,combat:1 });
  const p = winProb(fuerte, debil);
  assert.ok(p > 0 && p < 1, `P fuera de rango: ${p}`);
});
