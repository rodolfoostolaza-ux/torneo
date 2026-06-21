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
        if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return;
        if (e.type === 'keydown') e.preventDefault();
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
