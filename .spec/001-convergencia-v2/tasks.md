# Tareas — CONVERGENCIA v2 · Fase 1

> **Para ejecución:** sub-skill recomendado `superpowers:subagent-driven-development`
> o `superpowers:executing-plans`. Los pasos usan checkbox (`- [ ]`) para tracking.

**Meta de Fase 1:** un juego completo jugable de punta a punta, distinto de v1 —
reskin SNES + roster 12v12 + motor de combate determinista server-side + apuestas en
$UATU + IA narrando en cajas RPG cortas + final contra Uatu.

**Arquitectura:** ver `plan.md`. **Spec:** `spec.md`. **Constitution:** `../../constitution.md`.

**Stack:** vanilla HTML/CSS/JS (ES modules, sin build), funciones serverless Vercel,
tests con `node:test` nativo. Sin dependencias nuevas.

**Verificación global de Fase 1 (al terminar todas las tareas):**
- `node --test` pasa (motor).
- `vercel dev` (o `npm run dev` si se agrega) sirve el juego; se juega un torneo entero
  apostando en cada combate, con narración corta, hasta el cierre contra Uatu.

---

## Componente A — Datos y triángulo

### Tarea A1: `js/config.js` — roster, stats, arquetipos, triángulo

**Files:**
- Create: `js/config.js`

- [ ] **Paso 1: Crear el archivo con arquetipos y triángulo**

```js
// js/config.js — datos del juego (sin lógica). ES module.

// Los 5 arquetipos (spec §2.2). Claves internas en minúscula sin acento.
export const ARCHETYPES = {
  peleador:  { icon: '🥊', label: 'Peleador'   },
  velocista: { icon: '⚡', label: 'Velocista'  },
  fuerza:    { icon: '💪', label: 'Fuerza'     },
  mistico:   { icon: '🔮', label: 'Místico'    },
  tecnologo: { icon: '🧠', label: 'Tecnólogo'  },
};

// Triángulo cíclico: cada arquetipo vence a UNO (spec §2.2). Duplicado del que
// vive en lib/combat.js A PROPÓSITO: el cliente lo usa para pintar pistas de
// matchup; el motor (server) tiene su propia copia autoritativa.
export const BEATS = {
  mistico:   'fuerza',
  fuerza:    'peleador',
  peleador:  'tecnologo',
  tecnologo: 'velocista',
  velocista: 'mistico',
};
```

- [ ] **Paso 2: Agregar el roster 12v12 con arquetipos (spec §2.1)**

Portar los stats desde `HARDCODED_STATS` del `index.html` de v1 (rama `convergencia-v1`
o el `master` actual) para cada personaje que exista ahí; para los que falten, asignar
6 stats coherentes en escala 0–100. Cada entrada: `{ id, name, publisher, archetype, stats:{intelligence,strength,speed,durability,power,combat} }`.

```js
export const ROSTER = {
  marvel: [
    { id: 'spiderman',     name: 'Spider-Man',      publisher: 'Marvel', archetype: 'velocista', stats: {/* portar de v1 */} },
    { id: 'ironman',       name: 'Iron Man',        publisher: 'Marvel', archetype: 'tecnologo', stats: {/* ... */} },
    { id: 'thor',          name: 'Thor',            publisher: 'Marvel', archetype: 'mistico',   stats: {/* ... */} },
    { id: 'hulk',          name: 'Hulk',            publisher: 'Marvel', archetype: 'fuerza',    stats: {/* ... */} },
    { id: 'capamerica',    name: 'Captain America', publisher: 'Marvel', archetype: 'peleador',  stats: {/* ... */} },
    { id: 'wolverine',     name: 'Wolverine',       publisher: 'Marvel', archetype: 'peleador',  stats: {/* ... */} },
    { id: 'deadpool',      name: 'Deadpool',        publisher: 'Marvel', archetype: 'peleador',  stats: {/* ... */} },
    { id: 'drstrange',     name: 'Doctor Strange',  publisher: 'Marvel', archetype: 'mistico',   stats: {/* ... */} },
    { id: 'thanos',        name: 'Thanos',          publisher: 'Marvel', archetype: 'fuerza',    stats: {/* ... */} },
    { id: 'blackpanther',  name: 'Black Panther',   publisher: 'Marvel', archetype: 'peleador',  stats: {/* ... */} },
    { id: 'venom',         name: 'Venom',           publisher: 'Marvel', archetype: 'fuerza',    stats: {/* ... */} },
    { id: 'magneto',       name: 'Magneto',         publisher: 'Marvel', archetype: 'mistico',   stats: {/* ... */} },
  ],
  dc: [
    { id: 'batman',        name: 'Batman',          publisher: 'DC', archetype: 'tecnologo', stats: {/* ... */} },
    { id: 'superman',      name: 'Superman',        publisher: 'DC', archetype: 'fuerza',    stats: {/* ... */} },
    { id: 'wonderwoman',   name: 'Wonder Woman',    publisher: 'DC', archetype: 'peleador',  stats: {/* ... */} },
    { id: 'flash',         name: 'Flash',           publisher: 'DC', archetype: 'velocista', stats: {/* ... */} },
    { id: 'aquaman',       name: 'Aquaman',         publisher: 'DC', archetype: 'fuerza',    stats: {/* ... */} },
    { id: 'joker',         name: 'Joker',           publisher: 'DC', archetype: 'tecnologo', stats: {/* ... */} },
    { id: 'harley',        name: 'Harley Quinn',    publisher: 'DC', archetype: 'peleador',  stats: {/* ... */} },
    { id: 'greenlantern',  name: 'Green Lantern',   publisher: 'DC', archetype: 'mistico',   stats: {/* ... */} },
    { id: 'shazam',        name: 'Shazam',          publisher: 'DC', archetype: 'mistico',   stats: {/* ... */} },
    { id: 'blackadam',     name: 'Black Adam',      publisher: 'DC', archetype: 'fuerza',    stats: {/* ... */} },
    { id: 'lexluthor',     name: 'Lex Luthor',      publisher: 'DC', archetype: 'tecnologo', stats: {/* ... */} },
    { id: 'darkseid',      name: 'Darkseid',        publisher: 'DC', archetype: 'fuerza',    stats: {/* ... */} },
  ],
};

// Uatu: el jefe final (spec §3.1 paso 5). Stats altísimos pero no infinitos.
export const UATU = {
  id: 'uatu', name: 'Uatu el Observador', publisher: 'Marvel', archetype: 'mistico',
  stats: { intelligence: 100, strength: 90, speed: 95, durability: 100, power: 100, combat: 85 },
};
```

- [ ] **Paso 3: Verificar que carga y que cada arquetipo tiene una entrada en BEATS**

Verificación manual rápida (en `node`):
```bash
node -e "import('./js/config.js').then(m=>{const a=Object.keys(m.ARCHETYPES);const ok=a.every(k=>k in m.BEATS||Object.values(m.BEATS).includes(k));console.log('roster',m.ROSTER.marvel.length,m.ROSTER.dc.length,'beats-ok',ok);})"
```
Esperado: `roster 12 12 beats-ok true`.

- [ ] **Paso 4: Commit**
```bash
git add js/config.js
git commit -m "feat(config): roster 12v12, arquetipos y triángulo de v2"
```

---

## Componente B — Motor puro (con tests)

### Tarea B1: `lib/prng.js` — PRNG sembrado determinista

**Files:**
- Create: `lib/prng.js`

- [ ] **Paso 1: Escribir el PRNG**

```js
// lib/prng.js — generador pseudoaleatorio determinista. Mismo seed -> misma secuencia.

// mulberry32: dado un entero, devuelve una función que produce floats en [0,1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// hash32 (xmur3): convierte un string en un entero de 32 bits, para sembrar a
// partir de `torneoSeed + ':' + matchId`.
export function hash32(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
```

- [ ] **Paso 2: Commit**
```bash
git add lib/prng.js
git commit -m "feat(engine): PRNG sembrado (mulberry32 + hash32)"
```

### Tarea B2: `test/combat.test.js` — tests que fallan (TDD rojo)

**Files:**
- Create: `test/combat.test.js`

- [ ] **Paso 1: Escribir los tests (apuntan a `lib/combat.js`, que aún no existe)**

```js
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
```

- [ ] **Paso 2: Correr y confirmar que FALLA (rojo)**
```bash
node --test
```
Esperado: FALLA con error de import (`lib/combat.js` no existe). Eso confirma que los
tests corren y aún no hay implementación.

### Tarea B3: `lib/combat.js` — implementar el motor (TDD verde)

**Files:**
- Create: `lib/combat.js`

- [ ] **Paso 1: Implementar el motor**

```js
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

// Poder efectivo: base * ventaja * merma por daño.
export function cpEff(f, opp) {
  return cpBase(f) * multArq(f, opp) * (1 - DMG_CAP * (f.damage || 0));
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
```

- [ ] **Paso 2: Correr y confirmar que PASA (verde)**
```bash
node --test
```
Esperado: los 4 tests PASAN.

- [ ] **Paso 3: Commit**
```bash
git add lib/combat.js test/combat.test.js
git commit -m "feat(engine): motor de combate determinista + tests"
```

---

## Componente C — Motor en serverless

### Tarea C1: `api/resolve.js` — exponer el motor por HTTP

**Files:**
- Create: `api/resolve.js`
- Reference: `api/narrate.js` (mismo patrón de candado de Origin)

- [ ] **Paso 1: Escribir el handler**

```js
// api/resolve.js — wrapper serverless del motor. Mismo candado de Origin que
// narrate.js. NO contiene lógica de combate: solo envuelve lib/combat.resolve.
import { resolve } from '../lib/combat.js';

export default async function handler(req, res) {
  const stripSlash = s => s.replace(/\/+$/, '');
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://torneo-convergencia.vercel.app')
    .split(',').map(s => stripSlash(s.trim())).filter(Boolean);
  const origin = stripSlash(req.headers.origin || '');
  const isAllowed = allowed.includes(origin);

  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowed) return res.status(403).json({ error: 'Origin not allowed' });

  const { fighter1, fighter2, torneoSeed, matchId, reveal } = req.body || {};
  if (!fighter1 || !fighter2 || torneoSeed == null || !matchId) {
    return res.status(400).json({ error: 'Missing combat data' });
  }
  try {
    return res.status(200).json(resolve(fighter1, fighter2, torneoSeed, matchId, !!reveal));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
```

- [ ] **Paso 2: Verificar con `vercel dev` (smoke test)**
```bash
# en otra terminal: vercel dev
curl -s -X POST http://localhost:3000/api/resolve \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"fighter1":{"id":"a","archetype":"fuerza","stats":{"intelligence":50,"strength":50,"speed":50,"durability":50,"power":50,"combat":50},"damage":0},"fighter2":{"id":"b","archetype":"peleador","stats":{"intelligence":50,"strength":50,"speed":50,"durability":50,"power":50,"combat":50},"damage":0},"torneoSeed":12345,"matchId":"R1-M1","reveal":true}'
```
Esperado: JSON con `winnerId`, `probability1≈0.61`, `damageToWinner`. Nota: agregar
`http://localhost:3000` a `ALLOWED_ORIGINS` en `.env.local` para el dev.

- [ ] **Paso 3: Commit**
```bash
git add api/resolve.js
git commit -m "feat(api): endpoint /api/resolve (motor server-side)"
```

---

## Componente D — Estética SNES + cajas de diálogo

### Tarea D1: `css/snes.css` — estética 16-bit base

**Files:**
- Create: `css/snes.css`

- [ ] **Paso 1: Definir paleta, fuente pixel y caja de diálogo RPG**

Requisitos concretos (no "estilízalo bonito"):
- Cargar fuente pixel `Press Start 2P` (Google Fonts) y aplicarla global.
- `image-rendering: pixelated` global.
- Variables de paleta acotada: `--bg:#0b1026; --panel:#1a2250; --ink:#e8e8ff; --accent:#ffd447; --marvel:#e23636; --dc:#0476f2`.
- Clase `.dialogue-box`: fondo `--panel`, **marco doble** (borde exterior claro + interior, estilo RPG SNES), padding, esquinas rectas (sin border-radius), sombra dura.
- Clase `.dialogue-box .advance`: indicador "▼" parpadeante abajo a la derecha.

```css
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
:root { --bg:#0b1026; --panel:#1a2250; --ink:#e8e8ff; --accent:#ffd447; --marvel:#e23636; --dc:#0476f2; }
* { box-sizing: border-box; image-rendering: pixelated; }
body { margin:0; background:var(--bg); color:var(--ink); font-family:'Press Start 2P',monospace; font-size:12px; line-height:1.8; }
.dialogue-box {
  background:var(--panel); color:var(--ink); padding:16px 18px;
  border:4px solid var(--ink); outline:4px solid var(--bg); outline-offset:2px;
  box-shadow:6px 6px 0 #000; min-height:96px; position:relative;
}
.dialogue-box .advance { position:absolute; right:10px; bottom:6px; animation:blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity:0; } }
```

- [ ] **Paso 2: Commit**
```bash
git add css/snes.css
git commit -m "feat(ui): estética SNES base + caja de diálogo RPG"
```

### Tarea D2: `js/dialogue.js` — typewriter que avanza con un botón

**Files:**
- Create: `js/dialogue.js`

- [ ] **Paso 1: Escribir el componente**

```js
// js/dialogue.js — cajas de diálogo RPG. Escribe línea por línea con typewriter;
// el jugador avanza con click / Enter / Espacio. Es el vehículo de TODA narración.
export class DialogueBox {
  constructor(el, { speed = 28 } = {}) { this.el = el; this.speed = speed; }

  // Muestra un array de líneas, una por caja. Resuelve cuando el jugador termina.
  show(lines) {
    return new Promise(resolve => {
      let i = 0;
      const next = async () => {
        if (i >= lines.length) { this._unbind(advance); return resolve(); }
        await this._type(lines[i++]);
      };
      const advance = (e) => {
        if (e.type === 'keydown' && !['Enter',' '].includes(e.key)) return;
        if (this._typing) { this._skip = true; return; }   // 1er toque: completa línea
        next();                                             // 2do toque: siguiente
      };
      this._bind(advance);
      next();
    });
  }

  _type(text) {
    return new Promise(done => {
      this._typing = true; this._skip = false; this.el.textContent = '';
      let n = 0;
      const tick = () => {
        if (this._skip) { this.el.textContent = text; this._end(done); return; }
        this.el.textContent = text.slice(0, ++n);
        if (n >= text.length) { this._end(done); return; }
        setTimeout(tick, this.speed);
      };
      tick();
    });
  }
  _end(done) { this._typing = false; this.el.insertAdjacentHTML('beforeend', '<span class="advance">▼</span>'); done(); }
  _bind(fn) { document.addEventListener('click', fn); document.addEventListener('keydown', fn); }
  _unbind(fn) { document.removeEventListener('click', fn); document.removeEventListener('keydown', fn); }
}
```

- [ ] **Paso 2: Verificación manual**

Crear un `index.html` mínimo temporal o usar la consola: instanciar `DialogueBox` sobre
un `.dialogue-box` y llamar `show(['Línea uno.','Línea dos.'])`. Confirmar: escribe con
typewriter, el primer toque completa la línea, el segundo avanza, resuelve al final.

- [ ] **Paso 3: Commit**
```bash
git add js/dialogue.js
git commit -m "feat(ui): cajas de diálogo RPG con typewriter"
```

---

## Componente E — Estado + loop de apuesta

### Tarea E1: `js/state.js` — estado del torneo

**Files:**
- Create: `js/state.js`

- [ ] **Paso 1: Implementar creación de torneo y mutaciones**

Responsabilidades (sin tocar el DOM):
- `createTournament(alias, torneoSeed)`: elige 8 de cada bando del `ROSTER` con un
  shuffle **sembrado** por `torneoSeed` (rejugabilidad), arma el bracket de octavos
  Marvel-vs-DC, inicializa `coins = 0`, `damage = 0` por luchador.
- `currentMatch()`: devuelve el siguiente combate pendiente `{ fighter1, fighter2, matchId }`.
- `placeBet(fighterId, amount)`: registra la apuesta del combate actual (apostar es
  obligatorio antes de resolver; ver E2).
- `settle(result)`: aplica el resultado del motor — marca ganador, aplica
  `damageToWinner`, liquida la apuesta (acierto → suma $UATU; fallo → no suma), avanza
  el bracket.
- `isUatuFight()` / `champion()`: para la fase final.

Usar `mulberry32`/`hash32` (importar de `../lib/prng.js`) para el shuffle sembrado.
`matchId` con formato `"R{ronda}-M{n}"` y `"FINAL"` para Uatu, consistente con el motor.

- [ ] **Paso 2: Verificación manual**
```bash
node -e "import('./js/state.js').then(async m=>{const s=m.createTournament('ROD',777);console.log('octavos',s.bracket[0].length, 'match', m.currentMatch(s).matchId);})"
```
Esperado: 8 combates en la primera ronda; `matchId` tipo `R1-M1`.

- [ ] **Paso 3: Commit**
```bash
git add js/state.js
git commit -m "feat(game): estado del torneo, bracket sembrado y apuestas"
```

### Tarea E2: `js/engine-client.js` + `js/render.js` — loop jugable

**Files:**
- Create: `js/engine-client.js`
- Create: `js/render.js`
- Create/Modify: `index.html` (monta la app e importa los módulos)

- [ ] **Paso 1: `render.js` — pintar pantallas**

Funciones puras de presentación (reciben estado, pintan DOM): `renderAlias()`,
`renderMatchup(f1,f2,odds)` (muestra stats, ícono de arquetipo, color de bando, las
odds), `renderBetControls()` (botones para elegir a quién y cuánto apostar — **no se
puede avanzar sin apostar**, spec §6), `renderBracket(state)`, `renderClose(state)`.
Estética vía clases de `snes.css`. Personajes en representación mínima (nombre pixel +
color de bando + ícono de arquetipo); sin imágenes.

- [ ] **Paso 2: `engine-client.js` — orquestar el flujo (plan.md §3)**

```js
// js/engine-client.js — orquesta un combate de punta a punta (plan.md §3).
async function api(path, body) {
  const r = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

export async function playMatch(state, dialogue) {
  const { fighter1, fighter2, matchId } = currentMatch(state);
  // 1) odds (sin revelar resultado)
  const odds = await api('/api/resolve', { fighter1, fighter2, torneoSeed: state.torneoSeed, matchId, reveal: false });
  renderMatchup(fighter1, fighter2, odds);
  // 2) apuesta obligatoria
  const bet = await renderBetControls(fighter1, fighter2, state.coins);
  placeBet(state, bet.fighterId, bet.amount);
  // 3) resolver
  const result = await api('/api/resolve', { fighter1, fighter2, torneoSeed: state.torneoSeed, matchId, reveal: true });
  // 4) narración (con fallback si la IA falla)
  const reason = buildReason(fighter1, fighter2, result); // qué stat/ventaja decidió
  let narr;
  try { narr = await api('/api/narrate', { winner: winnerOf(result, fighter1, fighter2), loser: loserOf(result, fighter1, fighter2), reason, matchId }); }
  catch { narr = fallbackNarration(result, fighter1, fighter2); }
  await dialogue.show([...narr.lines, narr.loserFate]);
  // 5) liquidar y avanzar
  settle(state, result);
  renderBracket(state);
}
```

`buildReason`, `winnerOf`, `loserOf`, `fallbackNarration` son helpers locales: el
`reason` compara stats y la ventaja de arquetipo para una frase corta ("la ventaja
mística fue decisiva" / "su fuerza superior lo aplastó"). `fallbackNarration` arma
2 líneas a partir del resultado del motor.

- [ ] **Paso 3: `index.html` — montar**

HTML mínimo: contenedores `#screen`, `#dialogue.dialogue-box`, carga de `css/snes.css`
y `<script type="module" src="js/main.js">` (o inline) que: pide alias, crea torneo con
una semilla, y corre `playMatch` en bucle hasta la final.

- [ ] **Paso 4: Verificación manual (el corazón de Fase 1)**

Con `vercel dev`: jugar un torneo entero. Confirmar que en CADA combate hay que apostar,
que el saldo $UATU sube al acertar, que el bracket avanza y que las odds mostradas
coinciden con el sesgo esperado (favorito de arquetipo ~0.61 con stats iguales).

- [ ] **Paso 5: Commit**
```bash
git add js/engine-client.js js/render.js index.html
git commit -m "feat(game): loop jugable de apuesta + render SNES"
```

---

## Componente F — Narración corta RPG

### Tarea F1: Reescribir `api/narrate.js`

**Files:**
- Modify: `api/narrate.js`

- [ ] **Paso 1: Cambiar entrada, prompt y salida**

Cambios respecto al actual:
- **Entrada nueva:** `{ winner, loser, reason, matchId, isUatuFight }` (la IA ya NO
  recibe la pelea para decidirla; recibe el ganador ya decidido por el motor).
- **Prompt nuevo (combate normal):**
  ```
  Eres el narrador de un juego de pelea estilo cartucho SNES, en español.
  {winner.name} ({winner.publisher}) derrotó a {loser.name} ({loser.publisher}).
  Factor decisivo: {reason}.
  Narra el desenlace en EXACTAMENTE 3 líneas CORTAS de caja de diálogo RPG
  (máx ~12 palabras por línea, punzantes, cero párrafos). Luego el destino del
  perdedor en 1 frase y la cicatriz del ganador en 1 frase.
  Responde SOLO JSON: {"lines":["..","..",".."],"loserFate":"..","winnerScar":".."}
  ```
- **Prompt Uatu:** el campeón SUPERA la prueba con sacrificio; Uatu revela que buscaba
  al ser capaz de salvar el multiverso. Mismo formato corto JSON.
- **Salida:** parsear el JSON del `content`; si no parsea, fallback que parte el texto
  en líneas. Devolver `{ lines, loserFate, winnerScar }`.
- **Conservar:** modelo `gpt-oss-120b`, `temperature` ~0.9, `reasoning_effort:'low'`,
  timeout 15s (`AbortController`), candado de Origin. Bajar `max_completion_tokens` a
  ~600 (la salida es corta).

- [ ] **Paso 2: Verificación con `vercel dev`**
```bash
curl -s -X POST http://localhost:3000/api/narrate \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"winner":{"name":"Hulk","publisher":"Marvel"},"loser":{"name":"Batman","publisher":"DC"},"reason":"su fuerza bruta fue decisiva","matchId":"R1-M1"}'
```
Esperado: JSON con `lines` (3 cortas), `loserFate`, `winnerScar`.

- [ ] **Paso 3: Commit**
```bash
git add api/narrate.js
git commit -m "refactor(api): narrate corto estilo RPG; la IA ya no decide ganador"
```

---

## Componente G — Cierre + final de Uatu

### Tarea G1: Fase final y pantalla de cierre

**Files:**
- Modify: `js/engine-client.js`, `js/render.js`

- [ ] **Paso 1: Final contra Uatu**

Cuando el bracket llega al campeón, lanzar un combate especial contra `UATU`
(`matchId = "FINAL"`, `isUatuFight: true`). El motor resuelve igual (Uatu tiene stats
altísimos pero el campeón puede ganar — el spec exige que el campeón supere la prueba;
si el motor diera derrota, la narración Uatu reencuadra como "prueba superada con
sacrificio" — decisión de narración, no de motor). La narración usa el prompt Uatu.

- [ ] **Paso 2: Pantalla de cierre**

`renderClose(state)`: muestra el campeón, el **score final** y el **saldo $UATU** de la
partida, y récords locales. Sin leaderboard global (Fase 4). Botón "jugar de nuevo"
que arranca otro torneo con nueva semilla.

- [ ] **Paso 3: Verificación manual de punta a punta**

Jugar un torneo completo: octavos → cuartos → semis → final → Uatu → cierre. Confirmar
que el daño acumulado se nota en rondas tardías y que el cierre muestra score + $UATU.

- [ ] **Paso 4: Commit**
```bash
git add js/engine-client.js js/render.js
git commit -m "feat(game): final contra Uatu y pantalla de cierre"
```

---

## Cierre de Fase 1

- [ ] **Verificación final:** `node --test` en verde + un torneo completo jugable en
  `vercel dev` (apuesta en cada combate, narración corta, daño acumulado, cierre).
- [ ] **Code review** (obligatorio, CLAUDE.md): se tocó código → correr el flujo de
  review antes de declarar Fase 1 terminada.
- [ ] **Deploy de prueba** a Vercel (rama `convergencia-v2`, preview URL) y humo manual.

**Lo que queda fuera de Fase 1** (no abrir aquí): leaderboard global + Neon (Fase 4),
fichas de destino / potenciar campeón / easter eggs (Fase 3), memoria y rivalidades
(Fase 2), emblemas pixel y chiptune definitivo (cabos, spec §7).
