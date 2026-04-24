export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fighter1, fighter2, round, isUatuFight } = req.body;

  if (!fighter1 || !fighter2) {
    return res.status(400).json({ error: 'Missing fighter data' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  }

  const ss = f =>
    `intelligence:${f.stats.intelligence} strength:${f.stats.strength} ` +
    `speed:${f.stats.speed} durability:${f.stats.durability} ` +
    `power:${f.stats.power} combat:${f.stats.combat}`;

  const dd = f => f.damage ? ` [daño previo: ${f.damage}]` : '';

  let prompt;
  if (isUatuFight) {
    // fighter1 = Uatu, fighter2 = champion
    prompt =
      `Narra en español la prueba final cósmica en la que Uatu el Observador ` +
      `(stats: ${ss(fighter1)}) pone a prueba al campeón ${fighter2.name} (${fighter2.publisher}, ` +
      `stats: ${ss(fighter2)})${dd(fighter2)}. ` +
      `EL CAMPEÓN DEBE GANAR ESTA PRUEBA FINAL aunque con gran sacrificio. ` +
      `Describe los poderes específicos de ${fighter2.name} y cómo los usa para superar a Uatu. ` +
      `Escribe 4 párrafos cinematográficos épicos en español. ` +
      `Termina EXACTAMENTE con: ` +
      `GANADOR: ${fighter2.name} | ` +
      `MUERTE: Uatu revela que nunca pretendió matar al campeón; la prueba era para encontrar al ser capaz de salvar el multiverso de una colisión de universos | ` +
      `DAÑO: ${fighter2.name} quedó con cicatrices cósmicas que brillan eternamente como prueba de su victoria`;
  } else {
    prompt =
      `Narra en español un combate épico a muerte en la arena cósmica de Uatu entre ` +
      `${fighter1.name} (${fighter1.publisher}, stats: ${ss(fighter1)})${dd(fighter1)} ` +
      `VS ${fighter2.name} (${fighter2.publisher}, stats: ${ss(fighter2)})${dd(fighter2)}. ` +
      `Ronda: ${round}. ` +
      `Describe los poderes específicos de cada personaje, sus tácticas de combate y cómo sus stats determinan el resultado. ` +
      `Escribe 3-4 párrafos cinematográficos épicos en español. ` +
      `Mejor stats = más probabilidad de ganar, pero los upsets son posibles y deseables. ` +
      `Termina EXACTAMENTE así en la última línea: ` +
      `GANADOR: [nombre exacto de arriba] | MUERTE: [cómo murió el perdedor, 2 oraciones brutales] | DAÑO: [daño físico visible que quedó en el ganador, 1 oración]`;
  }

  const openrouterUrl =
    `https://openrouter.ai/api/v1/chat/completions`;

  try {
    const r = await fetch(openrouterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': '', // optional
        'X-OpenRouter-Title': '', // optional
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.95,
        max_tokens: 4000
      })
    });

    const d = await r.json();

    if (!r.ok || d.error) {
      return res.status(502).json({ error: d.error?.message || `OpenRouter HTTP ${r.status}` });
    }

    const text = d.choices?.[0]?.message?.content || '';
    if (!text) {
      return res.status(502).json({ error: 'Empty response from OpenRouter' });
    }

    const ganadorM    = text.match(/GANADOR:\s*([^\|\n]+)/i);
    const muerteM     = text.match(/MUERTE:\s*([^\|\n]+)/i);
    const dañoM       = text.match(/DA[NÑ]O:\s*([^\|\n]+)/i);

    const winnerName   = ganadorM ? ganadorM[1].trim() : '';
    const loserFate    = muerteM  ? muerteM[1].trim()  : 'Cayó derrotado en combate mortal.';
    const winnerDamage = dañoM    ? dañoM[1].trim()    : 'Quedó con heridas menores del combate.';
    const narration    = text.replace(/GANADOR:.*$/is, '').trim();

    return res.status(200).json({ narration, winnerName, loserFate, winnerDamage, epilogue: narration });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}