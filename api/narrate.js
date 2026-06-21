// api/narrate.js — el "vestido" de la pelea. Recibe el ganador YA decidido por el
// motor (lib/combat via /api/resolve) y devuelve narración corta para cajas RPG.
// La IA nunca decide quién gana (plan.md §4). Mismo candado de Origin y timeout
// que el resto de la API.
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
  let prompt;
  if (isUatuFight) {
    // El protagonista es el campeón (el que no es Uatu). A diferencia del plan §G1
    // original, la narración YA respeta el veredicto del motor: el campeón puede
    // SUPERAR la prueba o CAER ante Uatu (con humor negro cósmico).
    const champ = (winner && winner.id === 'uatu') ? loser : winner;
    const cName = clean(champ.name), cPub = clean(champ.publisher, 20);
    const champWon = !(winner && winner.id === 'uatu');
    if (champWon) {
      prompt =
        `Eres el narrador de un juego estilo cartucho SNES, en español.\n` +
        `${cName} (${cPub}) enfrenta la prueba final de Uatu el Observador.\n` +
        `El campeón SUPERA la prueba con gran sacrificio. Uatu revela que buscaba al ser ` +
        `capaz de salvar el multiverso de una colisión de universos.\n` +
        `Narra en EXACTAMENTE 3 líneas CORTAS de caja de diálogo RPG (máx ~12 palabras ` +
        `por línea, épicas, cero párrafos). Luego el sentido de la prueba en 1 frase y ` +
        `la cicatriz cósmica del campeón en 1 frase.\n` +
        `Responde SOLO JSON: {"lines":["..","..",".."],"loserFate":"..","winnerScar":".."}`;
    } else {
      prompt =
        `Eres el narrador de un juego estilo cartucho SNES, en español, con HUMOR NEGRO.\n` +
        `${cName} (${cPub}) enfrenta la prueba final de Uatu el Observador... y FRACASA.\n` +
        `Uatu lo juzga indigno; el campeón cae y el multiverso queda a merced de la ` +
        `colisión de universos. Tono: épico-trágico con humor negro cósmico — la apatía ` +
        `burocrática de un Observador que ya vio este final mil veces. Sin gore explícito.\n` +
        `Narra en EXACTAMENTE 3 líneas CORTAS de caja de diálogo RPG (máx ~12 palabras ` +
        `por línea, cero párrafos). Luego el destino del campeón caído en 1 frase y ` +
        `el veredicto final de Uatu sobre el multiverso condenado en 1 frase.\n` +
        `Responde SOLO JSON: {"lines":["..","..",".."],"loserFate":"..","winnerScar":".."}`;
    }
  } else {
    prompt =
      `Eres el narrador de un juego de pelea estilo cartucho SNES, en español.\n` +
      `${wName} (${wPub}) derrotó a ${lName} (${lPub}).\n` +
      `Factor decisivo: ${motivo}.\n` +
      `Narra el desenlace en EXACTAMENTE 3 líneas CORTAS de caja de diálogo RPG ` +
      `(máx ~12 palabras por línea, punzantes, cero párrafos). Luego el destino del ` +
      `perdedor en 1 frase y la cicatriz del ganador en 1 frase.\n` +
      `Responde SOLO JSON: {"lines":["..","..",".."],"loserFate":"..","winnerScar":".."}`;
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

// Extrae {lines, loserFate, winnerScar} del content. Intenta JSON; si no parsea,
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
          loserFate: o.loserFate || '',
          winnerScar: o.winnerScar || '',
        };
      }
    } catch { /* cae al respaldo de abajo */ }
  }
  const parts = text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5);
  return {
    lines: parts.slice(0, 3),
    loserFate: parts[3] || '',
    winnerScar: parts[4] || '',
  };
}
