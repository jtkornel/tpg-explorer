import React, { useState } from 'react';
import { Database, Table, Share2, Layers } from 'lucide-react';
import { QueryEditor } from './components/QueryEditor';
import { ResultsTable } from './components/ResultsTable';
import { apiClient } from './apiClient';
import type { QueryRequest, QueryResponse } from './types';
import './App.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'query' | 'graph' | 'schema'>('query');
  const [queryResponse, setQueryResponse] = useState<QueryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecuteQuery = async (req: QueryRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await apiClient.runQuery(req);
      setQueryResponse(resp);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred executing the query.');
      }
      setQueryResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNodeClick = (nodeId: string) => {
    console.log('Node clicked:', nodeId);
    // Future PRs will route to Object Detail view
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <Database className="brand-icon" size={24} />
          <h1>TPG Explorer</h1>
          <span className="badge">Traverse</span>
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
                onExecute={handleExecuteQuery}
                isLoading={isLoading}
              />
            </section>

            <section className="results-section">
              <ResultsTable
                response={queryResponse}
                error={error}
                onNodeClick={handleNodeClick}
              />
            </section>
          </div>
        )}

        {activeTab === 'graph' && (
          <div className="placeholder-view" data-testid="graph-placeholder">
            <Share2 size={48} className="placeholder-icon" />
            <h3>Graph View</h3>
            <p>Interactive Cytoscape graph visualization arriving in PR 4.</p>
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="placeholder-view" data-testid="schema-placeholder">
            <Layers size={48} className="placeholder-icon" />
            <h3>Schema Visualizer</h3>
            <p>Database schema and type introspection arriving in PR 6.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

