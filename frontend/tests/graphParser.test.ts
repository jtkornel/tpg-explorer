import { describe, it, expect } from 'vitest';
import { extractGraphElements } from '../src/utils/graphParser';

describe('extractGraphElements', () => {
  it('extracts nodes from query rows with labels and properties', () => {
    const rows = [
      [
        {
          id: 'node-1',
          labels: ['Movie'],
          properties: { title: 'The Matrix', released: 1999 },
        },
        {
          id: 'node-2',
          labels: ['Person', 'Actor'],
          properties: { name: 'Keanu Reeves' },
        },
      ],
    ];

    const result = extractGraphElements(rows);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(0);

    expect(result.nodes[0]).toEqual({
      id: 'node-1',
      label: ':Movie',
      labels: ['Movie'],
      properties: { title: 'The Matrix', released: 1999 },
    });

    expect(result.nodes[1]).toEqual({
      id: 'node-2',
      label: ':Person:Actor',
      labels: ['Person', 'Actor'],
      properties: { name: 'Keanu Reeves' },
    });
  });

  it('extracts edges and creates endpoints if not already in nodes', () => {
    const rows = [
      [
        {
          id: 'rel-1',
          source: 'actor-1',
          target: 'movie-1',
          type: 'ACTED_IN',
          properties: { roles: ['Neo'] },
        },
      ],
    ];

    const result = extractGraphElements(rows);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toEqual({
      id: 'rel-1',
      source: 'actor-1',
      target: 'movie-1',
      type: 'ACTED_IN',
      properties: { roles: ['Neo'] },
    });

    // Implicit nodes should be generated for endpoints
    expect(result.nodes).toHaveLength(2);
    const nodeIds = result.nodes.map((n) => n.id);
    expect(nodeIds).toContain('actor-1');
    expect(nodeIds).toContain('movie-1');
  });

  it('deduplicates nodes and edges across multiple rows', () => {
    const nodeA = { id: 'a', labels: ['User'], properties: { name: 'Alice' } };
    const nodeB = { id: 'b', labels: ['User'], properties: { name: 'Bob' } };
    const edge = { id: 'e1', source: 'a', target: 'b', type: 'FRIENDS', properties: {} };

    const rows = [
      [nodeA, edge, nodeB],
      [nodeA, edge, nodeB],
    ];

    const result = extractGraphElements(rows);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('handles scalar values gracefully without errors', () => {
    const rows = [
      ['Scalar string', 1234, true, null, undefined],
    ];

    const result = extractGraphElements(rows);

    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});
