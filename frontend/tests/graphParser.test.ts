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
      label: 'The Matrix\n(:Movie)',
      labels: ['Movie'],
      properties: { title: 'The Matrix', released: 1999 },
    });

    expect(result.nodes[1]).toEqual({
      id: 'node-2',
      label: 'Keanu Reeves\n(:Person:Actor)',
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

  it('extracts nodes and edges with numeric ids returned by Traverse', () => {
    const nodeA = { _type: 'node', id: 0, labels: ['Algorithm'], properties: { name: 'Fit' } };
    const edge = { _type: 'edge', id: 10, source: 0, target: 367, type: 'EXPRESSED_BY', properties: {} };
    const nodeB = { _type: 'node', id: 367, labels: ['Equation'], properties: { name: 'OLS' } };

    const rows = [[nodeA, edge, nodeB]];

    const result = extractGraphElements(rows);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.nodes[0].id).toBe('0');
    expect(result.nodes[0].label).toBe('Fit\n(:Algorithm)');
    expect(result.nodes[1].id).toBe('367');
    expect(result.nodes[1].label).toBe('OLS\n(:Equation)');
    expect(result.edges[0].id).toBe('10');
    expect(result.edges[0].source).toBe('0');
    expect(result.edges[0].target).toBe('367');
  });
});
