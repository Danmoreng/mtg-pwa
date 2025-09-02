import db from '../../data/db';

// Types
interface ScryfallSet {
  code: string;
  name: string;
  set_type: string;
  parent_set_code?: string | null;
  released_at?: string;
}

// Normalize helper
const norm = (s: string): string => {
  return s.toLowerCase()
    .normalize("NFKD").replace(/\p{Diacritic}/gu, "")
    .replace(/[\s–—-]+/g, " ")
    .replace(/[:'"]/g, "")
    .trim();
};

// Build index from sets
function buildSetIndex(sets: ScryfallSet[]) {
  const byName = new Map<string, ScryfallSet>();
  for (const st of sets) {
    byName.set(norm(st.name), st);
  }
  return { byName };
}

// Main resolver
export async function resolveSetCode(cardmarketName: string): Promise<string | null> {
  const raw = cardmarketName.trim();
  const n = norm(raw);

  // Load sets from cache or fetch fresh data
  const idx = await getSetIndex();
  
  // Load aliases
  const aliases = await getAliases();

  // Alias first
  const a = aliases.get(n);
  if (a) {
    console.log(`Set code resolved from alias: ${raw} -> ${a}`);
    return a;
  }

  // Exact match
  const exact = idx.byName.get(n);
  if (exact) {
    console.log(`Set code resolved from exact match: ${raw} -> ${exact.code}`);
    // Store alias for future use
    await storeAlias(n, exact.code);
    return exact.code;
  }

  // Handle complex nested cases like "Commander: The Lord of the Rings: Tales of Middle-earth: Extras"
  // Try stripping "Commander:" prefix and ": Extras" suffix
  if (/^commander:\s*/i.test(raw) && /: extras$/i.test(raw)) {
    const baseName = raw.replace(/^commander:\s*/i, "").replace(/: extras$/i, "").trim();
    const tryCmd = idx.byName.get(norm(`${baseName} Commander`));
    if (tryCmd) {
      console.log(`Set code resolved from commander + extras nested: ${raw} -> ${tryCmd.code}`);
      // Store alias for future use
      await storeAlias(n, tryCmd.code);
      return tryCmd.code;
    }
    const tryBase = idx.byName.get(norm(baseName));
    if (tryBase) {
      console.log(`Set code resolved from commander + extras nested (base): ${raw} -> ${tryBase.code}`);
      // Store alias for future use
      await storeAlias(n, tryBase.code);
      return tryBase.code;
    }
  }

  // Handle "Commander:" prefix cases
  if (/^commander:\s*/i.test(raw)) {
    const baseName = raw.replace(/^commander:\s*/i, "").trim();
    const tryCmd = idx.byName.get(norm(`${baseName} Commander`));
    if (tryCmd) {
      console.log(`Set code resolved from commander rewrite (commander): ${raw} -> ${tryCmd.code}`);
      // Store alias for future use
      await storeAlias(n, tryCmd.code);
      return tryCmd.code;
    }
    const tryBase = idx.byName.get(norm(baseName));
    if (tryBase) {
      console.log(`Set code resolved from commander rewrite (base): ${raw} -> ${tryBase.code}`);
      // Store alias for future use
      await storeAlias(n, tryBase.code);
      return tryBase.code;
    }
  }

  // Handle ": Extras" suffix cases
  if (/: extras$/i.test(raw)) {
    const base = norm(raw.replace(/: extras$/i, ""));
    const hit = idx.byName.get(base);
    if (hit) {
      console.log(`Set code resolved from extras suffix: ${raw} -> ${hit.code}`);
      // Store alias for future use
      await storeAlias(n, hit.code);
      return hit.code;
    }
  }

  // Handle "Universes Beyond:" prefix cases
  if (/^universes beyond:\s*/i.test(raw)) {
    const baseName = raw.replace(/^universes beyond:\s*/i, "").trim();
    // Try with "Extras" suffix
    if (/: extras$/i.test(baseName)) {
      const cleanBase = norm(baseName.replace(/: extras$/i, ""));
      const hit = idx.byName.get(cleanBase);
      if (hit) {
        console.log(`Set code resolved from universes beyond + extras: ${raw} -> ${hit.code}`);
        // Store alias for future use
        await storeAlias(n, hit.code);
        return hit.code;
      }
    }
    // Try without "Extras"
    const hit = idx.byName.get(norm(baseName));
    if (hit) {
      console.log(`Set code resolved from universes beyond: ${raw} -> ${hit.code}`);
      // Store alias for future use
      await storeAlias(n, hit.code);
      return hit.code;
    }
  }

  // Handle "Magic: The Gathering -" prefix cases (like FINAL FANTASY sets)
  if (/^magic: the gathering -\s*/i.test(raw)) {
    const baseName = raw.replace(/^magic: the gathering -\s*/i, "").trim();
    // Try with "Extras" suffix
    if (/: extras$/i.test(baseName)) {
      const cleanBase = norm(baseName.replace(/: extras$/i, ""));
      const hit = idx.byName.get(cleanBase);
      if (hit) {
        console.log(`Set code resolved from magic: the gathering - extras: ${raw} -> ${hit.code}`);
        // Store alias for future use
        await storeAlias(n, hit.code);
        return hit.code;
      }
    }
    // Try without "Extras"
    const hit = idx.byName.get(norm(baseName));
    if (hit) {
      console.log(`Set code resolved from magic: the gathering -: ${raw} -> ${hit.code}`);
      // Store alias for future use
      await storeAlias(n, hit.code);
      return hit.code;
    }
  }

  // Handle "Secret Lair Drop Series:" prefix cases
  if (/^secret lair drop series:/i.test(raw)) {
    console.log(`Set code resolved from secret lair: ${raw} -> sld`);
    // Store alias for future use
    await storeAlias(n, "sld");
    return "sld";
  }

  // Special case for "Stellar Sights" - this seems to be missing from Scryfall
  // Let's try to map it to a reasonable fallback or look for similar sets
  if (/^stellar sights$/i.test(raw)) {
    // Try to find similar sets or use a fallback
    // "Stellar Sights" might be a Secret Lair or similar product
    console.log(`Set code resolved from stellar sights fallback: ${raw} -> sld`);
    // Store alias for future use
    await storeAlias(n, "sld");
    return "sld";
  }

  // If we get here, we couldn't resolve the set
  console.log(`Set code unresolved: ${raw}`);
  // This might be a new set, so let's refresh our cache
  await refreshSetCache();
  
  // Try again with fresh data
  const freshIdx = await getSetIndex();
  const freshExact = freshIdx.byName.get(n);
  if (freshExact) {
    console.log(`Set code resolved from fresh exact match: ${raw} -> ${freshExact.code}`);
    return freshExact.code;
  }

  // Still unresolved - store as unresolved and return null
  await storeAlias(n, null);
  return null;
}

// Get set index, loading from cache or fetching fresh data
async function getSetIndex(): Promise<{ byName: Map<string, ScryfallSet> }> {
  try {
    // Check if we have cached data that's less than 7 days old
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const cachedSets = await db.settings.get('scryfall_sets_cache');
    
    if (cachedSets && cachedSets.v && cachedSets.v.fetchedAt > sevenDaysAgo) {
      console.log('Using cached Scryfall sets data');
      return buildSetIndex(cachedSets.v.sets);
    }
    
    // If no cache or old cache, refresh
    console.log('Refreshing Scryfall sets cache (no cache or old cache)');
    return await refreshSetCache();
  } catch (error) {
    console.error('Error in getSetIndex:', error);
    // If we have any error, try to use cached data even if it's old
    try {
      const cachedSets = await db.settings.get('scryfall_sets_cache');
      if (cachedSets && cachedSets.v) {
        console.log('Using old cached Scryfall sets data due to error');
        return buildSetIndex(cachedSets.v.sets);
      }
    } catch (cacheError) {
      console.error('Error accessing cached Scryfall sets data:', cacheError);
    }
    
    // If no cached data, return empty index
    console.log('Returning empty Scryfall sets index');
    return buildSetIndex([]);
  }
}

// Refresh set cache from Scryfall API
async function refreshSetCache(): Promise<{ byName: Map<string, ScryfallSet> }> {
  try {
    console.log('Fetching Scryfall sets data...');
    // Fetch all sets from Scryfall
    const response = await fetch('https://api.scryfall.com/sets');
    if (!response.ok) {
      throw new Error(`Failed to fetch sets: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const sets: ScryfallSet[] = data.data || [];
    
    console.log(`Fetched ${sets.length} Scryfall sets`);
    
    // Cache the data
    await db.settings.put({
      k: 'scryfall_sets_cache',
      v: {
        sets,
        fetchedAt: Date.now()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return buildSetIndex(sets);
  } catch (error) {
    console.error('Error refreshing Scryfall sets cache:', error);
    // If we can't fetch fresh data, try to use cached data even if it's old
    try {
      const cachedSets = await db.settings.get('scryfall_sets_cache');
      if (cachedSets && cachedSets.v) {
        console.log('Using old cached Scryfall sets data due to fetch error');
        return buildSetIndex(cachedSets.v.sets);
      }
    } catch (cacheError) {
      console.error('Error accessing cached Scryfall sets data:', cacheError);
    }
    
    // If no cached data, return empty index
    console.log('Returning empty Scryfall sets index due to errors');
    return buildSetIndex([]);
  }
}

// Get aliases from database
async function getAliases(): Promise<Map<string, string | null>> {
  const aliases = new Map<string, string | null>();
  const storedAliases = await db.settings.get('set_code_aliases');
  
  if (storedAliases && storedAliases.v) {
    for (const [key, value] of Object.entries(storedAliases.v)) {
      aliases.set(key, value as string | null);
    }
  }
  
  return aliases;
}

// Store alias in database
async function storeAlias(alias: string, code: string | null): Promise<void> {
  try {
    const n = norm(alias);
    const storedAliases = await db.settings.get('set_code_aliases');
    let aliases: Record<string, string | null> = {};
    
    if (storedAliases && storedAliases.v) {
      aliases = { ...storedAliases.v } as Record<string, string | null>;
    }
    
    aliases[n] = code;
    
    await db.settings.put({
      k: 'set_code_aliases',
      v: aliases,
      createdAt: storedAliases?.createdAt || new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error storing set code alias:', error);
  }
}