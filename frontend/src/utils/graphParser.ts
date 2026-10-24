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
  id?: string | number;
  source: string | number;
  target: string | number;
  type: string;
  properties?: Record<string, unknown>;
}

interface RawNode {
  id: string | number;
  labels?: string[];
  properties?: Record<string, unknown>;
}

type CellKind = { kind: 'edge'; data: RawEdge } | { kind: 'node'; data: RawNode } | { kind: 'skip' };

function classifyCell(val: unknown): CellKind {
  if (!val || typeof val !== 'object') return { kind: 'skip' };
  const obj = val as Record<string, unknown>;

  if (
    (typeof obj.source === 'string' || typeof obj.source === 'number') &&
    (typeof obj.target === 'string' || typeof obj.target === 'number') &&
    typeof obj.type === 'string'
  ) {
    return { kind: 'edge', data: obj as unknown as RawEdge };
  }

  if (
    (typeof obj.id === 'string' || typeof obj.id === 'number') &&
    (Array.isArray(obj.labels) || 'properties' in obj || obj._type === 'node')
  ) {
    return { kind: 'node', data: obj as unknown as RawNode };
  }

  return { kind: 'skip' };
}

function makePlaceholderNode(id: string): GraphNode {
  return { id, label: id, labels: [], properties: {} };
}

function makeGraphNode(raw: RawNode): GraphNode {
  const idStr = String(raw.id);
  const labels = Array.isArray(raw.labels) ? raw.labels : [];
  const properties = raw.properties && typeof raw.properties === 'object' ? raw.properties : {};

  // Find most descriptive name: explicit name/title, or reference/label/id
  const rawName =
    properties.name ??
    properties.title ??
    (properties.kind === 'entity' ? properties.ref : undefined) ??
    properties.ref ??
    (properties.label && properties.label !== '' ? properties.label : undefined);
  const nameStr = rawName != null ? String(rawName).trim() : '';

  let labelText: string;
  if (nameStr && labels.length > 0) {
    labelText = `${nameStr}\n(:${labels.join(':')})`;
  } else if (nameStr) {
    labelText = nameStr;
  } else if (labels.length > 0) {
    labelText = `:${labels.join(':')}`;
  } else {
    labelText = idStr;
  }

  return { id: idStr, label: labelText, labels, properties };
}

function makeGraphEdge(raw: RawEdge): GraphEdge {
  const sourceStr = String(raw.source);
  const targetStr = String(raw.target);
  const edgeId = raw.id != null ? String(raw.id) : `${sourceStr}->${raw.type}->${targetStr}`;
  const properties = raw.properties && typeof raw.properties === 'object' ? raw.properties : {};
  return {
    id: edgeId,
    source: sourceStr,
    target: targetStr,
    type: raw.type,
    properties,
  };
}

function upsertNode(nodeMap: Map<string, GraphNode>, raw: RawNode): void {
  const idStr = String(raw.id);
  const existing = nodeMap.get(idStr);
  if (!existing) {
    nodeMap.set(idStr, makeGraphNode(raw));
    return;
  }
  const labels = Array.isArray(raw.labels) ? raw.labels : [];
  if (existing.labels.length === 0 && labels.length > 0) {
    nodeMap.set(idStr, {
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
          const src = String(classified.data.source);
          const tgt = String(classified.data.target);
          if (!nodeMap.has(src)) {
            nodeMap.set(src, makePlaceholderNode(src));
          }
          if (!nodeMap.has(tgt)) {
            nodeMap.set(tgt, makePlaceholderNode(tgt));
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
