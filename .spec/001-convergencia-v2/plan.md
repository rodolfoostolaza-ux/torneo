# Plan técnico — CONVERGENCIA v2

**Estado:** borrador para revisión de Rodolfo
**Fecha:** 2026-06-20
**Rama:** `convergencia-v2`
**Spec:** ver `spec.md` · **Constitution:** ver `../../constitution.md`

> Este documento define el **CÓMO** técnico: arquitectura, motor, módulos y
> decisiones. Las tareas paso a paso (TDD, commits) van en `tasks.md` (siguiente
> fase del SDD, aún no escrito). No avanzar a código sin validar este plan.

---

## 0. Resumen en una línea

Un juego vanilla (HTML/CSS/JS, sin build step) servido desde la raíz en Vercel, con
un **motor de combate determinista en una función serverless** que decide cada pelea
con azar sembrado, y la IA (Cerebras) reducida a **narrar en cajas de diálogo cortas**
lo que el motor ya resolvió.

---

## 1. Arquitectura general

Tres piezas, sin framework ni paso de build (igual que v1, para no inflar el deploy):

1. **Cliente (estático, raíz del repo).** Orquesta la partida: arma el bracket,
   muestra el matchup, recibe la apuesta, pide al servidor que resuelva, pinta la
   narración en cajas RPG y lleva el estado del torneo (daño acumulado, saldo $UATU).
   El cliente **nunca decide quién gana**.
2. **Funciones serverless (`/api/`).** Dos responsabilidades separadas:
   - `api/resolve.js` — **el motor**. Calcula poder de combate, probabilidad y tira
     el dado sembrado. Es la única fuente de verdad del resultado.
   - `api/narrate.js` — **el vestido**. Recibe el resultado ya decidido y devuelve
     narración corta. Modificación del archivo actual.
3. **Persistencia (Fase 4, no Fase 1).** Neon Postgres para el leaderboard global.
   Ver §6. En Fase 1 no hay DB: el score es local a la partida.

**Por qué el motor en servidor y no en el cliente:** si el cliente calculara el
resultado, un jugador podría forzar victorias y envenenar el leaderboard. Con el
motor en `/api/resolve` y azar sembrado server-side, el resultado está determinado
por una semilla que el cliente no controla. Es la base del principio "ranking limpio";
Fase 4 le suma la validación de extremo a extremo (ver §7, deuda conocida).

---

## 2. El motor de combate (corazón de Fase 1)

Vive como **lógica pura** en `lib/combat.js` (testeable, sin I/O) y se expone vía el
wrapper serverless `api/resolve.js`. Todas las constantes son parametrizables; los
valores de abajo son el punto de partida.

### 2.1 Poder de combate base
Cada luchador tiene 6 stats en escala 0–100 (intelligence, strength, speed, durability,
power, combat). El poder base es su media:

```
CP_base(f) = (intelligence + strength + speed + durability + power + combat) / 6
```

Media simple a propósito (YAGNI): es legible y deja la ventaja de arquetipo y el daño
como los factores que de verdad mueven la aguja. Si más tarde queremos que `combat` y
`power` pesen más, se cambia a media ponderada sin tocar el resto del motor.

### 2.2 Ventaja de arquetipo (el triángulo)
El triángulo cíclico del spec §2.2. Si el arquetipo de A vence al de B, A recibe un
bono multiplicativo; si pierde, lo recibe B; si es neutral, nadie:

```
ADV_BONUS = 0.25
mult_arq(A vs B) = 1.25  si arq(A) vence a arq(B)
                 = 1.00  si neutral
                 = 1.00  (el bono lo recibe B en su propio cálculo)
```

El bono del 25% es lo que hace que dos luchadores de stats parecidos den una
probabilidad **claramente sesgada** hacia el que tiene ventaja (con stats iguales,
≈0.61 para el favorecido; criterio de éxito del spec). El triángulo se codifica como un mapa `BEATS = { mistico: 'fuerza', fuerza:
'peleador', peleador: 'tecnologo', tecnologo: 'velocista', velocista: 'mistico' }`.

### 2.3 Daño acumulado
Cada luchador arrastra `damage` ∈ [0, 1] entre rondas (0 = intacto). Merma su poder
hasta un 50%:

```
DMG_CAP = 0.50
CP_eff(f) = CP_base(f) * mult_arq(f) * (1 - DMG_CAP * f.damage)
```

Un campeón que llega muy lastimado a la final pelea debilitado, pero nunca a poder
cero (criterio: "lo refleja sin volverlo imposible de jugar").

### 2.4 Probabilidad de victoria
Modelo de odds proporcionales (Bradley-Terry), con exponente para acentuar al favorito
sin matar el batacazo:

```
K = 2
P(A gana) = CP_eff(A)^K / ( CP_eff(A)^K + CP_eff(B)^K )
```

Con `K=2`, un favorito claro gana la mayoría de las veces pero el upset siempre cabe.
`P` nunca es 0 ni 1 mientras ambos CP > 0. Esta `P` es **información pública de apuesta**:
se le muestra al jugador como las "odds" antes de que aposte.

### 2.5 El dado sembrado (reproducibilidad)
Nada de `Math.random()`. PRNG `mulberry32` sembrado de forma determinista:

```
seed_combate = hash32( torneoSeed + ':' + matchId )
r = mulberry32(seed_combate)()        // r ∈ [0, 1)
gana A  ⟺  r < P(A gana)
```

`torneoSeed` se genera server-side al crear el torneo. Mismo `torneoSeed + matchId` →
mismo resultado, siempre (criterio: "reproducible dado el mismo estado y semilla").
Esto también habilita replays y auditoría del leaderboard en Fase 4. El roll resuelve
cualquier empate de poder: si `P = 0.5`, el dado decide igual — nunca queda 50/50 colgado.

### 2.6 Daño al ganador
El que gana sale tocado en proporción a lo reñido que estuvo (si ganó apretado, sangra
más). Se acumula para la siguiente ronda:

```
DMG_BLOW = 0.35
damage_ganador += DMG_BLOW * (1 - P(ganador))      // clamp a [0, 1]
```

Ganar 0.95→0.50 cuesta poco; ganar 0.55 cuesta casi todo el golpe.

### 2.7 Contrato de `api/resolve.js`
```
POST /api/resolve
body: {
  fighter1: { id, name, stats:{...}, archetype, damage },
  fighter2: { ... },
  torneoSeed: <int>,
  matchId:   <string>,        // p.ej. "R1-M3"
  reveal:    <bool>           // false = solo odds; true = resuelve
}

reveal:false  → { probability1, probability2 }
reveal:true   → { winnerId, loserId, probability1, probability2,
                  damageToWinner, closeness }
```

Dos modos para sostener el flujo de apuesta sin que el cliente vea el resultado antes
de comprometerse (ver §3). El cálculo es idéntico y determinista en ambos.

---

## 3. Flujo cliente–servidor de un combate

```
1. Cliente arma el matchup (fighter1 vs fighter2, matchId, torneoSeed).
2. Cliente → POST /api/resolve {reveal:false}  → recibe odds (probability).
3. Cliente muestra stats + arquetipos + daño + odds. El jugador APUESTA
   (la apuesta se fija en el estado del cliente; apostar es obligatorio, spec §6).
4. Cliente → POST /api/resolve {reveal:true}    → recibe el ganador real.
5. Cliente liquida la apuesta: acierto suma $UATU, fallo no.
6. Cliente → POST /api/narrate {ganador, porqué} → recibe líneas de diálogo.
7. Cliente pinta la narración en cajas RPG (typewriter) y avanza el bracket.
8. Aplica damageToWinner al ganador para la siguiente ronda.
```

La final contra Uatu es el mismo flujo con `matchId = "FINAL"` y la regla del spec
(el campeón debe superar la prueba) aplicada en la narración, no en el motor.

---

## 4. Narración — cambios a `api/narrate.js`

El archivo existe y hoy hace dos cosas que v2 elimina: pide **párrafos largos** y deja
que **la IA decida el ganador** (parsea `GANADOR: | MUERTE: | DAÑO:`). Cambios:

1. **La IA ya no decide nada.** El prompt recibe el ganador (del motor) y el porqué
   (qué stat o ventaja de arquetipo fue decisiva) y narra *ese* desenlace.
2. **Salida corta, en páginas de diálogo.** En vez de 3–4 párrafos, devolver
   **2–4 líneas punzantes** pensadas para cajas RPG (una línea ≈ una caja con
   typewriter). Nuevo contrato de salida:
   ```
   { lines: ["...", "...", "..."], loserFate: "<1 frase>", winnerScar: "<1 frase>" }
   ```
3. **Prompt nuevo:** instruir "estilo cartucho SNES, frases cortas, cero párrafos,
   máximo ~12 palabras por línea". Se mantiene el modelo `gpt-oss-120b` de Cerebras,
   el timeout de 15s y el candado de Origin (ya endurecidos).
4. **Fallback:** si Cerebras falla/tarda, el cliente arma líneas de respaldo a partir
   del resultado del motor (el motor ya tiene la verdad; la narración es cosmética).

---

## 5. Estética SNES — cómo se logra

- **Fuente pixel:** `Press Start 2P` (Google Fonts, libre) o bitmap font local para no
  depender de red. `image-rendering: pixelated` en todo sprite/emblema.
- **Paleta acotada** y bordes de caja de diálogo RPG (marco doble claro sobre fondo
  azul oscuro). CSS propio en `css/snes.css`, sin frameworks.
- **Cajas de diálogo (`js/dialogue.js`):** componente con efecto typewriter que avanza
  con un botón / Enter / click. Es el vehículo de TODA la narración (principio #4).
- **Chiptune (`js/audio.js`):** reemplaza la música orquestal de v1. Conseguir pistas
  libres de licencia es un cabo (spec §7); en Fase 1 puede arrancar en silencio o con
  un placeholder, sin bloquear lo jugable.
- **Personajes:** representación mínima en Fase 1 (tipografía pixel + color de bando +
  ícono de arquetipo). Los emblemas pixel por personaje son cabo posterior (spec §7).

---

## 6. Persistencia — Neon Postgres (Fase 4)

**Decisión cerrada, costos a la vista** (regla CLAUDE.md: nada de plataforma sin precio).

- **Qué es:** Postgres serverless, integración **nativa** del Marketplace de Vercel
  (`vercel install neon` inyecta `DATABASE_URL` solo).
- **Free tier:** 0.5 GB de storage, 100 CU-hours/mes de compute con scale-to-zero,
  1 proyecto. **Sin tarjeta de crédito.** Para un leaderboard de miles de filas de
  texto corto + enteros es, en la práctica, infinito.
- **No se pausa por inactividad** (a diferencia de Supabase, que suspende a los 7 días
  y mete cold-start de decenas de segundos — descartado por eso).
- **Primer escalón de pago** (solo si algún día escala): usage-based sin mínimo fijo,
  ~$0.106/CU-hora + ~$0.35/GB-mes. Irrelevante a este volumen.
- **Por qué Neon y no Upstash Redis:** SQL relacional encaja mejor que sorted sets
  cuando hay columnas (alias, score, saldo, timestamp). Upstash queda para caché/
  rate-limit si hiciera falta.

**Esquema (Fase 4):**
```sql
CREATE TABLE leaderboard (
  alias      TEXT PRIMARY KEY,
  score      INT  NOT NULL,
  coins      INT  NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
**Operaciones (Fase 4, en `api/leaderboard.js`):**
```sql
-- upsert por alias (conserva el mejor score)
INSERT INTO leaderboard (alias, score, coins, updated_at)
VALUES ($1,$2,$3, now())
ON CONFLICT (alias) DO UPDATE
  SET score = GREATEST(leaderboard.score, EXCLUDED.score),
      coins = EXCLUDED.coins, updated_at = now();
-- top 100
SELECT alias, score, coins FROM leaderboard ORDER BY score DESC LIMIT 100;
```
Sin correo ni contraseña: el alias ES la identidad (spec §2.5). En Fase 1 nada de esto
existe todavía.

---

## 7. Estructura de archivos (v2)

Rediseño completo en rama propia → estructura nueva y enfocada (v1 monolítico no se
toca). Sin build step: módulos ES nativos del browser, servidos desde la raíz.

```
/index.html              estructura + monta la app, importa los módulos
/css/snes.css            estética 16-bit (paleta, fuente pixel, cajas RPG)
/js/
  config.js              datos: roster 12v12, stats, arquetipos, BEATS (triángulo)
  state.js               estado del torneo: bracket, daño acumulado, saldo $UATU, apuesta
  engine-client.js       orquesta el flujo §3 (llama /api/resolve y /api/narrate)
  dialogue.js            cajas de diálogo RPG con typewriter
  render.js              pinta pantallas (matchup, apuesta, bracket, cierre)
  audio.js               chiptune manager
/lib/
  combat.js              MOTOR puro (CP, ventaja, P, roll, daño) — testeable [NUEVO]
  prng.js                mulberry32 + hash32 (sembrado determinista, server-side) [NUEVO]
/api/
  resolve.js             wrapper serverless del motor (importa lib/combat.js) [NUEVO]
  narrate.js             narración corta RPG, ya no decide ganador [MODIFICADO]
  leaderboard.js         Neon upsert + top100 [Fase 4, NO Fase 1]
/test/
  combat.test.js         tests del motor con node:test nativo [NUEVO]
```

`lib/combat.js` es lógica pura sin I/O para poder testearla; `api/resolve.js` solo la
envuelve en el handler HTTP (candado de Origin igual que `narrate.js`). El PRNG vive
solo en `lib/` (server-side): el cliente no calcula odds, las recibe del motor
(`/api/resolve` con `reveal:false`), así que no necesita el generador.

---

## 8. Desglose de Fase 1 en componentes

Fase 1 entrega **un juego completo jugable de punta a punta**, distinto de v1 (spec §4,
principio #8). Cada componente con su criterio verificable. El detalle paso a paso
(tests, commits) va en `tasks.md`.

| # | Componente | Archivos | Criterio verificable |
|---|------------|----------|----------------------|
| A | **Datos y triángulo** | `js/config.js` | El roster 12v12 con arquetipos carga; `BEATS` codifica el ciclo completo del spec §2.2. |
| B | **Motor puro** | `lib/combat.js`, `lib/prng.js`, `test/combat.test.js` | Tests pasan: (1) mismo seed+matchId → mismo ganador; (2) stats iguales + ventaja de arquetipo → P del favorecido ≥ 0.6; (3) más daño acumulado → menor P. |
| C | **Motor serverless** | `api/resolve.js` | `POST {reveal:false}` devuelve odds; `{reveal:true}` devuelve ganador determinista; candado de Origin activo. |
| D | **Estética + cajas RPG** | `index.html`, `css/snes.css`, `js/dialogue.js` | Pantalla SNES coherente; una caja de diálogo escribe con typewriter y avanza con un botón. |
| E | **Estado + loop de apuesta** | `js/state.js`, `js/engine-client.js`, `js/render.js` | Se juega un torneo entero apostando en CADA combate; no se puede avanzar sin apostar (spec §6); el saldo $UATU sube/baja según el acierto. |
| F | **Narración corta** | `api/narrate.js`, `js/engine-client.js` | La IA narra el ganador del motor en 2–4 líneas; si Cerebras falla, el fallback local narra igual. |
| G | **Cierre + final de Uatu** | `js/render.js`, `js/engine-client.js` | El campeón enfrenta a Uatu; se muestra score final y saldo $UATU de la partida (sin leaderboard global todavía). |

Orden sugerido: A → B → C → D → E → F → G (datos y motor primero, porque todo lo demás
depende de ellos; la UI y la narración encima).

---

## 9. Deuda y tradeoffs conocidos (honestidad)

- **Anti-cheat parcial en Fase 1.** El estado del torneo (bracket, daño, saldo) vive en
  el cliente; el motor en servidor impide *elegir* ganadores, pero un jugador decidido
  aún podría manipular su estado local. **No importa en Fase 1 porque no hay leaderboard
  global** (llega en Fase 4). Fase 4 cierra esto moviendo la validación del torneo al
  servidor (o firmando resultados con la semilla). Se documenta, no se resuelve ahora
  (YAGNI).
- **Chiptune y emblemas pixel:** cabos del spec §7. Fase 1 arranca con representación
  mínima y audio placeholder/silencio; no bloquean lo jugable.
- **`K`, `ADV_BONUS`, `DMG_*`:** valores de arranque. Se ajustan jugando (playtesting),
  no se "adivinan" de antemano. Por eso están centralizados y parametrizados.

---

## 10. Fuera de Fase 1 (para que el alcance no se infle)

- Leaderboard global y Neon (Fase 4).
- Fichas de destino, potenciar/curar campeón, easter eggs (Fase 3).
- Memoria entre combates, rivalidades, final de Uatu ramificado (Fase 2).
- Emblemas pixel detallados y chiptune definitivo (cabos, spec §7).
- Roster editable por el jugador (Fase 4).
```
