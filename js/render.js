// js/render.js — capa de presentación (pinta el DOM a partir del estado).
// No decide nada del juego: solo dibuja matchup, apuesta, bracket y cierre.
import { ARCHETYPES } from './config.js';

const el = id => document.getElementById(id);
const pct = p => `${Math.round(p * 100)}%`;
const side = f => (f.publisher === 'Marvel' ? 'marvel' : 'dc');
const arch = a => ARCHETYPES[a] || { icon: '❓', label: a };

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
  return `
    <div class="fighter-card ${side(f)}" data-id="${f.id}">
      <div class="name">${f.name}</div>
      <div class="pub ${side(f)}">${f.publisher}</div>
      <div class="arch">${a.icon} ${a.label}</div>
      ${oddHtml}${dmg}
      ${statBars(f.stats)}
    </div>`;
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
        <div class="subtitle">${beatUatu ? 'Superó la prueba de Uatu' : 'Cayó ante Uatu, pero su gesta quedó escrita'}</div>
        <div class="record">Aciertos: ${won}/${total}</div>
        <div class="record coins">Saldo final: $UATU ${state.coins}</div>
      </div>
      <button id="replay" class="btn accent full">JUGAR DE NUEVO</button>
    </div>`;
  el('replay').addEventListener('click', () => onReplay && onReplay());
}
