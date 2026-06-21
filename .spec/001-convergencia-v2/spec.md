# Spec — CONVERGENCIA v2

**Estado:** borrador para revisión de Rodolfo
**Fecha:** 2026-06-20
**Rama:** `convergencia-v2`
**Constitution:** ver `../../constitution.md`

> Este documento define el **QUÉ** (experiencia, journeys, criterios de éxito,
> casos borde). La arquitectura y el **CÓMO** técnico van en `plan.md` (siguiente
> fase del SDD, aún no escrito).

---

## 1. Visión

Convergencia v2 deja de ser un espectáculo donde la IA pelea sola y se convierte en
un **auto-battler narrativo de apuestas** con estética de cartucho SNES. El jugador
ya no mira el torneo: lo **lee y apuesta**. Su ojo para los matchups es lo que lo
hace ganar.

Marvel vs DC, 16 luchadores, eliminación directa, y al final la prueba de Uatu.
Lo nuevo es todo lo que rodea a esas peleas: predicción, economía, motor legible,
ranking y descubrimiento.

---

## 2. Decisiones de diseño cerradas

Estas decisiones ya están tomadas (brainstorming 2026-06-20). No son abiertas.

### 2.1 Roster (puros conocidos, editable a futuro)
12 por bando. De aquí se arma el bracket de 8 vs 8.

**Marvel:** Spider-Man (⚡), Iron Man (🧠), Thor (🔮), Hulk (💪), Captain America (🥊),
Wolverine (🥊), Deadpool (🥊), Doctor Strange (🔮), Thanos (💪), Black Panther (🥊),
Venom (💪), Magneto (🔮).

**DC:** Batman (🧠), Superman (💪), Wonder Woman (🥊), Flash (⚡), Aquaman (💪),
Joker (🧠), Harley Quinn (🥊), Green Lantern (🔮), Shazam (🔮), Black Adam (💪),
Lex Luthor (🧠), Darkseid (💪).

El roster será **editable** por el jugador en una fase posterior (agregar/quitar,
incluso comodines custom). El universo base es Marvel vs DC, con la puerta abierta
a invitados custom.

### 2.2 Arquetipos y triángulo de ventajas
Cada personaje tiene uno de **5 arquetipos**:
🥊 Peleador · ⚡ Velocista · 💪 Fuerza Bruta · 🔮 Místico/Energía · 🧠 Tecnólogo/Estratega.

**Triángulo cíclico** (cada uno vence a uno, pierde con uno, neutral con dos):

```
🔮 Místico   vence a  💪 Fuerza Bruta   (la magia ignora músculos)
💪 Fuerza    vence a  🥊 Peleador       (la técnica no salva si te revientan)
🥊 Peleador  vence a  🧠 Tecnólogo      (acorta distancia y lo desarma)
🧠 Tecnólogo vence a  ⚡ Velocista       (lo predice y lo atrapa)
⚡ Velocista  vence a  🔮 Místico        (golpea antes del conjuro)
```

La ventaja da un bono al poder de combate. **Nunca se explica en pantalla**: el
jugador lo deduce observando resultados (principio "legible, no explicado").

### 2.3 Resolución de combate (híbrida)
El **motor** calcula el poder de combate de cada luchador a partir de: sus stats,
la ventaja de arquetipo del matchup, y el daño acumulado de rondas previas. Con eso
produce una **probabilidad de victoria** (nunca 100% — siempre cabe el batacazo) y
**tira el dado** dentro de ese margen.

La IA **solo narra** el resultado que el motor entregó, de forma coherente con el
porqué (qué stat o ventaja fue decisiva). La IA nunca decide el ganador.

El cálculo ocurre en el **servidor** para que el ranking sea legítimo.

### 2.4 Economía — $UATU (UatuCoin)
La moneda del juego es **$UATU**, una shitcoin cósmica "acuñada por el Observador".
Una sola moneda, dos usos:
- **Ganas $UATU** acertando tus apuestas antes de cada combate.
- Los $UATU **suben tu marcador** (leaderboard) **y** se **gastan** en:
  - **Fichas de destino:** forzar/empujar un upset en un combate.
  - **Potenciar o curar** a tu campeón favorito entre rondas (sabor a manager).

Apostar bien es la fuente de poder. Mal apostador = sin recursos.

### 2.5 Identidad y leaderboard
- El jugador se identifica con un **alias estilo arcade** (sin correo, sin contraseña).
- Score, $UATU y récords se guardan **en la nube**.
- **Leaderboard global** real, legítimo (motor server-side).

### 2.6 Estética y narración
- **SNES / 16-bit:** pixel art, gradientes sutiles, **chiptune** (reemplaza la música
  orquestal actual). Cajas de diálogo estilo RPG.
- **Personajes:** representados por su **emblema pixel** icónico (no fotos). En Fase 1
  se usa representación mínima (tipografía pixel + color de bando + ícono de arquetipo);
  los emblemas pixel son un **pendiente** posterior (ver §7).
- **Narración:** concisa, en **cajas de diálogo RPG** con typewriter, avanzando con un
  botón. Nada de párrafos largos.

### 2.7 Easter eggs y secretos
Premian la curiosidad, **nunca dan ventaja competitiva** (jamás regalan $UATU que
infle el leaderboard — principio "ranking limpio"). Son contenido oculto/cosmético.
Se implementan en Fase 3.

- **El portal sin retorno (código Konami).** La secuencia clásica de Contra
  —↑ ↑ ↓ ↓ ← → ← → B A (en móvil, gestos equivalentes)— abre un glitch que
  **transporta al jugador a Convergencia v1**, el cartucho original. No hay vuelta
  atrás *in-universe*: v1 es código congelado de junio 2026 que no sabe que v2 existe,
  así que no tiene botón de regreso. Para volver, el jugador cambiaría la URL a mano.
  Un viaje de ida a la nostalgia.
- **Personaje secreto.** Una secuencia oculta desbloquea a un luchador escondido
  (candidato: Uatu jugable, o un comodín meme), jugable solo en **modo no-ranked**.
- **El narrador rompe la 4ª pared.** Con cierto alias secreto, la IA narra consciente
  de que es un juego, estilo Deadpool — calando al jugador.

**Decisión de producción (cierra el cabo §7):** cuando v2 esté lista, **toma el
dominio principal**. v1 se sirve congelada en su propia URL, alcanzable *solo* por el
portal Konami. v2 reemplaza a v1 de cara al público; v1 sobrevive como secreto.

---

## 3. Journeys del jugador

### 3.1 Journey principal — un torneo completo
1. **Arranque.** El jugador entra (estética SNES, sin tutorial). Pone su alias.
2. **Roster y bracket.** Arma o recibe el bracket de 8 Marvel vs 8 DC.
3. **Micro-loop de combate** (se repite por cada pelea):
   - Ve a los dos luchadores: stats, arquetipo, daño previo.
   - **Apuesta** quién gana (y opcionalmente gasta una ficha de destino).
   - El motor resuelve; la IA narra el desenlace en cajas de diálogo cortas.
   - Cobra o pierde $UATU según su apuesta. El bracket avanza.
4. **Entre rondas.** Puede gastar $UATU en potenciar/curar a su favorito.
5. **Prueba de Uatu.** El campeón enfrenta a Uatu; epílogo ramificado según quién
   ganó y qué tan bien apostó el jugador.
6. **Cierre.** Score final, posición en el leaderboard, récords.

### 3.2 Micro-loop de apuesta (el corazón)
La unidad jugable mínima. En cada combate el jugador **lee el matchup** (stats +
ventaja de arquetipo + daño) y decide su apuesta. El motor introduce incertidumbre
real; la habilidad está en estimar bien la probabilidad, no en adivinar.

---

## 4. Las 4 fases (qué entrega cada una)

Destino = rediseño completo. Se construye por partes jugables (principio 8).

- **Fase 1 — El corazón.** Reskin SNES base + roster (representación mínima) +
  motor híbrido server-side + apuestas con $UATU + IA narrando en cajas RPG
  cortas. *Resultado: un juego completo, jugable de punta a punta, distinto de v1.*
- **Fase 2 — Alma narrativa.** Memoria entre combates, rivalidades que la narración
  recuerda, final de Uatu ramificado, sabor (comentario con bando).
- **Fase 3 — Agencia profunda.** Fichas de destino (gastar $UATU para forzar
  upsets), potenciar/curar campeón, easter eggs (ver §2.7: portal Konami a v1,
  personaje secreto, narrador 4ª pared).
- **Fase 4 — Meta y comunidad.** Leaderboard global con alias, hall of fame, seeds
  compartibles, modos nuevos (supervivencia, liga), roster editable.

---

## 5. Criterios de éxito (verificables)

- Un jugador completa un torneo entero tomando una decisión de apuesta en **cada**
  combate; en ningún punto solo "mira y da siguiente".
- El resultado de un combate es **reproducible** dado el mismo estado y semilla
  (el motor es la verdad, no la IA).
- Dos personajes con stats similares pero arquetipos en relación de ventaja
  producen una probabilidad **claramente sesgada** hacia el que tiene ventaja.
- Una narración de combate cabe en cajas de diálogo cortas (sin párrafos largos)
  y es **coherente** con el ganador y el porqué que decidió el motor.
- El jugador termina con un score y una posición; el leaderboard refleja su marca.
- Ninguna pantalla explica el triángulo de ventajas con un tutorial.
- La estética es consistentemente SNES (pixel + chiptune + cajas de diálogo) sin
  elementos fuera de tono.

---

## 6. Casos borde

- **La IA falla o tarda** (timeout): el combate ya está resuelto por el motor, así que
  el juego continúa con una narración de respaldo. El motor nunca depende de la IA.
- **Empate de poder de combate:** el motor define un desempate (no puede quedar 50/50
  sin resolución).
- **El jugador no apuesta:** debe forzarse una apuesta (o un "paso" explícito con
  costo/penalización) — no se permite avanzar en modo espectador.
- **Sin $UATU:** el jugador no puede comprar fichas ni potenciar; sigue apostando
  (apostar es gratis, gastar no).
- **Alias duplicado / vacío** en el leaderboard: se maneja sin romper el ranking.
- **Daño acumulado extremo:** un campeón muy lastimado llega debilitado a la final;
  el sistema lo refleja sin volverlo imposible de jugar.
- **Roster editado con personaje custom sin arquetipo:** debe exigir/asignar arquetipo.

---

## 7. Pendientes y cabos abiertos

- [ ] **Emblemas pixel 8-bit por personaje** — diseñar/producir los 24 emblemas
      icónicos. Pospuesto: no bloquea Fase 1 (se usa representación mínima mientras).
- [ ] **Elección de base de datos** del marketplace de Vercel para leaderboard/estado
      (con costos exactos en mano) — se decide en `plan.md`.
- [ ] **URL/deploy de v1 congelada** — definir dónde vive v1 para que el portal Konami
      la alcance (subdominio, ruta o deploy aparte desde la rama `convergencia-v1`).
- [ ] **Pistas chiptune** (ambient + batalla): conseguir/generar libres de licencia.
- [ ] **Personaje secreto concreto** y la secuencia que lo desbloquea — Fase 3.

**Cerrados en esta ronda:** nombre de la moneda (**$UATU**), destino de producción
(v2 toma el dominio; v1 sobrevive vía portal Konami), set de easter eggs (definidos
en §2.7).

---

## 8. Fuera de alcance (por ahora)

- Multijugador en tiempo real.
- Cuentas con correo/contraseña (se eligió alias arcade).
- Retratos pixel detallados por personaje (se eligió emblema; retrato descartado por
  riesgo de calidad).
- App nativa / fuera de la web.
