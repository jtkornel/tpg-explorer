import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { Core } from 'cytoscape';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Info, X } from 'lucide-react';
import type { GraphElements, GraphNode, GraphEdge } from '../utils/graphParser';

interface CytoscapeGraphProps {
  elements: GraphElements;
  onSelectNode?: (nodeId: string) => void;
}

export const CytoscapeGraph: React.FC<CytoscapeGraphProps> = ({
  elements,
  onSelectNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [layoutName, setLayoutName] = useState<'cose' | 'circle' | 'grid' | 'concentric'>('cose');
  const [selectedItem, setSelectedItem] = useState<{
    type: 'node' | 'edge';
    data: GraphNode | GraphEdge;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Convert elements to cytoscape format
    const cyElements = [
      ...elements.nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.label,
          raw: n,
        },
      })),
      ...elements.edges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.type,
          raw: e,
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements: cyElements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#38bdf8',
            'label': 'data(label)',
            'color': '#f8fafc',
            'font-size': '12px',
            'font-family': 'JetBrains Mono, monospace',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'width': '50px',
            'height': '50px',
            'border-width': 2,
            'border-color': '#0284c7',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#f59e0b',
            'border-color': '#d97706',
            'border-width': 4,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#64748b',
            'target-arrow-color': '#64748b',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'color': '#94a3b8',
            'text-background-opacity': 0.8,
            'text-background-color': '#0f172a',
            'text-background-padding': '2px',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 3,
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
          },
        },
      ],
      layout: {
        name: layoutName,
        animate: false,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const rawData = node.data('raw') as GraphNode;
      setSelectedItem({ type: 'node', data: rawData });
    });

    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      const rawData = edge.data('raw') as GraphEdge;
      setSelectedItem({ type: 'edge', data: rawData });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedItem(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, layoutName]);

  const handleZoomIn = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  };

  const handleZoomOut = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  };

  const handleFit = () => {
    cyRef.current?.fit();
  };

  const handleReset = () => {
    cyRef.current?.reset();
    cyRef.current?.layout({ name: layoutName, animate: true }).run();
  };

  return (
    <div className="graph-view-container" data-testid="graph-view-container">
      <div className="graph-controls-toolbar">
        <div className="layout-switcher">
          <label className="toolbar-label">Layout:</label>
          {(['cose', 'circle', 'grid', 'concentric'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`layout-btn ${layoutName === l ? 'active' : ''}`}
              onClick={() => setLayoutName(l)}
              data-testid={`layout-${l}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="graph-actions">
          <button
            type="button"
            className="graph-tool-btn"
            onClick={handleZoomIn}
            title="Zoom In"
            data-testid="zoom-in-btn"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            className="graph-tool-btn"
            onClick={handleZoomOut}
            title="Zoom Out"
            data-testid="zoom-out-btn"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            className="graph-tool-btn"
            onClick={handleFit}
            title="Fit to screen"
            data-testid="fit-btn"
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            className="graph-tool-btn"
            onClick={handleReset}
            title="Reset layout"
            data-testid="reset-btn"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      <div className="graph-canvas-wrapper">
        <div
          ref={containerRef}
          className="cytoscape-canvas"
          data-testid="cytoscape-canvas"
          style={{ width: '100%', height: '560px' }}
        />

        {selectedItem && (
          <aside className="graph-inspector-panel" data-testid="graph-inspector">
            <div className="inspector-header">
              <div className="inspector-title">
                <Info size={16} />
                <span>
                  {selectedItem.type === 'node'
                    ? `Node: ${selectedItem.data.id}`
                    : `Edge: ${(selectedItem.data as GraphEdge).type}`}
                </span>
              </div>
              <button
                type="button"
                className="close-inspector-btn"
                onClick={() => setSelectedItem(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="inspector-body">
              {selectedItem.type === 'node' && (
                <>
                  <div className="inspector-field">
                    <span className="field-label">Labels:</span>
                    <div className="label-tags">
                      {(selectedItem.data as GraphNode).labels.map((lbl) => (
                        <span key={lbl} className="label-tag">
                          :{lbl}
                        </span>
                      ))}
                      {(selectedItem.data as GraphNode).labels.length === 0 && (
                        <span className="text-muted">None</span>
                      )}
                    </div>
                  </div>

                  {onSelectNode && (
                    <button
                      type="button"
                      className="inspect-node-btn"
                      onClick={() => onSelectNode(selectedItem.data.id)}
                      data-testid="inspect-node-btn"
                    >
                      Inspect Node Details &rarr;
                    </button>
                  )}
                </>
              )}

              {selectedItem.type === 'edge' && (
                <>
                  <div className="inspector-field">
                    <span className="field-label">Source:</span>
                    <code>{(selectedItem.data as GraphEdge).source}</code>
                  </div>
                  <div className="inspector-field">
                    <span className="field-label">Target:</span>
                    <code>{(selectedItem.data as GraphEdge).target}</code>
                  </div>
                </>
              )}

              <div className="inspector-field">
                <span className="field-label">Properties:</span>
                <pre className="properties-json">
                  {JSON.stringify(selectedItem.data.properties, null, 2)}
                </pre>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
