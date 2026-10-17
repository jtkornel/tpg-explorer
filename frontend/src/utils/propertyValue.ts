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
