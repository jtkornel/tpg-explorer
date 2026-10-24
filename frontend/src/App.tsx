import React, { useState, useMemo } from 'react';
import { Database, Table, Share2, Layers, Compass } from 'lucide-react';
import { QueryEditor } from './components/QueryEditor';
import { ResultsTable } from './components/ResultsTable';
import { CytoscapeGraph } from './components/CytoscapeGraph';
import { ObjectDetailView } from './components/ObjectDetailView';
import { SchemaVisualizer } from './components/SchemaVisualizer';
import { SearchBar } from './components/SearchBar';
import { extractGraphElements } from './utils/graphParser';
import { apiClient } from './apiClient';
import type { QueryRequest, QueryResponse } from './types';
import './App.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'query' | 'graph' | 'schema' | 'object'>('query');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [queryResponse, setQueryResponse] = useState<QueryResponse | null>(null);
  const [currentQuery, setCurrentQuery] = useState('MATCH (n) RETURN n LIMIT 25');
  const [currentDialect, setCurrentDialect] = useState<'gql' | 'cypher'>('gql');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const graphElements = useMemo(() => {
    if (!queryResponse || !queryResponse.rows) {
      return { nodes: [], edges: [] };
    }
    return extractGraphElements(queryResponse.rows);
  }, [queryResponse]);

  const handleExecuteQuery = async (req: QueryRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await apiClient.runQuery(req);
      setQueryResponse(resp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred executing the query.');
      setQueryResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInspectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setActiveTab('object');
  };

  const handleSearchNode = (term: string) => {
    handleInspectNode(term);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <Database className="brand-icon" size={24} />
          <h1>TPG Explorer</h1>
          <span className="badge">Traverse</span>
        </div>

        <div className="header-search">
          <SearchBar onSearch={handleSearchNode} />
        </div>

        <nav className="header-nav">
          <button
            className={`nav-tab ${activeTab === 'query' ? 'active' : ''}`}
            onClick={() => setActiveTab('query')}
            data-testid="tab-query"
          >
            <Table size={18} />
            <span>Query Runner</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
            data-testid="tab-graph"
          >
            <Share2 size={18} />
            <span>Graph View</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'object' ? 'active' : ''}`}
            onClick={() => setActiveTab('object')}
            data-testid="tab-object"
          >
            <Compass size={18} />
            <span>Object Detail</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'schema' ? 'active' : ''}`}
            onClick={() => setActiveTab('schema')}
            data-testid="tab-schema"
          >
            <Layers size={18} />
            <span>Schema</span>
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'query' && (
          <div className="query-view-layout">
            <section className="editor-section">
              <QueryEditor
                query={currentQuery}
                onQueryChange={setCurrentQuery}
                dialect={currentDialect}
                onDialectChange={setCurrentDialect}
                onExecute={handleExecuteQuery}
                isLoading={isLoading}
              />
            </section>

            <section className="results-section">
              <ResultsTable
                response={queryResponse}
                error={error}
                onNodeClick={handleInspectNode}
              />
            </section>
          </div>
        )}

        {activeTab === 'graph' && (
          <div className="graph-tab-layout">
            {graphElements.nodes.length === 0 ? (
              <div className="placeholder-view" data-testid="graph-empty-state">
                <Share2 size={48} className="placeholder-icon" />
                <h3>No Graph Elements Found</h3>
                <p>Run a query returning nodes or relationships in the Query Runner to visualize them here.</p>
              </div>
            ) : (
              <CytoscapeGraph
                elements={graphElements}
                onSelectNode={handleInspectNode}
              />
            )}
          </div>
        )}

        {activeTab === 'object' && (
          <div className="object-tab-layout">
            {selectedNodeId ? (
              <ObjectDetailView
                nodeId={selectedNodeId}
                onNavigateNode={handleInspectNode}
                onClose={() => setActiveTab('query')}
              />
            ) : (
              <div className="placeholder-view" data-testid="object-empty-state">
                <Compass size={48} className="placeholder-icon" />
                <h3>No Node Selected</h3>
                <p>Use the search bar above or click on any node in the Query Runner / Graph view to view its properties and relationships.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="schema-tab-layout">
            <SchemaVisualizer />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

