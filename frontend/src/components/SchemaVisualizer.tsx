import React, { useState, useEffect } from 'react';
import { Layers, RefreshCw, AlertCircle, Tag, GitCommit, Database, Hash } from 'lucide-react';
import { apiClient } from '../apiClient';
import type { SchemaResponse } from '../types';

interface SchemaVisualizerProps {
  onSelectLabel?: (label: string) => void;
  onSelectType?: (relType: string) => void;
}

export const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({
  onSelectLabel,
  onSelectType,
}) => {
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{
    kind: 'label' | 'relationship';
    name: string;
  } | null>(null);

  const fetchSchema = () => {
    setLoading(true);
    setError(null);
    apiClient
      .getSchema()
      .then((data) => {
        setSchema(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load schema.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSchema();
  }, []);

  if (loading) {
    return (
      <div className="schema-container loading-state" data-testid="schema-loading">
        <RefreshCw className="spin" size={24} />
        <span>Loading database schema...</span>
      </div>
    );
  }

  if (error || !schema) {
    return (
      <div className="schema-container error-state" data-testid="schema-error">
        <AlertCircle size={24} className="error-icon" />
        <p>{error || 'No schema data available.'}</p>
        <button className="secondary-button" onClick={fetchSchema}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="schema-visualizer-container" data-testid="schema-visualizer">
      <div className="schema-header">
        <div className="schema-header-title">
          <Database size={20} />
          <h2>Schema & Type Introspection</h2>
        </div>
        <div className="schema-stats">
          <span className="badge" data-testid="label-count-badge">
            {schema.labels.length} Node Labels
          </span>
          <span className="badge" data-testid="rel-count-badge">
            {schema.relationship_types.length} Relationship Types
          </span>
          <span className="badge" data-testid="prop-count-badge">
            {Object.keys(schema.property_keys || {}).length} Property Keys
          </span>
          <button className="schema-refresh-btn" onClick={fetchSchema} title="Refresh schema">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="schema-grid-layout">
        {/* Node Labels Column */}
        <section className="schema-column" data-testid="schema-labels-column">
          <div className="schema-column-header">
            <Tag size={16} />
            <h3>Node Labels ({schema.labels.length})</h3>
          </div>
          <div className="schema-items-list">
            {schema.labels.length === 0 ? (
              <span className="text-muted">No labels defined.</span>
            ) : (
              schema.labels.map((label) => (
                <div
                  key={label}
                  className={`schema-card ${
                    selectedItem?.kind === 'label' && selectedItem.name === label ? 'selected' : ''
                  }`}
                  onClick={() => {
                    setSelectedItem({ kind: 'label', name: label });
                    if (onSelectLabel) onSelectLabel(label);
                  }}
                  data-testid={`schema-label-${label}`}
                >
                  <div className="card-top">
                    <span className="schema-name">{label}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Relationship Types Column */}
        <section className="schema-column" data-testid="schema-rels-column">
          <div className="schema-column-header">
            <GitCommit size={16} />
            <h3>Relationship Types ({schema.relationship_types.length})</h3>
          </div>
          <div className="schema-items-list">
            {schema.relationship_types.length === 0 ? (
              <span className="text-muted">No relationship types defined.</span>
            ) : (
              schema.relationship_types.map((type) => (
                <div
                  key={type}
                  className={`schema-card ${
                    selectedItem?.kind === 'relationship' && selectedItem.name === type ? 'selected' : ''
                  }`}
                  onClick={() => {
                    setSelectedItem({ kind: 'relationship', name: type });
                    if (onSelectType) onSelectType(type);
                  }}
                  data-testid={`schema-rel-${type}`}
                >
                  <div className="card-top">
                    <span className="schema-name">{type}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Property Keys Column */}
        <section className="schema-column" data-testid="schema-props-column">
          <div className="schema-column-header">
            <Hash size={16} />
            <h3>Properties ({Object.keys(schema.property_keys || {}).length})</h3>
          </div>
          <div className="schema-items-list">
            {Object.keys(schema.property_keys || {}).length === 0 ? (
              <span className="text-muted">No properties cataloged.</span>
            ) : (
              Object.entries(schema.property_keys).map(([propKey, propType]) => (
                <div key={propKey} className="schema-prop-card" data-testid={`schema-prop-${propKey}`}>
                  <span className="prop-name">{propKey}</span>
                  <span className="prop-type-tag">{propType}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Relationship Patterns / Connections Section if present */}
      {schema.patterns && schema.patterns.length > 0 && (
        <div className="schema-patterns-section" data-testid="schema-patterns-section">
          <h3>
            <Layers size={16} />
            Observed Connection Patterns
          </h3>
          <div className="patterns-flow-list">
            {schema.patterns.map((p, idx) => (
              <div key={`${p.from_label}-${p.type}-${p.to_label}-${idx}`} className="pattern-badge">
                <span className="pattern-node">{p.from_label}</span>
                <span className="pattern-arrow">─[{p.type}]─▶</span>
                <span className="pattern-node">{p.to_label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
