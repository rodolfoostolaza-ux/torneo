// api/narrate.js — el "vestido" de la pelea. Recibe el ganador YA decidido por el
// motor (lib/combat via /api/resolve) y devuelve narración corta para cajas RPG.
// La IA nunca decide quién gana (plan.md §4). Mismo candado de Origin y timeout
// que el resto de la API.
export default async function handler(req, res) {
  const stripSlash = s => s.replace(/\/+$/, '');
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://torneo-convergencia.vercel.app')
    .split(',').map(s => stripSlash(s.trim())).filter(Boolean);
  const origin = stripSlash(req.headers.origin || '');
  // Same-origin SIEMPRE permitido: la página y esta API viven en el MISMO deployment,
  // así que cualquier URL de Vercel desde la que se sirva el juego (dominio default,
  // alias, preview) es legítima. Sin esto el candado se autobloquea cuando el dominio
  // público no coincide con ALLOWED_ORIGINS → 403 en todo (el bug del "cartel de error"
  // en móvil). La allowlist queda solo para orígenes EXTERNOS explícitos.
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  // host (NO x-forwarded-host): el navegador fija el header Host al dominio destino y el JS
  // de una página no puede alterarlo; x-forwarded-host SÍ se puede inyectar y abriría un
  // bypass (Origin externo + x-forwarded-host clonado). En Vercel, host ya es el dominio
  // público del request.
  const host = req.headers.host || '';
  const selfOrigin = host ? stripSlash(`${proto}://${host}`) : '';
  const isAllowed = (!!origin && origin === selfOrigin) || allowed.includes(origin);

  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowed) return res.status(403).json({ error: 'Origin not allowed' });

  const { winner, loser, reason, isUatuFight } = req.body || {};
  if (!winner || !loser) {
    return res.status(400).json({ error: 'Missing winner/loser data' });
  }

  // Sanitiza lo que viene del cliente antes de interpolarlo en el prompt: corta la
  // inyección de instrucciones vía nombres/publisher/motivo manipulados.
  const clean = (s, n = 40) => String(s ?? '').replace(/[^\p{L}\p{N} .,'\-!¡?¿]/gu, '').slice(0, n);
  const wName = clean(winner.name), wPub = clean(winner.publisher, 20);
  const lName = clean(loser.name), lPub = clean(loser.publisher, 20);

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'CEREBRAS_API_KEY not configured' });

  const motivo = clean(reason, 120) || 'la diferencia de poder fue decisiva';
  // Guardia de canon ADAPTATIVA: la IA puede teñir el diálogo con la historia real
  // de los personajes SI existe, pero tiene prohibido inventar hechos como si fueran
  // canon. Misma instrucción en los 3 prompts (combate normal + las dos ramas de Uatu).
  const CANON = `CANON: si los personajes comparten historia real en los cómics, deja que el ` +
    `diálogo lo refleje con sutileza; si NO, sé fiel a sus personalidades. NUNCA inventes ` +
    `hechos ni cites eventos que no ocurrieron.\n`;
  // Contrato JSON nuevo (Convergencia v2): además de la narración, los personajes HABLAN.
  // winnerLine/loserLine = la frase que dice cada uno, en su voz, SIN su nombre (el
  // cliente la formatea). Sustituye al viejo loserFate/winnerScar (la "cicatriz cósmica":
  // el daño real del ganador ahora lo pone el cliente desde el número del motor).
  const JSON_SHAPE = `Responde SOLO JSON: {"lines":["..","..",".."],"winnerLine":"..","loserLine":".."}`;

  let prompt;
  if (isUatuFight) {
    // El protagonista es el campeón (el que no es Uatu). La narración YA respeta el
    // veredicto del motor: el campeón puede SUPERAR la prueba o CAER ante Uatu.
    const champ = (winner && winner.id === 'uatu') ? loser : winner;
    const cName = clean(champ.name), cPub = clean(champ.publisher, 20);
    const champWon = !(winner && winner.id === 'uatu');
    if (champWon) {
      prompt =
        `Eres el narrador de un juego estilo cartucho SNES, en español, y das voz a los personajes.\n` +
        `${cName} (${cPub}) enfrenta la prueba final de Uatu el Observador, y la SUPERA con gran ` +
        `sacrificio. Uatu buscaba al ser capaz de salvar el multiverso de una colisión de universos.\n` +
        CANON +
        `Devuelve:\n` +
        `- "lines": EXACTAMENTE 3 líneas de caja RPG (máx ~12 palabras c/u, épicas), sin revelar el ` +
        `desenlace hasta la 3ª.\n` +
        `- "winnerLine": lo que GRITA ${cName} al superar la prueba, en su voz (1 frase, SIN su nombre).\n` +
        `- "loserLine": lo que concede Uatu al inclinarse ante el digno (1 frase, SIN nombre).\n` +
        JSON_SHAPE;
    } else {
      prompt =
        `Eres el narrador de un juego estilo cartucho SNES, en español, con HUMOR NEGRO, y das voz a ` +
        `los personajes.\n` +
        `${cName} (${cPub}) enfrenta la prueba final de Uatu el Observador... y FRACASA. Uatu lo juzga ` +
        `indigno; el campeón cae y el multiverso queda a merced de la colisión de universos. Tono: ` +
        `épico-trágico con la apatía burocrática de un Observador que ya vio este final mil veces. ` +
        `Sin gore explícito.\n` +
        CANON +
        `Devuelve:\n` +
        `- "lines": EXACTAMENTE 3 líneas de caja RPG (máx ~12 palabras c/u), sin revelar el desenlace ` +
        `hasta la 3ª.\n` +
        `- "winnerLine": el veredicto frío de Uatu sobre el multiverso condenado (1 frase, SIN nombre).\n` +
        `- "loserLine": las últimas palabras de ${cName} al caer, en su voz (1 frase, SIN su nombre).\n` +
        JSON_SHAPE;
    }
  } else {
    // El motor ya decidió que gana ${wName}; la narración NO debe spoilearlo antes de
    // la 3ª línea. Construye tensión, corona al final, y deja que ambos HABLEN.
    prompt =
      `Eres el narrador de un combate épico estilo cartucho SNES, en español, y das voz a los personajes.\n` +
      `Duelo: ${wName} (${wPub}) contra ${lName} (${lPub}). El vencedor real es ${wName}, gracias a que ` +
      `${motivo}. PROHIBIDO revelar quién gana antes de la 3ª línea.\n` +
      CANON +
      `Devuelve:\n` +
      `- "lines": EXACTAMENTE 3 líneas de caja RPG con verbos potentes (máx ~11 palabras c/u): L1 el ` +
      `choque inicial, pura tensión, SIN ganador; L2 el momento que inclina la balanza; L3 el golpe ` +
      `final que corona a ${wName}.\n` +
      `- "winnerLine": lo que DICE ${wName} al ganar, en su propia voz (1 frase corta, SIN su nombre).\n` +
      `- "loserLine": lo que DICE ${lName} al caer, en su propia voz (1 frase corta, SIN su nombre).\n` +
      JSON_SHAPE;
  }

  // Timeout duro: si Cerebras no responde en 15s, abortamos. El cliente tiene su
  // fallbackNarration para este caso (la narración es cosmética).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // Cerebras está detrás de Cloudflare y bloquea User-Agents "de bot"
        // (HTTP 403, code 1010). Un UA de browser lo evita.
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        model: 'gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_completion_tokens: 600,
        reasoning_effort: 'low',
      }),
    });

    const d = await r.json();
    if (!r.ok || d.error) {
      return res.status(502).json({ error: d.error?.message || `Cerebras HTTP ${r.status}` });
    }

    const text = d.choices?.[0]?.message?.content || '';
    if (!text) return res.status(502).json({ error: 'Empty response from Cerebras' });

    return res.status(200).json(parseNarration(text));
  } catch (e) {
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: 'Cerebras tardó demasiado (timeout 15s)' });
    }
    console.error('narrate error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    clearTimeout(timeout);
  }
}

// Extrae {lines, winnerLine, loserLine} del content. Intenta JSON; si no parsea,
// parte el texto en líneas cortas como respaldo.
function parseNarration(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const o = JSON.parse(m[0]);
      const lines = Array.isArray(o.lines) ? o.lines.filter(Boolean).slice(0, 4) : [];
      if (lines.length) {
        return {
          lines,
          winnerLine: o.winnerLine || '',
          loserLine: o.loserLine || '',
        };
      }
    } catch { /* cae al respaldo de abajo */ }
  }
  // Sin JSON parseable no sabemos QUIÉN dice qué: adivinar la cita por posición
  // cruzaría la atribución (frase del ganador puesta en boca del perdedor). Rescatamos
  // solo las líneas de narración (que no tienen dueño) y dejamos winnerLine/loserLine
  // vacíos: el cliente cae a su fallbackNarration local, que SÍ atribuye bien.
  const parts = text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3);
  return { lines: parts, winnerLine: '', loserLine: '' };
}
