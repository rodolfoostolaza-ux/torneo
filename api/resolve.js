// api/resolve.js — wrapper serverless del motor. Mismo candado de Origin que
// narrate.js. NO contiene lógica de combate: solo envuelve lib/combat.resolve.
import { resolve } from '../lib/combat.js';

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

  const { fighter1, fighter2, torneoSeed, matchId, reveal } = req.body || {};
  if (!fighter1 || !fighter2 || torneoSeed == null || !matchId) {
    return res.status(400).json({ error: 'Missing combat data' });
  }
  try {
    return res.status(200).json(resolve(fighter1, fighter2, torneoSeed, matchId, !!reveal));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
