// ============================================================
// data.js — Antigravity Pokémon Team Builder
// Static data: type chart, legendaries, items, type metadata
// ============================================================

// --- 18×18 Type Effectiveness Matrix ---
// Outer key = attacking type, inner key = defending type
// Value: 2 = super-effective, 0.5 = not-very-effective, 0 = immune, 1 = normal
const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

const ALL_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic',
  'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

// Returns effectiveness multiplier of attackingType vs defendingType
function getEffectiveness(attackingType, defendingType) {
  const row = TYPE_CHART[attackingType];
  if (!row) return 1;
  return row[defendingType] !== undefined ? row[defendingType] : 1;
}

// Returns combined multiplier for attackingType vs a dual-type Pokémon
function getCombinedEffectiveness(attackingType, type1, type2) {
  let m = getEffectiveness(attackingType, type1);
  if (type2) m *= getEffectiveness(attackingType, type2);
  return m;
}

// --- Legendary / Mythical Pokémon Dex IDs ---
// Includes Gen 1–9 legendaries and mythicals
const LEGENDARY_IDS = new Set([
  // Gen 1
  144, 145, 146, 150, 151,
  // Gen 2
  243, 244, 245, 249, 250, 251,
  // Gen 3
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  // Gen 4
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
  // Gen 5
  494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
  // Gen 6
  716, 717, 718, 719, 720, 721,
  // Gen 7
  785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797, 798, 799, 800, 801, 802, 807, 808, 809,
  // Gen 8
  888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898,
  // Gen 9
  1001, 1002, 1003, 1004, 1007, 1008, 1009, 1010, 1017, 1024, 1025
]);

// --- Item Data ---
// Each item: name, sprite slug (PokéAPI items endpoint), statTrigger, rationale
const ITEMS = [
  { name: 'Choice Band', slug: 'choice-band', statTrigger: 'attack', rationale: 'Great for high Attack stat Pokémon' },
  { name: 'Choice Specs', slug: 'choice-specs', statTrigger: 'sp_atk', rationale: 'Perfect for high Sp. Atk Pokémon' },
  { name: 'Choice Scarf', slug: 'choice-scarf', statTrigger: 'speed', rationale: 'Boosts Speed for fast attackers' },
  { name: 'Leftovers', slug: 'leftovers', statTrigger: 'hp', rationale: 'Gradual recovery for bulky Pokémon' },
  { name: 'Black Sludge', slug: 'black-sludge', statTrigger: 'poison', rationale: 'Recovery item for Poison-types' },
  { name: 'Rocky Helmet', slug: 'rocky-helmet', statTrigger: 'defense', rationale: 'Punishes physical attackers' },
  { name: 'Assault Vest', slug: 'assault-vest', statTrigger: 'sp_def', rationale: 'Boosts Sp. Def for specially bulky Pokémon' },
  { name: 'Life Orb', slug: 'life-orb', statTrigger: 'sp_atk', rationale: 'Powers up all moves for strong attackers' },
  { name: 'Focus Sash', slug: 'focus-sash', statTrigger: 'default', rationale: 'Survives a KO hit — great for frail Pokémon' },
  { name: 'Eviolite', slug: 'eviolite', statTrigger: 'pre-evo', rationale: 'Doubles defences on unevolved Pokémon' },
  { name: 'Sitrus Berry', slug: 'sitrus-berry', statTrigger: 'hp', rationale: 'Recovers HP when below 50%' },
  { name: 'Lum Berry', slug: 'lum-berry', statTrigger: 'default', rationale: 'Cures any status condition once' },
  { name: 'Expert Belt', slug: 'expert-belt', statTrigger: 'attack', rationale: 'Bonus damage on super-effective hits' },
  { name: 'Air Balloon', slug: 'air-balloon', statTrigger: 'ground', rationale: 'Grants Ground immunity until popped' },
  { name: 'Power Herb', slug: 'power-herb', statTrigger: 'sp_atk', rationale: 'Lets two-turn moves fire in one turn' },
  { name: 'Toxic Orb', slug: 'toxic-orb', statTrigger: 'hp', rationale: 'Pairs with Poison Heal or Facade strategies' },
  { name: 'Flame Orb', slug: 'flame-orb', statTrigger: 'attack', rationale: 'Pairs with Guts ability for a damage boost' },
  { name: 'Light Clay', slug: 'light-clay', statTrigger: 'sp_def', rationale: 'Extends screens like Reflect and Light Screen' },
  { name: 'Heat Rock', slug: 'heat-rock', statTrigger: 'fire', rationale: 'Extends Sunny Day weather' },
  { name: 'Damp Rock', slug: 'damp-rock', statTrigger: 'water', rationale: 'Extends Rain Dance weather' },
];

function getSuggestedItem(stats, types) {
  if (types.includes('poison')) return ITEMS.find(i => i.slug === 'black-sludge');
  const maxStat = Object.entries(stats).reduce((a, b) => a[1] > b[1] ? a : b);
  const map = {
    attack: 'choice-band',
    sp_atk: 'choice-specs',
    speed: 'choice-scarf',
    hp: 'leftovers',
    defense: 'rocky-helmet',
    sp_def: 'assault-vest',
  };
  const slug = map[maxStat[0]] || 'focus-sash';
  return ITEMS.find(i => i.slug === slug) || ITEMS.find(i => i.slug === 'focus-sash');
}

// --- Type Colours & Display ---
const TYPE_COLORS = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0',
  electric: '#F8D030', grass: '#78C850', ice: '#98D8D8',
  fighting: '#C03028', poison: '#A040A0', ground: '#E0C068',
  flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8',
  dark: '#705848', steel: '#B8B8D0', fairy: '#EE99AC'
};

const TYPE_ICONS = {
  normal: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/normal.svg',
  fire: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/fire.svg',
  water: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/water.svg',
  electric: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/electric.svg',
  grass: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/grass.svg',
  ice: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/ice.svg',
  fighting: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/fighting.svg',
  poison: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/poison.svg',
  ground: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/ground.svg',
  flying: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/flying.svg',
  psychic: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/psychic.svg',
  bug: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/bug.svg',
  rock: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/rock.svg',
  ghost: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/ghost.svg',
  dragon: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/dragon.svg',
  dark: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/dark.svg',
  steel: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/steel.svg',
  fairy: 'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/fairy.svg'
};

const TYPE_EXAMPLES = {
  normal: [{ name: 'Pidgeot', id: 18 }, { name: 'Snorlax', id: 143 }, { name: 'Blissey', id: 242 }, { name: 'Ursaluna', id: 901 }],
  fire: [{ name: 'Charizard', id: 6 }, { name: 'Arcanine', id: 59 }, { name: 'Blaziken', id: 257 }, { name: 'Volcarona', id: 637 }],
  water: [{ name: 'Blastoise', id: 9 }, { name: 'Gyarados', id: 130 }, { name: 'Lapras', id: 131 }, { name: 'Greninja', id: 658 }],
  electric: [{ name: 'Pikachu', id: 25 }, { name: 'Jolteon', id: 135 }, { name: 'Magnezone', id: 462 }, { name: 'Zapdos', id: 145 }],
  grass: [{ name: 'Venusaur', id: 3 }, { name: 'Roserade', id: 407 }, { name: 'Decidueye', id: 724 }, { name: 'Meowscarada', id: 914 }],
  ice: [{ name: 'Lapras', id: 131 }, { name: 'Weavile', id: 461 }, { name: 'Mamoswine', id: 473 }, { name: 'Glaceon', id: 471 }],
  fighting: [{ name: 'Machamp', id: 68 }, { name: 'Lucario', id: 448 }, { name: 'Infernape', id: 392 }, { name: 'Annihilape', id: 979 }],
  poison: [{ name: 'Gengar', id: 94 }, { name: 'Toxapex', id: 748 }, { name: 'Nidoking', id: 34 }, { name: 'Clodsire', id: 980 }],
  ground: [{ name: 'Dugtrio', id: 51 }, { name: 'Garchomp', id: 445 }, { name: 'Excadrill', id: 530 }, { name: 'Great Tusk', id: 984 }],
  flying: [{ name: 'Talonflame', id: 663 }, { name: 'Corviknight', id: 823 }, { name: 'Dragonite', id: 149 }, { name: 'Aerodactyl', id: 142 }],
  psychic: [{ name: 'Alakazam', id: 65 }, { name: 'Gardevoir', id: 282 }, { name: 'Metagross', id: 376 }, { name: 'Espathra', id: 956 }],
  bug: [{ name: 'Scizor', id: 212 }, { name: 'Scolipede', id: 545 }, { name: 'Kleavor', id: 900 }, { name: 'Vikavolt', id: 738 }],
  rock: [{ name: 'Tyranitar', id: 248 }, { name: 'Gigalith', id: 526 }, { name: 'Lycanroc', id: 745 }, { name: 'Garganacl', id: 946 }],
  ghost: [{ name: 'Mimikyu', id: 778 }, { name: 'Dragapult', id: 887 }, { name: 'Ceruledge', id: 937 }, { name: 'Gholdengo', id: 1000 }],
  dragon: [{ name: 'Salamence', id: 373 }, { name: 'Haxorus', id: 612 }, { name: 'Baxcalibur', id: 998 }, { name: 'Roaring Moon', id: 1005 }],
  dark: [{ name: 'Umbreon', id: 197 }, { name: 'Tyranitar', id: 248 }, { name: 'Bisharp', id: 625 }, { name: 'Kingambit', id: 983 }],
  steel: [{ name: 'Skarmory', id: 227 }, { name: 'Scizor', id: 212 }, { name: 'Corviknight', id: 823 }, { name: 'Iron Treads', id: 990 }],
  fairy: [{ name: 'Clefable', id: 36 }, { name: 'Togekiss', id: 468 }, { name: 'Sylveon', id: 700 }, { name: 'Tinkaton', id: 959 }]
};

function typeBadge(type) {
  const color = TYPE_COLORS[type] || '#888';
  const iconUrl = TYPE_ICONS[type];
  const displayName = type.toUpperCase();
  return `
    <span class="type-badge" data-type="${type}" style="--type-color: ${color}">
      <span class="badge-icon-part">
        <img src="${iconUrl}" alt="${type}">
      </span>
      <span class="badge-text-part">${displayName}</span>
    </span>`;
}

// --- Pokémon Name List (Gen 1–9, first ~1025) loaded lazily ---
// We'll fetch the full list from PokéAPI once on app boot and cache it.
let POKEMON_NAME_LIST = [];

async function loadPokemonNameList() {
  if (POKEMON_NAME_LIST.length > 0) return;
  try {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025&offset=0');
    const data = await res.json();
    POKEMON_NAME_LIST = data.results.map(p => p.name);
  } catch (e) {
    console.warn('Could not load Pokémon name list:', e);
  }
}

// Fetch full Pokémon data from PokéAPI (cached in sessionStorage)
async function fetchPokemon(nameOrId) {
  const key = `pkmn_${nameOrId}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* ignore storage read error */ }

  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${nameOrId}`);
  if (!res.ok) throw new Error(`Pokémon "${nameOrId}" not found`);
  const data = await res.json();

  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    // Silently continue if storage is full
  }

  return data;
}

// Extract clean stat object from PokéAPI stats array
function parseStats(apiStats) {
  const map = {
    'hp': 'hp', 'attack': 'attack', 'defense': 'defense',
    'special-attack': 'sp_atk', 'special-defense': 'sp_def', 'speed': 'speed'
  };
  const out = {};
  apiStats.forEach(s => {
    const key = map[s.stat.name];
    if (key) out[key] = s.base_stat;
  });
  return out;
}

// Extract type names array from PokéAPI types array
function parseTypes(apiTypes) {
  return apiTypes.map(t => t.type.name);
}

// Sprite URL helpers
function spriteUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}
function artworkUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}
function itemIconUrl(slug) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
}
