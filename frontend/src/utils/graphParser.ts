export interface GraphNode {
  id: string;
  label: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface GraphElements {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface RawEdge {
  id?: string;
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
}

interface RawNode {
  id: string;
  labels?: string[];
  properties?: Record<string, unknown>;
}

type CellKind = { kind: 'edge'; data: RawEdge } | { kind: 'node'; data: RawNode } | { kind: 'skip' };

function classifyCell(val: unknown): CellKind {
  if (!val || typeof val !== 'object') return { kind: 'skip' };
  const obj = val as Record<string, unknown>;

  if (typeof obj.source === 'string' && typeof obj.target === 'string' && typeof obj.type === 'string') {
    return { kind: 'edge', data: obj as unknown as RawEdge };
  }

  if (typeof obj.id === 'string' && (Array.isArray(obj.labels) || 'properties' in obj)) {
    return { kind: 'node', data: obj as unknown as RawNode };
  }

  return { kind: 'skip' };
}

function makePlaceholderNode(id: string): GraphNode {
  return { id, label: id, labels: [], properties: {} };
}

function makeGraphNode(raw: RawNode): GraphNode {
  const labels = Array.isArray(raw.labels) ? raw.labels : [];
  const properties = raw.properties && typeof raw.properties === 'object' ? raw.properties : {};
  const labelText = labels.length > 0 ? `:${labels.join(':')}` : raw.id;
  return { id: raw.id, label: labelText, labels, properties };
}

function makeGraphEdge(raw: RawEdge): GraphEdge {
  return {
    id: raw.id || `${raw.source}->${raw.type}->${raw.target}`,
    source: raw.source,
    target: raw.target,
    type: raw.type,
    properties: raw.properties && typeof raw.properties === 'object' ? raw.properties : {},
  };
}

function upsertNode(nodeMap: Map<string, GraphNode>, raw: RawNode): void {
  const existing = nodeMap.get(raw.id);
  if (!existing) {
    nodeMap.set(raw.id, makeGraphNode(raw));
    return;
  }
  const labels = Array.isArray(raw.labels) ? raw.labels : [];
  if (existing.labels.length === 0 && labels.length > 0) {
    nodeMap.set(raw.id, {
      ...makeGraphNode(raw),
      properties: { ...existing.properties, ...(raw.properties ?? {}) },
    });
  }
}

export function extractGraphElements(rows: unknown[][]): GraphElements {
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();

  for (const row of rows) {
    for (const cell of row) {
      const classified = classifyCell(cell);
      switch (classified.kind) {
        case 'skip':
          break;

        case 'edge': {
          const edge = makeGraphEdge(classified.data);
          if (!edgeMap.has(edge.id)) {
            edgeMap.set(edge.id, edge);
          }
          if (!nodeMap.has(classified.data.source)) {
            nodeMap.set(classified.data.source, makePlaceholderNode(classified.data.source));
          }
          if (!nodeMap.has(classified.data.target)) {
            nodeMap.set(classified.data.target, makePlaceholderNode(classified.data.target));
          }
          break;
        }

        case 'node':
          upsertNode(nodeMap, classified.data);
          break;
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}
