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

function isLikelyEdge(val: unknown): val is { id?: string; source: string; target: string; type: string; properties?: Record<string, unknown> } {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj.source === 'string' &&
    typeof obj.target === 'string' &&
    typeof obj.type === 'string'
  );
}

function isLikelyNode(val: unknown): val is { id: string; labels?: string[]; properties?: Record<string, unknown> } {
  if (!val || typeof val !== 'object') return false;
  // If it's an edge (has source, target, type), it is not a node even if it has an id
  if (isLikelyEdge(val)) return false;
  const obj = val as Record<string, unknown>;
  return typeof obj.id === 'string' && (Array.isArray(obj.labels) || ('properties' in obj));
}

export function extractGraphElements(rows: unknown[][]): GraphElements {
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();

  for (const row of rows) {
    for (const cell of row) {
      if (!cell || typeof cell !== 'object') continue;

      if (isLikelyEdge(cell)) {
        const edgeId = cell.id || `${cell.source}->${cell.type}->${cell.target}`;
        const properties = (cell.properties && typeof cell.properties === 'object') ? cell.properties : {};

        if (!edgeMap.has(edgeId)) {
          edgeMap.set(edgeId, {
            id: edgeId,
            source: cell.source,
            target: cell.target,
            type: cell.type,
            properties,
          });
        }

        // Ensure source and target nodes exist in nodeMap
        if (!nodeMap.has(cell.source)) {
          nodeMap.set(cell.source, {
            id: cell.source,
            label: cell.source,
            labels: [],
            properties: {},
          });
        }
        if (!nodeMap.has(cell.target)) {
          nodeMap.set(cell.target, {
            id: cell.target,
            label: cell.target,
            labels: [],
            properties: {},
          });
        }
      } else if (isLikelyNode(cell)) {
        const id = cell.id;
        const labels = Array.isArray(cell.labels) ? cell.labels : [];
        const properties = (cell.properties && typeof cell.properties === 'object') ? cell.properties : {};
        const labelText = labels.length > 0 ? `:${labels.join(':')}` : id;

        const existing = nodeMap.get(id);
        if (!existing) {
          nodeMap.set(id, {
            id,
            label: labelText,
            labels,
            properties,
          });
        } else if (existing.labels.length === 0 && labels.length > 0) {
          // If implicit node was created earlier without labels, upgrade it with full details
          nodeMap.set(id, {
            id,
            label: labelText,
            labels,
            properties: { ...existing.properties, ...properties },
          });
        }
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}
