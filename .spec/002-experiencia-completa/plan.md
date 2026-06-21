# Plan maestro — Convergencia v2.1: "Que recupere la chispa"

> Extiende el SDD de `001-convergencia-v2`. **Norte:** mantener la épica y la
> identificación de Convergencia 1 **dentro** de v2 (apuestas + motor justo + SNES pixel).
> **Modo:** iterativo — cada lote entrega algo jugable y se ajusta viendo avances.
> **Sweet spot narrativo:** denso, no largo (épico ≠ aburrido).

---

## 1. Decisiones ya tomadas (lock)
Cerradas; no se vuelven a discutir salvo que Rodolfo lo pida.

- **Estética:** SNES pixel-art. **Base:** evolucionar v2 (no tocar la rama sagrada `convergencia-v1`).
- **Final variable:** el campeón PUEDE perder ante Uatu (ya implementado).
- **Assets nuevos:** se pagan vía **OpenRouter** (~$2 por todo, pipeline `_batch_sprites.py` listo).
  Puter.js descartado (su "gratis" es *user-pays*: el jugador final paga; además es runtime, no batch).
- **Explicación de stats (resuelve D1):** **pantalla estilo *atract-mode* NES** (las que salían al no
  apretar Start, explicando cada elemento). Explica qué es cada stat. **NO es tutorial** — explicación
  mínima, ambiental, opcional. Hoy las stats son columnas con un acrónimo y ya; esto les da contexto.
- **Sistema de ocultos (meta-progresión):** ver §5. Todo decidido salvo la prob. de ganar la slot.

## 2. Decisiones abiertas (de Rodolfo — con default tomado)
Avanzo con el default y lo marco; dime si lo cambias. (D1 ya resuelta, ver §1.)

- **D2 — Mecánica del campeón.** Default: eliges **1 campeón** de los 16; sigues apostando en TODAS
  las peleas; bono $UATU si tu campeón llega lejos/gana. (Reversible, lo afino al construir Lote 3.)

> "Resolver rápido" y los **modos de juego** quedan FUERA de v2.1 (Rodolfo: "esta versión no lo
> permite, quítalo"). El único modo es el Campeonato actual. Modos → backlog, no alcance activo.

## 3. Principios que el plan respeta (constitution.md)
- **#1 El jugador decide, no mira** → selección de campeón + apuestas en todas lo refuerzan.
- **#2 Motor = verdad, IA viste** → intacto.
- **#3 "Legible, no explicado"** → la pantalla atract-mode de stats NO es tutorial (explicación
  mínima ambiental, opcional). Conviene anotar esta aclaración en `constitution.md` (cabo §7).
- **#4 Narración de cartucho, no de novela** → el sweet spot vive aquí.
- **#5 SNES coherente** → pantallas nuevas son CSS/tipografía/pixel; no rompen la ilusión.
- **#8 Construir por partes jugables** → cada lote abajo es jugable de punta a punta.

## 4. Lotes (orden de ejecución; cada uno jugable)

### Lote 1 — Bugs + narración (HECHO, falta cierre)
Ya intervenido: spoiler del ganador, freeze R3C2, fallback visible, narración épica-densa, throttle Cerebras.
Cierre (4 hallazgos del review, ninguno alto) — HECHO:
- [x] Tope de reintentos por combate (MAX_FAILS=5) + backoff creciente + `renderFatal` (no martilla infinito).
- [x] Reset del throttle (`resetNarrateThrottle`) al iniciar partida.
- [x] `showDialogue()` dentro del try/finally.
- [x] No re-mostrar el widget de apuesta en un reintento de combate.

### Lote 2 — Marco épico (100% código, CERO costo) — HECHO (review 1 alta corregida)
- [x] Pantalla de **intro**: monta la Convergencia (lore en la caja RPG, reusa `DialogueBox`).
- [x] Pantalla de **outro** del campeón (sprite + récord + saldo) — `renderChampion`.
- [x] **Game over épico** (sprite roto + humor negro + grisáceo) — `renderGameOver`.
- [x] **Créditos arcade** al vencer a Uatu (scroll de cartucho) → **duplican tus $UATU** (con guard de idempotencia).
- [x] **Pantalla atract-mode de stats** (ficha de ejemplo anotada + ciclo de arquetipos — D1).
- Cierre del review: doble-click en replay blindado (`{ once: true }`). Verificado por captura las 4 pantallas.

### Lote 3 — Piel en el juego (código, sin assets nuevos)
- [ ] **Selección de campeón** (D2) + seguir apostando en todas las peleas.
- [ ] **Brackets laterales** con daño acumulado en vivo.
- [ ] **Pacing entre combates**: transición con retro, no el cambio instantáneo de hoy.
- [ ] **Diálogos pre Y post combate** como momento propio. Hoy solo hay 2 frases de cierre pegadas a
  la narración (`loserFate`/`winnerScar`); faltan los diálogos de verdad, antes y después.

### Lote 4 — Maquinaria de ocultos (código)
- [ ] **Slot estilo SMB3** (el minijuego opt-in de §5): carriles, timing, premio escalonado.
- [ ] **Persistencia** de desbloqueos (localStorage) + lógica del EV (§5). Probable con placeholders antes de Lote 5.

### Lote 5 — Roster + invitados + clímax (REQUIERE assets ≈$2 OpenRouter)
- [ ] Roster base ampliado (más Marvel/DC) — **lista por definir** (cabo §7).
- [ ] **25 invitados de otros universos** = los personajes ocultos de §5 — **lista por definir** (sprites sano/roto).
- [ ] **Imagen del clímax**: la horda de todos encarando a Uatu, liderada por el campeón.

## 5. Sistema de ocultos (meta-progresión — el "final final")
El gancho de longevidad. Transversal: la maquinaria es Lote 4, los sprites son Lote 5.

- **25 ocultos = los invitados de otros universos.** Desbloqueo **permanente** (localStorage).
- **Juntar los 25 = final final verdadero** del juego (clímax + imagen de la horda).
- **Gatillo:** vences a Uatu → te OFRECE (opt-in, tú decides) jugar la slot apostando TODOS tus $UATU.
- **Slot estilo SMB3** (Spade Panel: 3 carriles que paras tú, premio escalonado). Elegida sobre el
  volado porque da espectáculo, gradación y timing (ilusión de skill).
- **Ganar** = desbloqueas **1 oculto aleatorio** (sabor gacha).
- **Fallar** = 33% de quitarte un oculto YA desbloqueado (bajado de 50% para el feel).
- **Calibración:** con castigo 33%, basta ganar la slot **>~25%** de las veces para avanzar en
  promedio. La prob. de ganar la slot se fija al construir el minijuego con números reales (único cabo).

## 6. Verificación por lote
`node --check` de lo tocado + jugar 1 partida completa + code review antes de declarar cerrado el lote.

## 7. Cabos y notas
- [ ] **Definir las listas de personajes:** roster base ampliado (más Marvel/DC) + los 25 invitados de
  otros universos (quiénes son) — pendiente ANTES de generar sprites (Lote 5).
- [ ] Anotar en `constitution.md` que una pantalla de explicación mínima (atract-mode) NO viola el Principio #3.
- `tasks.md` de Fase 1 quedó desincronizado (todo `- [ ]` aunque el código ya corre). Actualizar al cerrar.
- **Scope ampliado a propósito:** el alcance creció y Rodolfo lo asume conscientemente ("vale la pena").
  Mitigación acordada: lotes chicos y jugables, uno a la vez — no acumular features a medias.
