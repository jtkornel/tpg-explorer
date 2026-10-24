import React, { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import type { QueryRequest } from '../types';

interface QueryEditorProps {
  onExecute: (req: QueryRequest) => void;
  isLoading: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  dialect?: 'gql' | 'cypher';
  onDialectChange?: (dialect: 'gql' | 'cypher') => void;
  defaultQuery?: string;
  defaultDialect?: 'gql' | 'cypher';
}

export const QueryEditor: React.FC<QueryEditorProps> = ({
  onExecute,
  isLoading,
  query: controlledQuery,
  onQueryChange,
  dialect: controlledDialect,
  onDialectChange,
  defaultQuery = 'MATCH (n) RETURN n LIMIT 25',
  defaultDialect = 'gql',
}) => {
  const [internalQuery, setInternalQuery] = useState(defaultQuery);
  const [internalDialect, setInternalDialect] = useState<'gql' | 'cypher'>(defaultDialect);

  const query = controlledQuery !== undefined ? controlledQuery : internalQuery;
  const dialect = controlledDialect !== undefined ? controlledDialect : internalDialect;

  const setQueryValue = (val: string) => {
    if (onQueryChange) {
      onQueryChange(val);
    } else {
      setInternalQuery(val);
    }
  };

  const setDialectValue = (val: 'gql' | 'cypher') => {
    if (onDialectChange) {
      onDialectChange(val);
    } else {
      setInternalDialect(val);
    }
  };

  const execute = () => {
    if (!query.trim() || isLoading) return;
    onExecute({ query: query.trim(), dialect });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    execute();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      execute();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="query-editor" data-testid="query-editor">
      <div className="query-toolbar">
        <div className="dialect-selector">
          <label className="toolbar-label">Dialect:</label>
          <button
            type="button"
            className={`dialect-btn ${dialect === 'gql' ? 'active' : ''}`}
            onClick={() => setDialectValue('gql')}
            data-testid="dialect-gql"
          >
            GQL
          </button>
          <button
            type="button"
            className={`dialect-btn ${dialect === 'cypher' ? 'active' : ''}`}
            onClick={() => setDialectValue('cypher')}
            data-testid="dialect-cypher"
          >
            Cypher
          </button>
        </div>

        <div className="toolbar-actions">
          <span className="shortcut-hint">Ctrl+Enter to run</span>
          <button
            type="submit"
            className="run-btn"
            disabled={isLoading || !query.trim()}
            data-testid="run-query-btn"
          >
            {isLoading ? (
              <>
                <Loader2 className="btn-icon spin" size={16} />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="btn-icon" size={16} />
                <span>Run Query</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="editor-container">
        <textarea
          className="query-textarea"
          value={query}
          onChange={(e) => setQueryValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your query here (e.g. MATCH (n:Movie) RETURN n.title LIMIT 25)"
          rows={5}
          spellCheck={false}
          data-testid="query-input"
        />
      </div>
    </form>
  );
};
