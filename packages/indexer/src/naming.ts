/**
 * Naming convention conversions between MUD Postgres (snake_case)
 * and MUD client (PascalCase tables, camelCase fields).
 *
 * MUD's syncToPostgres uses `snakeCase()` from change-case for both
 * table names and column names. We need to reverse this for the client.
 */

/** Convert snake_case to camelCase: "agi_modifier" → "agiModifier" */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** Convert camelCase to snake_case: "agiModifier" → "agi_modifier" */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

/** Convert snake_case to PascalCase: "armor_stats" → "ArmorStats" */
export function snakeToPascal(str: string): string {
  const camel = snakeToCamel(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Convert a Postgres row's keys from snake_case to camelCase,
 * strip internal metadata columns, and serialize values.
 */
export function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    // Skip MUD internal columns
    if (k === '__key_bytes' || k === '__last_updated_block_number') continue;
    result[snakeToCamel(k)] = serializeValue(v);
  }
  return result;
}

/** Extract __key_bytes from a row and convert to hex string */
export function extractKeyBytes(row: Record<string, unknown>): string {
  const rawKey = row.__key_bytes;
  if (rawKey instanceof Uint8Array || Buffer.isBuffer(rawKey)) {
    return '0x' + Buffer.from(rawKey).toString('hex');
  }
  return String(rawKey || '');
}

/** Serialize a single value for JSON transport */
export function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) {
    return '0x' + Buffer.from(v).toString('hex');
  }
  if (typeof v === 'bigint') {
    return v.toString();
  }
  if (Array.isArray(v)) {
    return v.map(serializeValue);
  }
  return v;
}

/**
 * MUD resource IDs truncate names to 16 bytes. This map restores
 * truncated PascalCase names to their full versions.
 *
 * Only tables with names > 16 chars need entries here.
 */
const TRUNCATED_NAME_MAP: Record<string, string> = {
  CharacterEquipme: 'CharacterEquipment',
  StatusEffectStat: 'StatusEffectStats',
  StatusEffectTarg: 'StatusEffectTargeting',
  StatusEffectVali: 'StatusEffectValidity',
  WorldStatusEffec: 'WorldStatusEffects',
  EntitiesAtPositi: 'EntitiesAtPosition',
  UltimateDominion: 'UltimateDominionConfig',
  DamageOverTimeAp: 'DamageOverTimeApplied',
  AllowedGameSyste: 'AllowedGameSystems',
  GasStationCooldo: 'GasStationCooldown',
  CharacterFirstAc: 'CharacterFirstActions',
  CharacterZoneCom: 'CharacterZoneCompletion',
  StarterConsumabl: 'StarterConsumables',
  AdvancedClassIte: 'AdvancedClassItems',
  ArmorStarterItem: 'ArmorStarterItems',
  PhysicalDamageSt: 'PhysicalDamageStats',
};

/** Convert a Postgres table logical name (snake_case) to the full PascalCase MUD name */
export function pgNameToMudName(pgLogical: string): string {
  const pascal = snakeToPascal(pgLogical);
  return TRUNCATED_NAME_MAP[pascal] || pascal;
}

/**
 * Resolve a resource ID name (PascalCase, possibly truncated to 16 chars)
 * to the full PascalCase MUD table name.
 */
export function resolveResourceName(resourceName: string): string {
  return TRUNCATED_NAME_MAP[resourceName] || resourceName;
}

/**
 * Known abbreviation corrections for PascalCase conversion.
 * MUD uses specific casing for abbreviations (e.g., "TokenURI" not "TokenUri").
 */
const ABBREVIATION_FIXES: Record<string, string> = {
  Uri: 'URI',
  Nft: 'NFT',
  Erc20: 'ERC20',
  Erc721: 'ERC721',
  Erc1155: 'ERC1155',
};

/** Apply known abbreviation fixes to a PascalCase name */
export function fixAbbreviations(name: string): string {
  let result = name;
  for (const [wrong, correct] of Object.entries(ABBREVIATION_FIXES)) {
    result = result.replace(new RegExp(wrong, 'g'), correct);
  }
  return result;
}
