import type { PropertyValue } from '../types';

/**
 * Render a PropertyValue for display.
 *
 * Handles the truncation protocol: strings show an ellipsis marker,
 * lists and maps show a type/length descriptor, and truncated values
 * indicate their original length.
 */
export function formatPropertyValue(pv: PropertyValue): string {
  const { value, type, truncated, original_length } = pv;

  switch (type) {
    case 'null':
      return 'null';
    case 'boolean':
      return value ? 'true' : 'false';
    case 'integer':
    case 'float':
      return String(value);
    case 'string': {
      const suffix = truncated && original_length !== undefined
        ? ` … (${original_length} chars)`
        : '';
      return `${String(value)}${suffix}`;
    }
    case 'list': {
      const len = (value as { length?: number })?.length ?? original_length ?? 0;
      return `[list, ${len} items]`;
    }
    case 'map': {
      const keys = (value as { keys?: string[] })?.keys ?? [];
      return `{map, keys: ${keys.join(', ')}}`;
    }
    default:
      return String(value);
  }
}

/**
 * Extract the raw value from a PropertyValue for use in logic
 * (e.g. passing to a graph parser or search filter).
 */
export function unwrapPropertyValue(pv: PropertyValue): unknown {
  return pv.value;
}

/**
 * Determine a display priority score for a property key/value pair.
 * Lower numbers appear earlier in the list.
 *
 * Ordering tiers:
 * 1. Primary identifiers: 'id' (exact match)
 * 2. Primary descriptive names/titles: 'name', 'title'
 * 3. Core summary & labels: 'label', 'summary', 'description', 'ref'
 * 4. General scalar properties (numbers, booleans, shorter strings)
 * 5. Complex data structures (lists, maps, embeddings)
 * 6. Code / technical provenance hashes and paths ('code_hash', 'code_path', etc.)
 * 7. Temporal & audit timestamps ('created_at', 'updated_at', etc. or ISO timestamp strings)
 */
export function getPropertyPriority(key: string, pv: PropertyValue): number {
  const lowerKey = key.toLowerCase();

  // 1. Primary ID
  if (lowerKey === 'id') return 10;

  // 2. Primary names/titles
  if (lowerKey === 'name' || lowerKey === 'title') return 20;

  // 3. Core summary / descriptors
  if (lowerKey === 'label' || lowerKey === 'ref' || lowerKey === 'symbol' || lowerKey === 'type') return 30;
  if (lowerKey === 'summary' || lowerKey === 'description') return 40;

  // 7. Temporal / timestamps (should come last)
  const isTemporalKey =
    lowerKey.endsWith('_at') ||
    lowerKey.endsWith('_date') ||
    lowerKey.endsWith('_time') ||
    lowerKey === 'created' ||
    lowerKey === 'updated' ||
    lowerKey === 'timestamp';
  if (isTemporalKey) return 900;

  // If string value matches ISO 8601 date/time (e.g., 2026-08-14T19:35:04 or 2026-08-14)
  if (pv.type === 'string' && typeof pv.value === 'string') {
    const isIsoDate = /^\d{4}-\d{2}-\d{2}(T|\b)/.test(pv.value.trim());
    if (isIsoDate) return 910;
  }

  // 6. Technical code metadata / hashes / internals
  if (
    lowerKey.startsWith('code_') ||
    lowerKey.endsWith('_hash') ||
    lowerKey.endsWith('_checksum') ||
    lowerKey === 'embedding' ||
    lowerKey === 'embedder' ||
    lowerKey === 'origin'
  ) {
    return 800;
  }

  // 5. Complex structures (lists, maps)
  if (pv.type === 'list' || pv.type === 'map') return 600;

  // 4. Default scalar properties
  return 100;
}

/**
 * Sort entries of PropertyValue according to display priority:
 * Primary IDs -> Names/Titles -> Descriptive scalars -> Complex objects -> Code/Hashes -> Dates/Timestamps.
 * Ties are broken alphabetically by key name.
 */
export function sortPropertyEntries(
  entries: [string, PropertyValue][]
): [string, PropertyValue][] {
  return [...entries].sort(([keyA, valA], [keyB, valB]) => {
    const prioA = getPropertyPriority(keyA, valA);
    const prioB = getPropertyPriority(keyB, valB);
    if (prioA !== prioB) {
      return prioA - prioB;
    }
    return keyA.localeCompare(keyB);
  });
}
