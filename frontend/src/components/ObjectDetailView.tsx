import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Layers, Tag, ExternalLink, RefreshCw, AlertCircle, GitCommit } from 'lucide-react';
import { apiClient } from '../apiClient';
import { formatPropertyValue, sortPropertyEntries } from '../utils/propertyValue';
import type { NodeDetail, RelatedNodesResponse } from '../types';

interface ObjectDetailViewProps {
  nodeId: string;
  onNavigateNode: (targetNodeId: string) => void;
  onClose?: () => void;
}

export const ObjectDetailView: React.FC<ObjectDetailViewProps> = ({
  nodeId,
  onNavigateNode,
  onClose,
}) => {
  const [nodeDetail, setNodeDetail] = useState<NodeDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active relation selection
  const [selectedRelation, setSelectedRelation] = useState<{
    type: string;
    direction: 'incoming' | 'outgoing';
  } | null>(null);

  const [relatedData, setRelatedData] = useState<RelatedNodesResponse | null>(null);
  const [relatedLoading, setRelatedLoading] = useState<boolean>(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);
    setSelectedRelation(null);
    setRelatedData(null);

    apiClient
      .getNode(nodeId)
      .then((data) => {
        if (!isCancelled) {
          setNodeDetail(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load node details');
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [nodeId]);

  const handleSelectRelation = (type: string, direction: 'incoming' | 'outgoing') => {
    if (selectedRelation?.type === type && selectedRelation?.direction === direction) {
      setSelectedRelation(null);
      setRelatedData(null);
      return;
    }

    setSelectedRelation({ type, direction });
    setRelatedLoading(true);
    setRelatedError(null);

    apiClient
      .getRelatedNodes(nodeId, type, direction)
      .then((data) => {
        setRelatedData(data);
        setRelatedLoading(false);
      })
      .catch((err: unknown) => {
        setRelatedError(err instanceof Error ? err.message : 'Failed to load related nodes');
        setRelatedLoading(false);
      });
  };

  if (loading) {
    return (
      <div className="object-detail-panel" data-testid="object-detail-loading">
        <div className="loading-state">
          <RefreshCw className="spin" size={24} />
          <span>Loading node details for {nodeId}...</span>
        </div>
      </div>
    );
  }

  if (error || !nodeDetail) {
    return (
      <div className="object-detail-panel" data-testid="object-detail-error">
        <div className="error-message">
          <AlertCircle size={20} />
          <span>{error || 'Node not found.'}</span>
        </div>
        {onClose && (
          <button className="secondary-button" onClick={onClose} style={{ marginTop: '1rem' }}>
            Back
          </button>
        )}
      </div>
    );
  }

  const outgoingSummary = nodeDetail.relations_summary?.outgoing || {};
  const incomingSummary = nodeDetail.relations_summary?.incoming || {};

  return (
    <div className="object-detail-container" data-testid="object-detail-view">
      {/* Top Header */}
      <div className="object-detail-header">
        <div className="header-info">
          <div className="header-labels">
            {nodeDetail.labels.map((lbl) => (
              <span key={lbl} className="node-label-pill">
                <Tag size={12} />
                {lbl}
              </span>
            ))}
          </div>
          <h2 className="header-title" data-testid="node-id-title">
            Node: {nodeDetail.id}
          </h2>
        </div>
        {onClose && (
          <button
            className="secondary-button close-detail-btn"
            onClick={onClose}
            data-testid="close-detail-btn"
          >
            Close Detail
          </button>
        )}
      </div>

      <div className="object-detail-body">
        {/* Properties Section */}
        <section className="detail-section">
          <h3>
            <Layers size={16} />
            Properties
          </h3>
          <div className="properties-grid" data-testid="node-properties-table">
            {Object.keys(nodeDetail.properties).length === 0 ? (
              <span className="text-muted">No properties found.</span>
            ) : (
              sortPropertyEntries(Object.entries(nodeDetail.properties)).map(([key, pv]) => (
                <div key={key} className="property-item">
                  <span className="property-key">{key}</span>
                  <span className="property-value">{formatPropertyValue(pv)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Relation Badges Section */}
        <section className="detail-section">
          <h3>
            <GitCommit size={16} />
            Relationships
          </h3>

          <div className="relations-summary-block">
            <div className="summary-group">
              <span className="summary-direction-label">
                <ArrowRight size={14} /> Outgoing:
              </span>
              <div className="badges-list" data-testid="outgoing-relation-badges">
                {Object.keys(outgoingSummary).length === 0 ? (
                  <span className="text-muted">None</span>
                ) : (
                  Object.entries(outgoingSummary).map(([type, count]) => (
                    <button
                      key={`out-${type}`}
                      className={`relation-badge outgoing ${
                        selectedRelation?.type === type && selectedRelation?.direction === 'outgoing'
                          ? 'active'
                          : ''
                      }`}
                      onClick={() => handleSelectRelation(type, 'outgoing')}
                      data-testid={`rel-badge-outgoing-${type}`}
                    >
                      <span className="badge-type">{type}</span>
                      <span className="badge-count">{count}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="summary-group">
              <span className="summary-direction-label">
                <ArrowLeft size={14} /> Incoming:
              </span>
              <div className="badges-list" data-testid="incoming-relation-badges">
                {Object.keys(incomingSummary).length === 0 ? (
                  <span className="text-muted">None</span>
                ) : (
                  Object.entries(incomingSummary).map(([type, count]) => (
                    <button
                      key={`in-${type}`}
                      className={`relation-badge incoming ${
                        selectedRelation?.type === type && selectedRelation?.direction === 'incoming'
                          ? 'active'
                          : ''
                      }`}
                      onClick={() => handleSelectRelation(type, 'incoming')}
                      data-testid={`rel-badge-incoming-${type}`}
                    >
                      <span className="badge-type">{type}</span>
                      <span className="badge-count">{count}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Expanded Related Nodes List */}
        {selectedRelation && (
          <section className="detail-section related-nodes-section" data-testid="related-nodes-section">
            <div className="related-section-header">
              <h3>
                {selectedRelation.direction === 'outgoing' ? 'Outgoing' : 'Incoming'} Relationships: &lsquo;{selectedRelation.type}&rsquo;
              </h3>
              {relatedData && (
                <span className="badge">
                  {relatedData.total} {relatedData.total === 1 ? 'connection' : 'connections'}
                </span>
              )}
            </div>

            {relatedLoading && (
              <div className="loading-state">
                <RefreshCw className="spin" size={16} />
                <span>Loading related nodes...</span>
              </div>
            )}

            {relatedError && (
              <div className="error-message">
                <AlertCircle size={16} />
                <span>{relatedError}</span>
              </div>
            )}

            {!relatedLoading && relatedData && (
              <div className="related-nodes-list" data-testid="related-nodes-list">
                {relatedData.items.length === 0 ? (
                  <span className="text-muted">No connected nodes found.</span>
                ) : (
                  relatedData.items.map((item, index) => (
                    <div key={`${item.node.id}-${index}`} className="related-node-card">
                      <div className="card-header">
                        <div className="card-labels">
                          {item.node.labels.map((l) => (
                            <span key={l} className="node-label-pill mini">
                              {l}
                            </span>
                          ))}
                        </div>
                        <button
                          className="link-button node-nav-button"
                          onClick={() => onNavigateNode(item.node.id)}
                          data-testid={`navigate-node-${item.node.id}`}
                        >
                          <ExternalLink size={14} />
                          <span>{item.node.id}</span>
                        </button>
                      </div>

                      {/* Summary properties */}
                      <div className="card-properties">
                        {sortPropertyEntries(Object.entries(item.node.summary_properties || {})).map(([pk, pv]) => (
                          <div key={pk} className="card-prop-item">
                            <span className="card-prop-key">{pk}:</span>
                            <span className="card-prop-val">{formatPropertyValue(pv)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Edge properties if any */}
                      {item.relation_properties && Object.keys(item.relation_properties).length > 0 && (
                        <div className="edge-properties-preview">
                          <span className="edge-prop-label">Edge properties:</span>
                          <span className="edge-prop-val">
                            {Object.entries(item.relation_properties)
                              .map(([k, pv]) => `${k}=${formatPropertyValue(pv)}`)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
