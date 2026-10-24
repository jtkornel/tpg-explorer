import { describe, it, expect } from 'vitest';
import { formatPropertyValue, unwrapPropertyValue, sortPropertyEntries } from '../src/utils/propertyValue';
import type { PropertyValue } from '../src/types';

describe('formatPropertyValue', () => {
  it('formats null', () => {
    const pv: PropertyValue = { value: null, type: 'null', truncated: false };
    expect(formatPropertyValue(pv)).toBe('null');
  });

  it('formats booleans', () => {
    expect(formatPropertyValue({ value: true, type: 'boolean', truncated: false })).toBe('true');
    expect(formatPropertyValue({ value: false, type: 'boolean', truncated: false })).toBe('false');
  });

  it('formats integers and floats', () => {
    expect(formatPropertyValue({ value: 42, type: 'integer', truncated: false })).toBe('42');
    expect(formatPropertyValue({ value: 3.14, type: 'float', truncated: false })).toBe('3.14');
  });

  it('formats plain strings', () => {
    const pv: PropertyValue = { value: 'hello', type: 'string', truncated: false };
    expect(formatPropertyValue(pv)).toBe('hello');
  });

  it('formats truncated strings with original length', () => {
    const pv: PropertyValue = {
      value: 'hello world…',
      type: 'string',
      truncated: true,
      original_length: 500,
    };
    expect(formatPropertyValue(pv)).toBe('hello world… … (500 chars)');
  });

  it('formats lists as type/length descriptors', () => {
    const pv: PropertyValue = {
      value: { _type: 'list', length: 5 },
      type: 'list',
      truncated: false,
      original_length: 5,
    };
    expect(formatPropertyValue(pv)).toBe('[list, 5 items]');
  });

  it('formats maps as key descriptors', () => {
    const pv: PropertyValue = {
      value: { _type: 'map', keys: ['a', 'b'] },
      type: 'map',
      truncated: false,
      original_length: 2,
    };
    expect(formatPropertyValue(pv)).toBe('{map, keys: a, b}');
  });

  it('falls back to String() for unknown types', () => {
    const pv: PropertyValue = { value: { complex: true }, type: 'unknown', truncated: false };
    expect(formatPropertyValue(pv)).toBe('[object Object]');
  });
});

describe('unwrapPropertyValue', () => {
  it('returns the raw value', () => {
    const pv: PropertyValue = { value: 'hello', type: 'string', truncated: false };
    expect(unwrapPropertyValue(pv)).toBe('hello');
  });

  it('returns null for null values', () => {
    const pv: PropertyValue = { value: null, type: 'null', truncated: false };
    expect(unwrapPropertyValue(pv)).toBeNull();
  });
});

describe('sortPropertyEntries', () => {
  it('places id first, followed by name, other properties, and timestamps last', () => {
    const entries: [string, PropertyValue][] = [
      ['updated_at', { value: '2026-08-14T19:36:55.060000', type: 'string', truncated: false }],
      ['code_hash', { value: 'sha256:abc', type: 'string', truncated: false }],
      ['name', { value: 'Empirical Model', type: 'string', truncated: false }],
      ['created_at', { value: '2026-08-14T19:35:04.143000', type: 'string', truncated: false }],
      ['id', { value: 'mod-1', type: 'string', truncated: false }],
      ['summary', { value: 'A summary', type: 'string', truncated: false }],
      ['status', { value: 'active', type: 'string', truncated: false }],
    ];

    const sortedKeys = sortPropertyEntries(entries).map(([k]) => k);
    expect(sortedKeys).toEqual([
      'id',
      'name',
      'summary',
      'status',
      'code_hash',
      'created_at',
      'updated_at',
    ]);
  });

  it('detects ISO date string values as temporal even if key does not end in _at', () => {
    const entries: [string, PropertyValue][] = [
      ['snapshot', { value: '2026-10-24T10:00:00Z', type: 'string', truncated: false }],
      ['description', { value: 'Description', type: 'string', truncated: false }],
      ['title', { value: 'Main Title', type: 'string', truncated: false }],
    ];

    const sortedKeys = sortPropertyEntries(entries).map(([k]) => k);
    expect(sortedKeys).toEqual(['title', 'description', 'snapshot']);
  });
});
