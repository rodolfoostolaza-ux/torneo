// js/dialogue.js — cajas de diálogo RPG. Escribe línea por línea con typewriter;
// el jugador avanza con click / Enter / Espacio. Es el vehículo de TODA narración.
export class DialogueBox {
  // speed: ms por carácter del typewriter. minHoldMs: tiempo mínimo que una línea
  // queda fija antes de aceptar avance manual (anti-mash: evita ráfagas a la API de
  // narración). autoMs: si el jugador no hace nada, la línea avanza sola pasado esto.
  constructor(el, { speed = 28, minHoldMs = 700, autoMs = 4000 } = {}) {
    this.el = el; this.speed = speed; this.minHoldMs = minHoldMs; this.autoMs = autoMs;
    this._readyAt = 0; this._advancing = false;
  }

  // Muestra un array de líneas, una por caja. Resuelve cuando el jugador termina.
  // Cada línea: typewriter → queda fija un mínimo → avanza por toque (Enter/Espacio/
  // click) o, si nadie la toca, sola a los autoMs. El 1er toque durante el typewriter
  // completa la línea sin avanzar.
  show(lines) {
    return new Promise(resolve => {
      let i = 0;
      const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const clearAuto = () => { if (this._autoT) { clearTimeout(this._autoT); this._autoT = null; } };
      const next = async () => {
        if (this._advancing || this._typing) return;        // reentrancia: un solo avance por línea
        this._advancing = true;
        clearAuto();
        if (i >= lines.length) { this._advancing = false; this._unbind(advance); return resolve(); }
        await this._type(lines[i++]);
        this._readyAt = now();                              // línea fija: arranca el reloj
        this._autoT = setTimeout(() => next(), this.autoMs); // avance automático
        this._advancing = false;
      };
      const advance = (e) => {
        if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return;
        if (e.type === 'keydown') e.preventDefault();
        if (this._typing) { this._skip = true; return; }          // 1er toque: completa la línea
        if (now() - this._readyAt < this.minHoldMs) return;       // anti-mash: aún no avanza
        next();                                                   // avanza a la siguiente
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
