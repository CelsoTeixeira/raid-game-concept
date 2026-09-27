import type { Rng } from "./items";

export const REGIONS = ["northmark", "sunreach", "greenhollow", "saltcoast"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  northmark: "Northmark",
  sunreach: "Sunreach",
  greenhollow: "Greenhollow",
  saltcoast: "Saltcoast",
};

export const SEXES = ["male", "female"] as const;
export type Sex = (typeof SEXES)[number];

export const SEX_LABELS: Record<Sex, string> = {
  male: "Male",
  female: "Female",
};

export type CharacterName = {
  given: string;
  surname: string;
};

/** Markov training lists. Keep each list in one sound so the chain stays on-tone. */
const GIVEN_NAMES: Record<Region, Record<Sex, readonly string[]>> = {
  northmark: {
    male: [
      "Torvik", "Haldor", "Bjarn", "Eskil", "Ulfar", "Ragnvald", "Sten", "Grimr", "Hakon", "Leif", "Orvar", "Sigvard",
      "Thrain", "Vidar", "Arnulf", "Brandr", "Egil", "Frode", "Gunnar", "Hallvard", "Ivar", "Ketil", "Olvir", "Rurik",
    ],
    female: [
      "Sigrun", "Brenna", "Astrid", "Freydis", "Gudrun", "Hilde", "Ingrid", "Jorunn", "Kelda", "Liv", "Ragna", "Solveig",
      "Thyra", "Unna", "Vigdis", "Alfhild", "Bodil", "Dagny", "Eira", "Gerd", "Halla", "Runa", "Svala", "Ylva",
    ],
  },
  sunreach: {
    male: [
      "Kadir", "Samir", "Tarik", "Idris", "Zafir", "Rashan", "Hakim", "Nasir", "Jafar", "Amun", "Bashar", "Darim",
      "Karim", "Malik", "Qadim", "Rafiq", "Sahir", "Talib", "Yazan", "Zahir", "Azim", "Harun", "Najib", "Faruq",
    ],
    female: [
      "Azra", "Leyla", "Samira", "Nadira", "Zahra", "Amira", "Farah", "Jamila", "Kalila", "Maysa", "Nasrin", "Rania",
      "Safiya", "Talia", "Yasmin", "Zaida", "Dalia", "Hana", "Inara", "Lina", "Noor", "Soraya", "Zarina", "Amara",
    ],
  },
  greenhollow: {
    male: [
      "Elwyn", "Faelan", "Aerin", "Caelum", "Daelis", "Eamon", "Galen", "Ilian", "Laeron", "Maelor", "Nerion", "Orin",
      "Perrin", "Quillan", "Rowan", "Silvan", "Taliesin", "Varian", "Wynn", "Aldric", "Bran", "Cillian", "Evander",
      "Thalion",
    ],
    female: [
      "Sylwen", "Ariel", "Aelira", "Briallen", "Celyn", "Elowen", "Faye", "Gwendel", "Isolde", "Liriel", "Maelis",
      "Nimue", "Olwen", "Rhiannon", "Seren", "Tamsin", "Viviane", "Wrenna", "Aeris", "Bryony", "Elara", "Linnea",
      "Mirelle", "Niamh",
    ],
  },
  saltcoast: {
    male: [
      "Tavo", "Marro", "Enzo", "Lucan", "Rocco", "Dario", "Nico", "Paolo", "Sandro", "Teo", "Aurelo", "Bastio",
      "Corvo", "Delmar", "Fausto", "Gero", "Ilario", "Lazzo", "Marco", "Oreste", "Pietro", "Renzo", "Silvio", "Vasco",
    ],
    female: [
      "Lisella", "Nerea", "Marisol", "Ondina", "Perla", "Rosalba", "Serena", "Tessa", "Aurela", "Bianca", "Carmela",
      "Delfina", "Estela", "Fiora", "Giada", "Isola", "Lucia", "Marina", "Nella", "Ottavia", "Paola", "Rina",
      "Sabela", "Vela",
    ],
  },
};

const SURNAMES: Record<Region, readonly string[]> = {
  northmark: [
    "Stormhald", "Ironsen", "Frostvik", "Grimholt", "Hallbjorn", "Ravnsen", "Stenmark", "Tordal", "Ulfhelm", "Vargsen",
    "Bjornvik", "Eldgard", "Helmstad", "Kjellberg", "Norrhald", "Rimeholt", "Skarsen", "Thornvald", "Vinterhus",
    "Asgrim",
  ],
  sunreach: [
    "Qasiri", "Sahrani", "Zaharin", "Almeri", "Baharim", "Farsuni", "Hadrani", "Kaziri", "Marabi", "Nahrani", "Oasari",
    "Rimalli", "Suhayri", "Tamrani", "Yazadi", "Zenobar", "Qarafi", "Dunari", "Ishari", "Kalimar",
  ],
  greenhollow: [
    "Ashgrove", "Fennwick", "Mossbrook", "Willowmere", "Thistledown", "Oakhollow", "Briarwood", "Hazelby", "Fernsley",
    "Larkmoor", "Alderwyn", "Rowanfield", "Bramblecote", "Elmsworth", "Greenleaf", "Hollowell", "Meadowsweet",
    "Pinecroft", "Sallowby", "Wrenfield",
  ],
  saltcoast: [
    "Marellen", "Tidaro", "Costaro", "Brenasco", "Delmare", "Fontano", "Gallardi", "Lanzetti", "Maretto", "Navarro",
    "Orsello", "Pescari", "Rivaldo", "Salvetti", "Tessaro", "Vantore", "Zorello", "Corallo", "Bellamar", "Scoglio",
  ],
};

const ORDER = 2;
const START = "^";
const END = "$";
const MIN_LENGTH = 3;
const MAX_LENGTH = 10;
const WORD_TRIES = 40;
const PAIR_TRIES = 200;

type Chain = {
  next: Map<string, string[]>;
  known: Set<string>;
  words: readonly string[];
};

const chains = new WeakMap<readonly string[], Chain>();

function chainFor(words: readonly string[]): Chain {
  const cached = chains.get(words);
  if (cached) return cached;
  const next = new Map<string, string[]>();
  for (const word of words) {
    const padded = START.repeat(ORDER) + word.toLowerCase() + END;
    for (let index = 0; index + ORDER < padded.length; index += 1) {
      const key = padded.slice(index, index + ORDER);
      const options = next.get(key) ?? [];
      options.push(padded[index + ORDER]!);
      next.set(key, options);
    }
  }
  const chain = { next, known: new Set(words.map((word) => word.toLowerCase())), words };
  chains.set(words, chain);
  return chain;
}

function pickOne<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng.next() * items.length)]!;
}

/** One walk; empty when it runs past the length cap. */
function walk(chain: Chain, rng: Rng): string {
  let key = START.repeat(ORDER);
  let out = "";
  while (out.length <= MAX_LENGTH) {
    const options = chain.next.get(key);
    if (!options) return "";
    const letter = pickOne(rng, options);
    if (letter === END) return out;
    out += letter;
    key = (key + letter).slice(-ORDER);
  }
  return "";
}

function isAcceptable(word: string, chain: Chain): boolean {
  return (
    word.length >= MIN_LENGTH &&
    word.length <= MAX_LENGTH &&
    !/(.)\1\1/.test(word) &&
    !chain.known.has(word)
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A new word in the list's sound. Falls back to a training entry if the chain keeps missing. */
export function generateWord(rng: Rng, words: readonly string[]): string {
  const chain = chainFor(words);
  for (let attempt = 0; attempt < WORD_TRIES; attempt += 1) {
    const word = walk(chain, rng);
    if (isAcceptable(word, chain)) return capitalize(word);
  }
  return pickOne(rng, chain.words);
}

export function formatName(name: CharacterName): string {
  return `${name.given} ${name.surname}`;
}

/** Ledger key: the given name + surname pair must never repeat. */
export function nameKey(name: CharacterName): string {
  return formatName(name).toLowerCase();
}

/** Surnames and given names may repeat; the full pair may not. */
export function rollName(options: {
  rng: Rng;
  region: Region;
  sex: Sex;
  takenNames: ReadonlySet<string>;
}): CharacterName {
  const { rng, region, sex, takenNames } = options;
  const givenList = GIVEN_NAMES[region][sex];
  const surnameList = SURNAMES[region];
  const name = { given: generateWord(rng, givenList), surname: generateWord(rng, surnameList) };
  for (let attempt = 0; attempt < PAIR_TRIES; attempt += 1) {
    if (!takenNames.has(nameKey(name))) return name;
    if (attempt % 2 === 0) name.surname = generateWord(rng, surnameList);
    else name.given = generateWord(rng, givenList);
  }
  throw new Error(`No unused ${region} ${sex} name after ${PAIR_TRIES} tries`);
}
