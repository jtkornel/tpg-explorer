import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';
import { apiClient } from '../src/apiClient';

describe('App component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders header, navigation tabs, and default query view', () => {
    render(<App />);

    expect(screen.getByText('TPG Explorer')).toBeInTheDocument();
    expect(screen.getByTestId('tab-query')).toHaveClass('active');
    expect(screen.getByTestId('query-editor')).toBeInTheDocument();
    expect(screen.getByTestId('results-empty')).toBeInTheDocument();
  });

  it('switches between tabs', () => {
    vi.spyOn(apiClient, 'getSchema').mockResolvedValueOnce({
      labels: [],
      relationship_types: [],
      property_keys: {},
    });

    render(<App />);

    fireEvent.click(screen.getByTestId('tab-graph'));
    expect(screen.getByTestId('tab-graph')).toHaveClass('active');
    expect(screen.getByTestId('graph-empty-state')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-object'));
    expect(screen.getByTestId('tab-object')).toHaveClass('active');
    expect(screen.getByTestId('object-empty-state')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-schema'));
    expect(screen.getByTestId('tab-schema')).toHaveClass('active');
    expect(screen.getByTestId('schema-loading')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-query'));
    expect(screen.getByTestId('tab-query')).toHaveClass('active');
    expect(screen.getByTestId('query-editor')).toBeInTheDocument();
  });

  it('executes query and displays results table', async () => {
    vi.spyOn(apiClient, 'runQuery').mockResolvedValueOnce({
      columns: ['title', 'year'],
      rows: [
        ['The Matrix', 1999],
        ['The Matrix Reloaded', 2003],
      ],
      total_rows: 2,
      truncated: false,
      time_ms: 8.4,
    });

    render(<App />);

    const runBtn = screen.getByTestId('run-query-btn');
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByTestId('results-table')).toBeInTheDocument();
      expect(screen.getByText('The Matrix')).toBeInTheDocument();
      expect(screen.getByText('1999')).toBeInTheDocument();
    });
  });

  it('handles query execution error and displays error banner', async () => {
    vi.spyOn(apiClient, 'runQuery').mockRejectedValueOnce(
      new Error('Syntax error in query: unexpected token')
    );

    render(<App />);

    const runBtn = screen.getByTestId('run-query-btn');
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByTestId('results-error')).toBeInTheDocument();
      expect(screen.getByText('Syntax error in query: unexpected token')).toBeInTheDocument();
    });
  });
});
