// js/render.js — capa de presentación (pinta el DOM a partir del estado).
// No decide nada del juego: solo dibuja matchup, apuesta, bracket y cierre.
import { ARCHETYPES } from './config.js';

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

// ── HUD persistente (alias, saldo, ronda) ──────────────────────────
export function renderHeader(state) {
  const ronda = state.phase === 'uatu' ? 'PRUEBA DE UATU'
    : `RONDA ${state.round + 1} · COMBATE ${state.matchIndex + 1}`;
  el('hud').innerHTML = `
    <div class="row between panel">
      <span>${state.alias}</span>
      <span class="subtitle">${ronda}</span>
      <span class="coins">$UATU ${state.coins}</span>
    </div>`;
}

function statBars(stats) {
  return Object.keys(STAT_LABELS).map(k => `
    <div class="stat">
      <span class="label">${STAT_LABELS[k]}</span>
      <span class="bar"><span class="fill" style="width:${stats[k]}%"></span></span>
    </div>`).join('');
}

function fighterCard(f, odd) {
  const a = arch(f.archetype);
  const dmg = f.damage > 0 ? `<div class="dmg">daño ${Math.round(f.damage * 100)}%</div>` : '';
  const oddHtml = odd != null ? `<div class="odds">${pct(odd)}</div>` : '';
  // Si arrastra daño de una ronda previa, ya entra magullado.
  const src = spriteSrc(f.id, f.damage >= DMG_ROTO);
  return `
    <div class="fighter-card ${side(f)}" data-id="${esc(f.id)}">
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
export function renderMatchup(f1, f2, odds, isUatu) {
  const banner = isUatu
    ? `<div class="title center">⊙ LA PRUEBA FINAL ⊙</div>`
    : '';
  el('screen').innerHTML = `
    <div class="screen">
      ${banner}
      <div class="row">
        ${fighterCard(f1, odds.probability1)}
        <span class="vs">VS</span>
        ${fighterCard(f2, odds.probability2)}
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

// ── Bracket / historial ────────────────────────────────────────────
export function renderBracket(state) {
  const area = el('bracketarea');
  if (!area) return;
  const names = id => state.fighters[id]?.name || (id === 'uatu' ? 'Uatu' : id);
  const rows = state.history.slice(-6).map(h => {
    const res = h.bet ? (h.bet.won ? `+${h.bet.payout}` : '—') : '';
    return `<div class="match"><span>${h.matchId}</span><span class="w">${names(h.winnerId)}</span><span class="coins">${res}</span></div>`;
  }).join('');
  area.innerHTML = `<div class="panel bracket"><div class="round-title">RESULTADOS</div>${rows || '<div class="subtitle">—</div>'}</div>`;
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

// ── Cierre ─────────────────────────────────────────────────────────
export function renderClose(state, onReplay) {
  el('hud').innerHTML = '';
  const champ = state.fighters[state.champion];
  const won = state.history.filter(h => h.bet && h.bet.won).length;
  const total = state.history.filter(h => h.bet).length;
  const beatUatu = state.history.at(-1)?.winnerId === state.champion;
  el('screen').innerHTML = `
    <div class="screen center">
      <div class="title">FIN DEL TORNEO</div>
      <div class="panel">
        <div class="close-champ">🏆 ${champ ? champ.name : '—'}</div>
        <div class="subtitle">${beatUatu ? 'Superó la prueba de Uatu' : 'Cayó ante Uatu, y el multiverso con él'}</div>
        <div class="record">Aciertos: ${won}/${total}</div>
        <div class="record coins">Saldo final: $UATU ${state.coins}</div>
      </div>
      <button id="replay" class="btn accent full">JUGAR DE NUEVO</button>
    </div>`;
  el('replay').addEventListener('click', () => onReplay && onReplay());
}
