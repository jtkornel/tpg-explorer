import React from 'react';
import { Clock, Rows, AlertCircle } from 'lucide-react';
import type { QueryResponse } from '../types';

interface ResultsTableProps {
  response: QueryResponse | null;
  error?: string | null;
  onNodeClick?: (nodeId: string) => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  response,
  error,
  onNodeClick,
}) => {
  if (error) {
    return (
      <div className="results-container error-state" data-testid="results-error">
        <div className="error-banner">
          <AlertCircle size={20} className="error-icon" />
          <div className="error-text">
            <h4>Query Error</h4>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="results-container empty-state" data-testid="results-empty">
        <p>Run a query above to see results.</p>
      </div>
    );
  }

  const { columns, rows, total_rows, truncated, time_ms } = response;

  const renderCellContent = (val: unknown) => {
    if (val === null || val === undefined) {
      return <span className="cell-null">null</span>;
    }
    if (typeof val === 'boolean') {
      return <span className="cell-bool">{val ? 'true' : 'false'}</span>;
    }
    if (typeof val === 'number') {
      return <span className="cell-number">{val}</span>;
    }
    if (typeof val === 'object') {
      // Check if it's a node representation
      const obj = val as Record<string, unknown>;
      if (obj.id && onNodeClick && typeof obj.id === 'string') {
        return (
          <button
            type="button"
            className="node-link-btn"
            onClick={() => onNodeClick(String(obj.id))}
          >
            {obj.labels ? `(:${(obj.labels as string[]).join(':')}) ` : ''}
            {String(obj.id)}
          </button>
        );
      }
      return <code className="cell-json">{JSON.stringify(val)}</code>;
    }
    return String(val);
  };

  return (
    <div className="results-container" data-testid="results-table-container">
      <div className="results-stats-bar">
        <div className="stat-item">
          <Rows size={16} />
          <span>
            {total_rows} row{total_rows === 1 ? '' : 's'}
            {truncated && ' (truncated)'}
          </span>
        </div>
        <div className="stat-item">
          <Clock size={16} />
          <span>{time_ms.toFixed(1)} ms</span>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="results-table" data-testid="results-table">
          <thead>
            <tr>
              <th className="row-num-header">#</th>
              {columns.map((col, idx) => (
                <th key={idx} scope="col">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="row-num">{rowIdx + 1}</td>
                {row.map((cell, colIdx) => (
                  <td key={colIdx}>{renderCellContent(cell)}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="no-rows">
                  No records returned
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
