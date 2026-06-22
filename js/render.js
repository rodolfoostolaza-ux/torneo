// js/render.js — capa de presentación (pinta el DOM a partir del estado).
// No decide nada del juego: solo dibuja matchup, apuesta, bracket y cierre.
import { ARCHETYPES, BEATS, ROSTER } from './config.js';
import { DialogueBox } from './dialogue.js';
import { boostCost, boostStat, healChampion } from './state.js';
import * as audio from './audio.js';

const el = id => document.getElementById(id);
const pct = p => `${Math.round(p * 100)}%`;
const side = f => (f.publisher === 'Marvel' ? 'marvel' : 'dc');
const arch = a => ARCHETYPES[a] || { icon: '❓', label: a };
// Escapa antes de interpolar en innerHTML. Hoy los nombres/ids son constantes del
// ROSTER, pero esto blinda atributos y texto por si alguna vez son dinámicos.
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Umbral de daño a partir del cual el retrato pasa a la versión "roto".
// El ganador que entra a la siguiente ronda con daño >= esto se ve magullado.
const DMG_ROTO = 0.5;
const spriteSrc = (id, broken) => `assets/fighters/${id}${broken ? '_roto' : ''}.png`;
// Si falta el sprite (batch a medias o archivo caído), oculta el marco y la
// carta queda en modo solo-texto, como antes de los retratos.
const ONERR = "this.closest('.portrait-wrap').style.display='none'";

const STAT_LABELS = {
  intelligence: 'INT', strength: 'FUE', speed: 'VEL',
  durability: 'RES', power: 'POD', combat: 'COM',
};

// ── Intro / montaje de la Convergencia (Lote 2) ────────────────────
// Title screen + lore en la misma caja RPG del combate (typewriter). Solo sale
// en el arranque fresco; "jugar de nuevo" no la repite (no molesta en replays).
const INTRO_LINES = [
  'Dos universos jamás debieron tocarse: Marvel y DC.',
  'UATU, el Observador, rompió su juramento por una pregunta: ¿quién gana si chocan?',
  'Ocho de Marvel. Ocho de DC. Dieciséis campeones cruzan el puente entre mundos.',
  'Tú no peleas — lees el combate y APUESTAS. Cada $UATU es tu palabra.',
  'Sobrevive al bracket. Al final del puente, el Observador baja a la arena.',
];

export async function renderIntro() {
  el('hud').innerHTML = '';
  el('screen').innerHTML = `
    <div class="screen center intro">
      <div class="intro-emblem">⊙</div>
      <div class="title intro-title">CONVERGENCIA</div>
      <div class="subtitle intro-sub"><span class="marvel-ink">MARVEL</span> vs <span class="dc-ink">DC</span></div>
      <div class="subtitle">— la prueba de Uatu —</div>
    </div>`;
  const box = new DialogueBox(el('dialogue'), { speed: 30, autoMs: 6500 });
  showDialogue();
  await box.show(INTRO_LINES);
  hideDialogue();
}

// ── Atract-mode de stats (D1: explicación mínima, ambiental, saltable) ──
// Como las pantallas que ciclaban en el NES sin apretar Start. NO es tutorial:
// muestra una ficha real anotada + el triángulo de arquetipos y avanza sola.
const STAT_GLOSS = {
  intelligence: 'planeación, tecnología, trampas',
  strength: 'daño físico bruto',
  speed: 'quién golpea primero',
  durability: 'cuánto castigo aguanta',
  power: 'energía y poderes especiales',
  combat: 'técnica y experiencia de pelea',
};

export function renderStatsAttract() {
  return new Promise(resolve => {
    el('hud').innerHTML = '';
    const ej = ROSTER.marvel.find(f => f.id === 'spiderman') || ROSTER.marvel[0];
    const glossRows = Object.keys(STAT_LABELS).map(k =>
      `<div class="gloss"><span class="gk">${STAT_LABELS[k]}</span><span class="gv">${STAT_GLOSS[k]}</span></div>`).join('');
    const cycle = [];
    let a = 'mistico';
    for (let i = 0; i < 5; i++) { cycle.push(arch(a).label); a = BEATS[a]; }
    el('screen').innerHTML = `
      <div class="screen center stats-attract">
        <div class="subtitle accent-text">CÓMO SE LEE UNA FICHA</div>
        <div class="row">
          ${fighterCard(ej)}
          <div class="panel gloss-panel">
            <div class="subtitle">Seis stats (0–100):</div>
            ${glossRows}
          </div>
        </div>
        <div class="panel">
          <div class="subtitle">Ventaja de arquetipo — cada uno vence al siguiente:</div>
          <div class="cycle">${cycle.join(' ▶ ')} ▶ …</div>
        </div>
        <button id="attract-start" class="btn accent full">START ▶</button>
      </div>`;
    const go = () => { clearTimeout(t); resolve(); };
    const t = setTimeout(go, 12000);     // ambiental: si nadie toca, avanza sola
    el('attract-start').addEventListener('click', go);
  });
}

// ── Pantalla de alias ──────────────────────────────────────────────
export function renderAlias() {
  return new Promise(resolve => {
    el('hud').innerHTML = '';
    el('screen').innerHTML = `
      <div class="screen center">
        <div class="title">CONVERGENCIA</div>
        <div class="subtitle">Marvel vs DC · La prueba de Uatu</div>
        <div class="panel">
          <p class="subtitle">Pon tu alias de arcade:</p>
          <input id="alias-input" type="text" maxlength="12" placeholder="ROD" autofocus />
          <div style="height:10px"></div>
          <button id="alias-go" class="btn accent full">COMENZAR</button>
        </div>
      </div>`;
    const input = el('alias-input');
    const go = () => {
      const alias = (input.value || 'ANON').trim().toUpperCase().slice(0, 12) || 'ANON';
      resolve(alias);
    };
    el('alias-go').addEventListener('click', go);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    input.focus();
  });
}

// ── Selección de campeón (D2 / Task A) ─────────────────────────────
// Antes de armar el bracket eliges UNO de los 24 del roster completo. Tu elegido
// entra GARANTIZADO al bracket de 16 (createTournament lo siembra). Te identificas
// con él: cada ronda que sobreviva te paga $UATU (settle), pero igual apuestas en
// todas. Mini-cartas (sprite + arquetipo, sin stats) en grilla.
function pickCard(f) {
  const a = arch(f.archetype);
  return `
    <button class="pick-card ${side(f)}" data-id="${esc(f.id)}">
      <div class="portrait-wrap">
        <img class="portrait" src="${spriteSrc(f.id, false)}" alt="${esc(f.name)}" loading="lazy" onerror="${ONERR}">
      </div>
      <div class="name">${esc(f.name)}</div>
      <div class="arch">${a.icon} ${a.label}</div>
    </button>`;
}

export function renderChampionSelect() {
  return new Promise(resolve => {
    el('hud').innerHTML = '';
    const byId = {};
    [...ROSTER.marvel, ...ROSTER.dc].forEach(f => { byId[f.id] = f; });
    el('screen').innerHTML = `
      <div class="screen champ-select">
        <div class="title center">ELIGE A TU CAMPEÓN</div>
        <div class="subtitle center">Uno de los 24 — tu elegido SIEMPRE entra al bracket de 16. Cada ronda que sobreviva te paga $UATU; igual apuestas en TODAS las peleas.</div>
        <div class="subtitle marvel-ink">MARVEL</div>
        <div class="pick-grid">${ROSTER.marvel.map(pickCard).join('')}</div>
        <div class="subtitle dc-ink">DC</div>
        <div class="pick-grid">${ROSTER.dc.map(pickCard).join('')}</div>
        <button id="champ-go" class="btn accent full" disabled>ELIGE UNO ↑</button>
      </div>`;
    let pickId = null;
    const cards = [...document.querySelectorAll('.pick-card')];
    const go = el('champ-go');
    cards.forEach(c => c.addEventListener('click', () => {
      pickId = c.dataset.id;
      cards.forEach(x => x.classList.toggle('sel', x === c));
      go.disabled = false;
      go.textContent = `CONFIRMAR: ${byId[pickId].name.toUpperCase()}`;
    }));
    // once: el confirmar cierra la pantalla; sin él un doble-toque resolvería dos veces.
    go.addEventListener('click', () => { if (pickId) resolve(pickId); }, { once: true });
  });
}

// ── Taller del elegido (Task B) ────────────────────────────────────
// Pantalla saltable que aparece SOLO antes del combate de tu elegido (si vive y
// tienes saldo; el gating vive en main.js). Curar daño (1 $UATU por 1%) o impulsar
// una stat (+5, costo creciente). Todo client-side: muta state.fighters[myChampion]
// vía los helpers de state.js y re-renderiza tras cada acción. Resuelve al CONTINUAR.
export function renderTaller(state) {
  return new Promise(resolve => {
    const mc = state.fighters[state.myChampion];
    const draw = () => {
      const dmgPct = Math.round(mc.damage * 100);
      const healPts = Math.min(dmgPct, state.coins);     // lo que el saldo permite curar
      const bcost = boostCost(state);
      const canBoost = state.coins >= bcost;
      const statRow = Object.keys(STAT_LABELS).map(k => {
        const dis = (!canBoost || mc.stats[k] >= 100) ? 'disabled' : '';
        return `<button class="btn taller-stat" data-stat="${k}" ${dis}>${STAT_LABELS[k]} <b>${mc.stats[k]}</b></button>`;
      }).join('');
      el('hud').innerHTML = '';
      el('screen').innerHTML = `
        <div class="screen taller">
          <div class="title center">⚒ EL TALLER ⚒</div>
          <div class="subtitle center">Antes de que ${esc(mc.name)} pise la arena. Invierte tu $UATU o sigue de largo.</div>
          <div class="row between panel">
            <span class="subtitle">★ ${esc(mc.name)}</span>
            <span class="subtitle">daño ${dmgPct}%</span>
            <span class="coins">$UATU ${state.coins}</span>
          </div>
          <button id="taller-heal" class="btn full" ${healPts > 0 ? '' : 'disabled'}>CURAR ${healPts}% · ${healPts} $UATU</button>
          <div class="subtitle">IMPULSAR +5 a una stat — próximo impulso: ${bcost} $UATU${canBoost ? '' : ' (sin saldo)'}</div>
          <div class="row taller-stats">${statRow}</div>
          <button id="taller-go" class="btn accent full">CONTINUAR A LA PELEA →</button>
        </div>`;
      el('taller-heal').addEventListener('click', () => { if (healChampion(state) > 0) draw(); });
      [...document.querySelectorAll('.taller-stat')].forEach(b =>
        b.addEventListener('click', () => { if (boostStat(state, b.dataset.stat)) draw(); }));
      el('taller-go').addEventListener('click', () => resolve(), { once: true });
    };
    draw();
  });
}

// ── Transición entre combates (pacing, Lote 3) ─────────────────────
// Cartel retro antes de cada pelea en vez del salto seco de antes. Nueva ronda
// (o la prueba de Uatu) = cartel grande y más tiempo; combate intermedio = breve.
// Auto-avanza, o se salta con un toque (con guarda anti doble-click residual).
const ROUND_NAMES = ['OCTAVOS DE FINAL', 'CUARTOS DE FINAL', 'SEMIFINAL', 'GRAN FINAL'];
const SHORT_ROUNDS = ['OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'];

export function renderRoundTransition(state) {
  return new Promise(resolve => {
    let title, sub, big;
    if (state.phase === 'uatu') {
      title = '⊙ LA PRUEBA FINAL ⊙'; sub = 'El Observador baja a la arena.'; big = true;
    } else {
      title = ROUND_NAMES[state.round] || `RONDA ${state.round + 1}`;
      sub = `Combate ${state.matchIndex + 1}`;
      big = state.matchIndex === 0;     // arranque de ronda = cartel grande
    }
    el('hud').innerHTML = '';
    el('screen').innerHTML = `
      <div class="screen center transition">
        <div class="title transition-title">${title}</div>
        <div class="subtitle">${sub}</div>
        <div class="subtitle dim">— toca para continuar —</div>
      </div>`;
    const startAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const finish = () => { clearTimeout(t); document.removeEventListener('click', onClick); resolve(); };
    const onClick = () => {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (now - startAt < 250) return;   // ignora el click residual que abrió esta pantalla
      finish();
    };
    const t = setTimeout(finish, big ? 1500 : 850);
    document.addEventListener('click', onClick);
  });
}

// ── HUD persistente (alias, saldo, ronda) ──────────────────────────
// ¿Tu elegido sigue en pie? Cayó si alguna vez fue el perdedor de un combate.
export function champAlive(state) {
  return state.myChampion && !state.history.some(h => h.loserId === state.myChampion);
}

export function renderHeader(state) {
  const ronda = state.phase === 'uatu' ? 'PRUEBA DE UATU'
    : `RONDA ${state.round + 1} · COMBATE ${state.matchIndex + 1}`;
  let champLine = '';
  if (state.myChampion) {
    const mc = state.fighters[state.myChampion];
    const alive = champAlive(state);
    const dmg = mc.damage > 0 ? ` · daño ${Math.round(mc.damage * 100)}%` : '';
    const status = alive ? `en pie${dmg}` : 'eliminado';
    champLine = `
      <div class="row between champ-bar ${alive ? '' : 'down'}">
        <span class="subtitle">★ TU ELEGIDO</span>
        <span class="subtitle">${esc(mc.name)} — ${status}</span>
      </div>`;
  }
  el('hud').innerHTML = `
    <div class="row between panel">
      <span>${esc(state.alias)}</span>
      <span class="subtitle">${ronda}</span>
      <span class="coins">$UATU ${state.coins}</span>
    </div>${champLine}`;
}

function statBars(stats) {
  return Object.keys(STAT_LABELS).map(k => `
    <div class="stat">
      <span class="label">${STAT_LABELS[k]}</span>
      <span class="bar"><span class="fill" style="width:${stats[k]}%"></span></span>
    </div>`).join('');
}

function fighterCard(f, odd, mine) {
  const a = arch(f.archetype);
  const dmg = f.damage > 0 ? `<div class="dmg">daño ${Math.round(f.damage * 100)}%</div>` : '';
  const oddHtml = odd != null ? `<div class="odds">${pct(odd)}</div>` : '';
  const star = mine ? '<div class="mine-tag">★ TU ELEGIDO</div>' : '';
  // Si arrastra daño de una ronda previa, ya entra magullado.
  const src = spriteSrc(f.id, f.damage >= DMG_ROTO);
  return `
    <div class="fighter-card ${side(f)}${mine ? ' mine' : ''}" data-id="${esc(f.id)}">
      ${star}
      <div class="portrait-wrap">
        <img class="portrait" src="${src}" alt="${esc(f.name)}" loading="lazy" onerror="${ONERR}">
      </div>
      <div class="name">${esc(f.name)}</div>
      <div class="pub ${side(f)}">${f.publisher}</div>
      <div class="arch">${a.icon} ${a.label}</div>
      ${oddHtml}${dmg}
      ${statBars(f.stats)}
    </div>`;
}

// Efecto al cerrarse el combate (cartas aún en pantalla tras el diálogo):
// el perdedor tiembla y pasa a su retrato roto; el ganador tiembla y solo
// pasa a roto si el combate lo dejó por encima del umbral. Resuelve cuando el
// golpe visual terminó, para que el motor liquide después.
export function applyDamageVisual(winnerId, loserId, damageToWinner) {
  return new Promise(resolve => {
    audio.sfx('hit');               // el impacto suena justo con la sacudida
    swapBroken(loserId);
    shakeCard(loserId);
    shakeCard(winnerId);
    if (damageToWinner >= DMG_ROTO) swapBroken(winnerId);
    setTimeout(resolve, 750);
  });
}

function swapBroken(id) {
  const img = document.querySelector(`.fighter-card[data-id="${id}"] img.portrait`);
  if (!img) { console.warn('[render] swapBroken: sin carta para id', id); return; }
  if (img.dataset.broken) return;
  img.dataset.broken = '1';
  img.src = spriteSrc(id, true);
}

function shakeCard(id) {
  const card = document.querySelector(`.fighter-card[data-id="${id}"]`);
  if (!card) { console.warn('[render] shakeCard: sin carta para id', id); return; }
  card.classList.remove('hit');
  void card.offsetWidth;            // fuerza reflow para re-disparar la animación
  card.classList.add('hit');
  setTimeout(() => card.classList.remove('hit'), 450);
}

// ── Matchup ────────────────────────────────────────────────────────
export function renderMatchup(f1, f2, odds, isUatu, myChampion) {
  const banner = isUatu
    ? `<div class="title center">⊙ LA PRUEBA FINAL ⊙</div>`
    : '';
  el('screen').innerHTML = `
    <div class="screen">
      ${banner}
      <div class="row">
        ${fighterCard(f1, odds.probability1, f1.id === myChampion)}
        <span class="vs">VS</span>
        ${fighterCard(f2, odds.probability2, f2.id === myChampion)}
      </div>
      <div id="betarea"></div>
      <div id="bracketarea"></div>
    </div>`;
}

// ── Controles de apuesta (obligatoria, spec §6) ────────────────────
// Devuelve Promise<{fighterId, amount}>; no se puede confirmar sin elegir.
export function renderBetControls(f1, f2, coins) {
  return new Promise(resolve => {
    const amounts = [10, 25, 50];
    let pickId = null, amount = 25;
    el('betarea').innerHTML = `
      <div class="panel bet">
        <div class="subtitle">¿Quién gana? (apostar es obligatorio · es gratis)</div>
        <div class="row">
          <button class="btn full pickbtn" data-id="${f1.id}">${f1.name}</button>
          <button class="btn full pickbtn" data-id="${f2.id}">${f2.name}</button>
        </div>
        <div class="subtitle">Convicción:</div>
        <div class="amounts">
          ${amounts.map(a => `<button class="btn amtbtn ${a === amount ? 'accent' : ''}" data-amt="${a}">${a}</button>`).join('')}
        </div>
        <button id="bet-go" class="btn accent full" disabled>APOSTAR Y PELEAR</button>
        <div id="bet-warn" class="warn"></div>
      </div>`;

    const picks = [...document.querySelectorAll('.pickbtn')];
    const amts = [...document.querySelectorAll('.amtbtn')];
    const go = el('bet-go');

    picks.forEach(b => b.addEventListener('click', () => {
      pickId = b.dataset.id;
      picks.forEach(p => p.classList.toggle('accent', p === b));
      go.disabled = false;
    }));
    amts.forEach(b => b.addEventListener('click', () => {
      amount = Number(b.dataset.amt);
      amts.forEach(a => a.classList.toggle('accent', a === b));
    }));
    go.addEventListener('click', () => {
      if (!pickId) { el('bet-warn').textContent = 'Elige a un luchador.'; return; }
      el('betarea').innerHTML = '';
      resolve({ fighterId: pickId, amount });
    });
  });
}

// ── Bracket lateral (progreso + daño acumulado en vivo, Lote 3) ────
// Barra de rondas (octavos → Uatu) + los combates ya resueltos de la ronda en
// curso, con el daño que arrastra cada ganador vivo. Tu elegido va con ★.
const fighterName = (state, id) => state.fighters[id]?.name || (id === 'uatu' ? 'Uatu' : id);

export function renderBracket(state) {
  const area = el('bracketarea');
  if (!area) return;
  const mine = state.myChampion;
  const star = id => id === mine ? '★ ' : '';

  // Barra de progreso de rondas (la última etapa es la prueba de Uatu).
  const steps = [...SHORT_ROUNDS, 'UATU'];
  // done = todo completado (curIdx fuera de rango → ningún paso queda 'cur').
  const curIdx = state.phase === 'done' ? steps.length : (state.phase === 'uatu' ? 4 : state.round);
  const prog = steps.map((s, i) =>
    `<span class="step ${i === curIdx ? 'cur' : (i < curIdx ? 'done' : '')}">${s}</span>`
  ).join('<span class="sep">▸</span>');

  // Resultados de la ronda en curso, con daño en vivo del ganador.
  let rows = '<div class="subtitle dim">— ronda en marcha —</div>';
  let title = state.phase === 'uatu' ? 'PRUEBA DE UATU' : (SHORT_ROUNDS[state.round] || '');
  if (state.phase === 'tournament') {
    const done = state.bracket[state.round].filter(m => m.resolved);
    if (done.length) {
      rows = done.map(m => {
        const dmg = state.fighters[m.winnerId] ? `${Math.round(state.fighters[m.winnerId].damage * 100)}%` : '';
        return `<div class="bm">
          <span class="w">${star(m.winnerId)}${esc(fighterName(state, m.winnerId))}</span>
          <span class="bd">${dmg}</span>
          <span class="l">${star(m.loserId)}${esc(fighterName(state, m.loserId))}</span>
        </div>`;
      }).join('');
    }
  }
  area.innerHTML = `
    <div class="panel tourney">
      <div class="tourney-prog">${prog}</div>
      <div class="round-title">${title}</div>
      ${rows}
    </div>`;
}

// Nombre de ronda a partir del matchId (R1-Mx → octavos…), para el cierre.
function roundLabelOf(matchId) {
  const m = /^R(\d)/.exec(matchId || '');
  if (!m) return 'el camino';
  return ['octavos', 'cuartos', 'la semifinal', 'la final'][Number(m[1]) - 1] || 'el camino';
}

// Resumen de tu elegido para el cierre: ¿llegó al final o dónde cayó?
function myChampLine(state) {
  if (!state.myChampion) return '';
  const mc = state.fighters[state.myChampion];
  let fate;
  if (state.champion === state.myChampion) {
    fate = 'tu elegido, llegó hasta el final del puente';
  } else {
    const fell = state.history.find(h => h.loserId === state.myChampion);
    fate = `tu elegido, cayó en ${roundLabelOf(fell && fell.matchId)}`;
  }
  const bonus = state.champBonus > 0 ? ` Te dio $UATU ${state.champBonus}.` : '';
  return `<div class="record">★ ${esc(mc.name)}, ${fate}.${bonus}</div>`;
}

// ── Mostrar/ocultar caja de diálogo ────────────────────────────────
export function showDialogue() { el('dialogue').classList.remove('hidden'); }
export function hideDialogue() { el('dialogue').classList.add('hidden'); el('dialogue').innerHTML = ''; }

// ── Error fatal ────────────────────────────────────────────────────
// Salida visible cuando el torneo agota los reintentos (servidor caído):
// en vez de congelarse mudo, avisa y ofrece recargar.
export function renderFatal(message) {
  hideDialogue();
  el('hud').innerHTML = '';
  el('screen').innerHTML = `
    <div class="screen center">
      <div class="title">UPS</div>
      <div class="panel"><div class="subtitle">${esc(message)}</div></div>
      <button id="reload" class="btn accent full">REINTENTAR</button>
    </div>`;
  el('reload').addEventListener('click', () => location.reload());
}

// ── Cierre épico (Lote 2) ──────────────────────────────────────────
// Bifurca el final según el veredicto del motor (el cliente NO decide: lee
// history.at(-1) con phase 'done'). Victoria → créditos arcade que duplican
// $UATU → pantalla de campeón. Derrota → game over con humor negro.
export async function renderEnding(state, onReplay) {
  el('hud').innerHTML = '';
  hideDialogue();
  const champ = state.fighters[state.champion];
  const won = state.history.filter(h => h.bet && h.bet.won).length;
  const total = state.history.filter(h => h.bet).length;
  // Ancla a phase 'done' (settle ya corrió la pelea de Uatu): blinda el at(-1).
  const beatUatu = state.phase === 'done' && state.history.at(-1)?.winnerId === state.champion;

  if (beatUatu) {
    await rollCredits(state, champ);
    // BONUS por vencer a Uatu (recompensa meta, no combate). Guard de idempotencia:
    // aunque hoy renderEnding corre una sola vez por partida, blinda contra duplicar
    // el saldo si alguna vez se reentra sobre el mismo state.
    if (!state._bonusApplied) { state._bonusApplied = true; state.coins *= 2; }
    renderChampion(state, champ, won, total, onReplay);
  } else {
    renderGameOver(state, champ, won, total, onReplay);
  }
}

// Retrato grande centrado reutilizando portrait-wrap (su onerror oculta el marco
// si falta el sprite). broken = retrato roto (para la derrota).
function endingPortrait(fighter, broken) {
  if (!fighter) return '';
  const src = spriteSrc(fighter.id, broken);
  return `<div class="ending-portrait"><div class="portrait-wrap">
      <img class="portrait" src="${src}" alt="${esc(fighter.name)}" onerror="${ONERR}"></div></div>`;
}

// Créditos arcade: scroll de cartucho con humor seco. Dura ~9s o lo saltas.
function rollCredits(state, champ) {
  return new Promise(resolve => {
    el('screen').innerHTML = `
      <div class="screen center">
        <div class="credits-viewport">
          <div class="credits-roll">
            <div class="title">CONVERGENCIA</div>
            <div class="subtitle">un torneo improvisado por</div>
            <div class="credits-name">UATU EL OBSERVADOR</div>
            <div class="credits-gap"></div>
            <div class="credits-line"><span>CAMPEÓN</span><b>${esc(champ ? champ.name : '—')}</b></div>
            <div class="credits-line"><span>APOSTADOR</span><b>${esc(state.alias)}</b></div>
            <div class="credits-line"><span>MULTIVERSO</span><b>intacto, por hoy</b></div>
            <div class="credits-line"><span>ÁRBITRO</span><b>rompió su juramento</b></div>
            <div class="credits-gap"></div>
            <div class="subtitle">hiciste parpadear al Observador.</div>
            <div class="title accent-text">GRACIAS POR JUGAR</div>
          </div>
        </div>
        <button id="credits-skip" class="btn full">▶ CONTINUAR</button>
      </div>`;
    const done = () => { clearTimeout(t); resolve(); };
    const t = setTimeout(done, 9000);
    el('credits-skip').addEventListener('click', done);
  });
}

function renderChampion(state, champ, won, total, onReplay) {
  audio.music('title');             // vuelve el tema heroico para el cierre
  audio.sfx('champion');            // fanfarria de victoria
  el('screen').innerHTML = `
    <div class="screen center">
      <div class="title">⊙ CAMPEÓN ⊙</div>
      ${endingPortrait(champ, false)}
      <div class="close-champ">🏆 ${esc(champ ? champ.name : '—')}</div>
      <div class="panel">
        <div class="subtitle">El Observador parpadeó. El multiverso resiste un día más.</div>
        ${myChampLine(state)}
        <div class="record">Aciertos: ${won}/${total}</div>
        <div class="record coins">BONUS UATU ×2 → Saldo: $UATU ${state.coins}</div>
      </div>
      <button id="replay" class="btn accent full">JUGAR DE NUEVO</button>
    </div>`;
  // once: evita que un doble-click arranque dos torneos en paralelo pisándose el DOM.
  el('replay').addEventListener('click', () => onReplay && onReplay(), { once: true });
}

function renderGameOver(state, champ, won, total, onReplay) {
  audio.music(null);                // silencio sombrío tras
  audio.sfx('gameover');            // descenso fúnebre
  el('screen').innerHTML = `
    <div class="screen center gameover">
      <div class="title lose-text">GAME OVER</div>
      ${endingPortrait(champ, true)}
      <div class="panel">
        <div class="subtitle">${esc(champ ? champ.name : 'Tu campeón')} cayó ante Uatu. El Observador ni se inmuta.</div>
        <div class="subtitle dim">Otro multiverso a la basura.</div>
        ${myChampLine(state)}
        <div class="record">Aciertos: ${won}/${total}</div>
        <div class="record coins">Saldo final: $UATU ${state.coins}</div>
      </div>
      <button id="replay" class="btn accent full">JUGAR DE NUEVO</button>
    </div>`;
  // once: evita que un doble-click arranque dos torneos en paralelo pisándose el DOM.
  el('replay').addEventListener('click', () => onReplay && onReplay(), { once: true });
}
