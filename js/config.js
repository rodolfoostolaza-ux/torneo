// js/config.js — datos del juego (sin lógica). ES module.

// Los 5 arquetipos (spec §2.2). Claves internas en minúscula sin acento.
export const ARCHETYPES = {
  peleador:  { icon: '🥊', label: 'Peleador'   },
  velocista: { icon: '⚡', label: 'Velocista'  },
  fuerza:    { icon: '💪', label: 'Fuerza'     },
  mistico:   { icon: '🔮', label: 'Místico'    },
  tecnologo: { icon: '🧠', label: 'Tecnólogo'  },
};

// Triángulo cíclico: cada arquetipo vence a UNO (spec §2.2). Duplicado del que
// vive en lib/combat.js A PROPÓSITO: el cliente lo usa para pintar pistas de
// matchup; el motor (server) tiene su propia copia autoritativa.
export const BEATS = {
  mistico:   'fuerza',
  fuerza:    'peleador',
  peleador:  'tecnologo',
  tecnologo: 'velocista',
  velocista: 'mistico',
};

// Roster 12v12 (spec §2.1). Stats portados de HARDCODED_STATS de v1 (index.html),
// escala 0–100 en {intelligence, strength, speed, durability, power, combat}.
export const ROSTER = {
  marvel: [
    { id: 'spiderman',    name: 'Spider-Man',      publisher: 'Marvel', archetype: 'velocista', stats: { intelligence:90,  strength:55,  speed:67,  durability:75,  power:74,  combat:90  } },
    { id: 'ironman',      name: 'Iron Man',        publisher: 'Marvel', archetype: 'tecnologo', stats: { intelligence:100, strength:85,  speed:58,  durability:85,  power:100, combat:64  } },
    { id: 'thor',         name: 'Thor',            publisher: 'Marvel', archetype: 'mistico',   stats: { intelligence:69,  strength:100, speed:92,  durability:100, power:100, combat:100 } },
    { id: 'hulk',         name: 'Hulk',            publisher: 'Marvel', archetype: 'fuerza',    stats: { intelligence:88,  strength:100, speed:35,  durability:100, power:100, combat:55  } },
    { id: 'capamerica',   name: 'Captain America', publisher: 'Marvel', archetype: 'peleador',  stats: { intelligence:75,  strength:19,  speed:42,  durability:50,  power:32,  combat:100 } },
    { id: 'wolverine',    name: 'Wolverine',       publisher: 'Marvel', archetype: 'peleador',  stats: { intelligence:63,  strength:32,  speed:50,  durability:100, power:50,  combat:100 } },
    { id: 'deadpool',     name: 'Deadpool',        publisher: 'Marvel', archetype: 'peleador',  stats: { intelligence:69,  strength:32,  speed:50,  durability:100, power:36,  combat:100 } },
    { id: 'drstrange',    name: 'Doctor Strange',  publisher: 'Marvel', archetype: 'mistico',   stats: { intelligence:100, strength:14,  speed:58,  durability:44,  power:100, combat:60  } },
    { id: 'thanos',       name: 'Thanos',          publisher: 'Marvel', archetype: 'fuerza',    stats: { intelligence:100, strength:100, speed:92,  durability:100, power:100, combat:100 } },
    { id: 'blackpanther', name: 'Black Panther',   publisher: 'Marvel', archetype: 'peleador',  stats: { intelligence:88,  strength:24,  speed:67,  durability:60,  power:36,  combat:100 } },
    { id: 'venom',        name: 'Venom',           publisher: 'Marvel', archetype: 'fuerza',    stats: { intelligence:50,  strength:85,  speed:67,  durability:85,  power:85,  combat:75  } },
    { id: 'magneto',      name: 'Magneto',         publisher: 'Marvel', archetype: 'mistico',   stats: { intelligence:100, strength:52,  speed:67,  durability:75,  power:100, combat:60  } },
  ],
  dc: [
    { id: 'batman',       name: 'Batman',          publisher: 'DC', archetype: 'tecnologo', stats: { intelligence:100, strength:11,  speed:27,  durability:42,  power:47,  combat:100 } },
    { id: 'superman',     name: 'Superman',        publisher: 'DC', archetype: 'fuerza',    stats: { intelligence:94,  strength:100, speed:100, durability:100, power:100, combat:85  } },
    { id: 'wonderwoman',  name: 'Wonder Woman',    publisher: 'DC', archetype: 'peleador',  stats: { intelligence:88,  strength:100, speed:87,  durability:100, power:100, combat:100 } },
    { id: 'flash',        name: 'Flash',           publisher: 'DC', archetype: 'velocista', stats: { intelligence:88,  strength:48,  speed:100, durability:60,  power:100, combat:65  } },
    { id: 'aquaman',      name: 'Aquaman',         publisher: 'DC', archetype: 'fuerza',    stats: { intelligence:69,  strength:85,  speed:75,  durability:85,  power:85,  combat:85  } },
    { id: 'joker',        name: 'Joker',           publisher: 'DC', archetype: 'tecnologo', stats: { intelligence:88,  strength:10,  speed:35,  durability:40,  power:40,  combat:75  } },
    { id: 'harley',       name: 'Harley Quinn',    publisher: 'DC', archetype: 'peleador',  stats: { intelligence:75,  strength:10,  speed:27,  durability:40,  power:25,  combat:85  } },
    { id: 'greenlantern', name: 'Green Lantern',   publisher: 'DC', archetype: 'mistico',   stats: { intelligence:75,  strength:75,  speed:92,  durability:75,  power:100, combat:70  } },
    { id: 'shazam',       name: 'Shazam',          publisher: 'DC', archetype: 'mistico',   stats: { intelligence:69,  strength:100, speed:92,  durability:100, power:100, combat:85  } },
    { id: 'blackadam',    name: 'Black Adam',      publisher: 'DC', archetype: 'fuerza',    stats: { intelligence:75,  strength:100, speed:92,  durability:100, power:100, combat:90  } },
    { id: 'lexluthor',    name: 'Lex Luthor',      publisher: 'DC', archetype: 'tecnologo', stats: { intelligence:100, strength:28,  speed:27,  durability:50,  power:75,  combat:50  } },
    { id: 'darkseid',     name: 'Darkseid',        publisher: 'DC', archetype: 'fuerza',    stats: { intelligence:100, strength:100, speed:67,  durability:100, power:100, combat:95  } },
  ],
};

// Uatu: el jefe final (spec §3.1 paso 5). Stats altísimos pero no infinitos.
export const UATU = {
  id: 'uatu', name: 'Uatu el Observador', publisher: 'Marvel', archetype: 'mistico',
  stats: { intelligence: 100, strength: 90, speed: 95, durability: 100, power: 100, combat: 85 },
};
