// 4) Normalization utilities (shared, pure)

export type Finish = 'nonfoil' | 'foil' | 'etched';
export type Lang = 'EN' | 'DE' | 'FR' | 'IT' | 'ES' | 'JA' | 'KO' | 'PT' | 'RU' | 'ZH' | 'HE' | 'LA' | 'GR' | 'AR' | 'UNKNOWN';

export interface NormalizedKey {
  cardId?: string;
  setCode: string;
  number: string;   // keep suffix like '123a'
  lang: Lang;
  finish: Finish;
  fingerprint: string; // `${setCode}:${number}:${lang}:${finish}` or name fallback
}

// Alias maps for set codes, finishes, language variants
const SET_CODE_ALIASES: Record<string, string> = {
  // Add known aliases here as needed
};

const FINISH_ALIASES: Record<string, Finish> = {
  'foil': 'foil',
  'non-foil': 'nonfoil',
  'nonfoil': 'nonfoil',
  'etched': 'etched',
  'etched foil': 'etched',
};

const LANGUAGE_ALIASES: Record<string, Lang> = {
  'english': 'EN',
  'german': 'DE',
  'french': 'FR',
  'italian': 'IT',
  'spanish': 'ES',
  'japanese': 'JA',
  'korean': 'KO',
  'portuguese': 'PT',
  'russian': 'RU',
  'chinese': 'ZH',
  'hebrew': 'HE',
  'latin': 'LA',
  'greek': 'GR',
  'arabic': 'AR',
};

export function normalizeFingerprint(input: {
  cardId?: string; 
  setCode?: string; 
  number?: string; 
  name?: string;
  lang?: string; 
  finish?: string | boolean;
}): NormalizedKey {
  // 1) normalize setCode using alias map
  let setCode = input.setCode || '';
  if (setCode && SET_CODE_ALIASES[setCode.toLowerCase()]) {
    setCode = SET_CODE_ALIASES[setCode.toLowerCase()];
  }

  // 2) normalize number: trim, lower, keep letter suffix; drop '/360' style denominator
  let number = (input.number || '').trim().toLowerCase();
  // Remove denominator like "/360" but keep letter suffixes like "123a"
  number = number.replace(/\/\d+$/, '');

  // 3) normalize lang to Lang union
  let lang: Lang = 'EN'; // default
  if (input.lang) {
    const normalizedLang = input.lang.trim().toUpperCase();
    if (LANGUAGE_ALIASES[normalizedLang]) {
      lang = LANGUAGE_ALIASES[normalizedLang];
    } else if (Object.values(LANGUAGE_ALIASES).includes(normalizedLang as Lang)) {
      lang = normalizedLang as Lang;
    }
  }

  // 4) normalize finish (foil boolean -> 'foil', strings -> 'nonfoil'|'foil'|'etched')
  let finish: Finish = 'nonfoil'; // default
  if (input.finish !== undefined) {
    if (typeof input.finish === 'boolean') {
      finish = input.finish ? 'foil' : 'nonfoil';
    } else {
      const normalizedFinish = input.finish.trim().toLowerCase();
      if (FINISH_ALIASES[normalizedFinish]) {
        finish = FINISH_ALIASES[normalizedFinish];
      } else if (Object.values(FINISH_ALIASES).includes(normalizedFinish as Finish)) {
        finish = normalizedFinish as Finish;
      }
    }
  }

  // 5) build fingerprint (prefer set/number-based; fallback to name)
  let fingerprint: string;
  if (setCode && number) {
    fingerprint = `${setCode}:${number}:${lang}:${finish}`;
  } else if (input.name) {
    fingerprint = `name:${input.name.toLowerCase().replace(/\s+/g, '-')}:${lang}:${finish}`;
  } else {
    fingerprint = `unknown:${Date.now()}:${lang}:${finish}`;
  }

  return {
    cardId: input.cardId,
    setCode,
    number,
    lang,
    finish,
    fingerprint
  };
}