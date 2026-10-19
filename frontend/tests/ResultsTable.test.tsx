import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsTable } from '../src/components/ResultsTable';
import type { QueryResponse } from '../src/types';

describe('ResultsTable component', () => {
  it('renders empty state when response is null', () => {
    render(<ResultsTable response={null} />);
    expect(screen.getByTestId('results-empty')).toBeInTheDocument();
    expect(screen.getByText(/Run a query above to see results/i)).toBeInTheDocument();
  });

  it('renders error state when error is provided', () => {
    render(<ResultsTable response={null} error="Failed to connect to Traverse database" />);
    expect(screen.getByTestId('results-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to connect to Traverse database')).toBeInTheDocument();
  });

  it('renders tabular results with headers and rows', () => {
    const mockResponse: QueryResponse = {
      columns: ['p.name', 'decade'],
      rows: [
        ['Keanu Reeves', 1990],
        ['Carrie-Anne Moss', 1990],
      ],
      total_rows: 2,
      truncated: false,
      time_ms: 12.5,
    };

    render(<ResultsTable response={mockResponse} />);
    expect(screen.getByTestId('results-table-container')).toBeInTheDocument();
    expect(screen.getByText('2 rows')).toBeInTheDocument();
    expect(screen.getByText('12.5 ms')).toBeInTheDocument();

    expect(screen.getByText('p.name')).toBeInTheDocument();
    expect(screen.getByText('decade')).toBeInTheDocument();
    expect(screen.getByText('Keanu Reeves')).toBeInTheDocument();
    expect(screen.getByText('Carrie-Anne Moss')).toBeInTheDocument();
    expect(screen.getAllByText('1990')).toHaveLength(2);
  });

  it('renders clickable node links when node object is in cell', () => {
    const onNodeClick = vi.fn();
    const mockResponse: QueryResponse = {
      columns: ['node'],
      rows: [
        [{ id: 'node-123', labels: ['Person'] }],
      ],
      total_rows: 1,
      truncated: false,
      time_ms: 5.0,
    };

    render(<ResultsTable response={mockResponse} onNodeClick={onNodeClick} />);
    const linkBtn = screen.getByRole('button', { name: /node-123/ });
    expect(linkBtn).toBeInTheDocument();

    fireEvent.click(linkBtn);
    expect(onNodeClick).toHaveBeenCalledWith('node-123');
  });
});
