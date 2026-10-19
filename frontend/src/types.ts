export interface QueryRequest {
  query: string;
  dialect: 'gql' | 'cypher';
  database?: string;
  parameters?: Record<string, unknown>;
}

export interface QueryResponse {
  columns: string[];
  rows: unknown[][];
  total_rows: number;
  truncated: boolean;
  time_ms: number;
}

export interface SchemaResponse {
  labels: string[];
  relationship_types: string[];
  property_keys: Record<string, string>;
  patterns?: { from_label: string; type: string; to_label: string }[];
}

export interface PropertyValue {
  value: unknown;
  type: 'string' | 'integer' | 'float' | 'boolean' | 'null' | 'list' | 'map' | 'unknown';
  truncated: boolean;
  original_length?: number;
}

export interface NodeSummary {
  id: string;
  labels: string[];
  summary_properties: Record<string, PropertyValue>;
}

export interface NodeDetail {
  id: string;
  labels: string[];
  properties: Record<string, PropertyValue>;
  relations_summary: {
    incoming: Record<string, number>;
    outgoing: Record<string, number>;
  };
}

export interface RelationItem {
  relation_properties: Record<string, PropertyValue>;
  node: NodeSummary;
}

export interface RelatedNodesResponse {
  relation_type: string;
  direction: 'incoming' | 'outgoing';
  items: RelationItem[];
  total: number;
}
