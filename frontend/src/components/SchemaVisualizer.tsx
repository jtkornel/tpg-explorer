import React, { useState, useEffect, useCallback } from 'react';
import { Layers, RefreshCw, AlertCircle, Tag, GitCommit, Database, Hash } from 'lucide-react';
import { apiClient } from '../apiClient';
import type { SchemaResponse } from '../types';

interface SchemaVisualizerProps {
  onSelectLabel?: (label: string) => void;
  onSelectType?: (relType: string) => void;
}

type SelectedItem = { kind: 'label' | 'relationship'; name: string };

function SchemaCard({
  name,
  selected,
  onClick,
  testId,
}: {
  name: string;
  selected: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <div
      className={`schema-card${selected ? ' selected' : ''}`}
      onClick={onClick}
      data-testid={testId}
    >
      <div className="card-top">
        <span className="schema-name">{name}</span>
      </div>
    </div>
  );
}

function SchemaColumn({
  icon,
  title,
  count,
  items,
  emptyMessage,
  selectedName,
  onSelect,
  testIdPrefix,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  items: string[];
  emptyMessage: string;
  selectedName: string | null;
  onSelect: (name: string) => void;
  testIdPrefix: string;
}) {
  return (
    <section className="schema-column" data-testid={`${testIdPrefix}-column`}>
      <div className="schema-column-header">
        {icon}
        <h3>{title} ({count})</h3>
      </div>
      <div className="schema-items-list">
        {items.length === 0 ? (
          <span className="text-muted">{emptyMessage}</span>
        ) : (
          items.map((name) => (
            <SchemaCard
              key={name}
              name={name}
              selected={selectedName === name}
              onClick={() => onSelect(name)}
              testId={`${testIdPrefix}-${name}`}
            />
          ))
        )}
      </div>
    </section>
  );
}

export const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({
  onSelectLabel,
  onSelectType,
}) => {
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  const fetchSchema = useCallback(() => {
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
  }, []);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

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

  const propCount = Object.keys(schema.property_keys || {}).length;

  const handleSelectLabel = (label: string) => {
    setSelectedItem({ kind: 'label', name: label });
    onSelectLabel?.(label);
  };

  const handleSelectType = (type: string) => {
    setSelectedItem({ kind: 'relationship', name: type });
    onSelectType?.(type);
  };

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
            {propCount} Property Keys
          </span>
          <button className="schema-refresh-btn" onClick={fetchSchema} title="Refresh schema">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="schema-grid-layout">
        <SchemaColumn
          icon={<Tag size={16} />}
          title="Node Labels"
          count={schema.labels.length}
          items={schema.labels}
          emptyMessage="No labels defined."
          selectedName={selectedItem?.kind === 'label' ? selectedItem.name : null}
          onSelect={handleSelectLabel}
          testIdPrefix="schema-label"
        />

        <SchemaColumn
          icon={<GitCommit size={16} />}
          title="Relationship Types"
          count={schema.relationship_types.length}
          items={schema.relationship_types}
          emptyMessage="No relationship types defined."
          selectedName={selectedItem?.kind === 'relationship' ? selectedItem.name : null}
          onSelect={handleSelectType}
          testIdPrefix="schema-rel"
        />

        {/* Property Keys Column */}
        <section className="schema-column" data-testid="schema-props-column">
          <div className="schema-column-header">
            <Hash size={16} />
            <h3>Properties ({propCount})</h3>
          </div>
          <div className="schema-items-list">
            {propCount === 0 ? (
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
