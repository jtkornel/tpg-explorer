import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SchemaVisualizer } from '../src/components/SchemaVisualizer';
import { apiClient } from '../src/apiClient';

describe('SchemaVisualizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then displays labels, relationship types, and properties', async () => {
    vi.spyOn(apiClient, 'getSchema').mockResolvedValueOnce({
      labels: ['Movie', 'Person', 'Genre'],
      relationship_types: ['ACTED_IN', 'DIRECTED', 'PRODUCED'],
      property_keys: {
        title: 'STRING',
        released: 'INTEGER',
        name: 'STRING',
        born: 'INTEGER',
      },
      patterns: [
        { from_label: 'Person', type: 'ACTED_IN', to_label: 'Movie' },
        { from_label: 'Person', type: 'DIRECTED', to_label: 'Movie' },
      ],
    });

    render(<SchemaVisualizer />);

    expect(screen.getByTestId('schema-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('schema-visualizer')).toBeInTheDocument();
    });

    expect(screen.getByTestId('label-count-badge')).toHaveTextContent('3 Node Labels');
    expect(screen.getByTestId('rel-count-badge')).toHaveTextContent('3 Relationship Types');
    expect(screen.getByTestId('prop-count-badge')).toHaveTextContent('4 Property Keys');

    expect(screen.getByTestId('schema-label-Movie')).toHaveTextContent('Movie');
    expect(screen.getByTestId('schema-label-Person')).toHaveTextContent('Person');

    expect(screen.getByTestId('schema-rel-ACTED_IN')).toHaveTextContent('ACTED_IN');
    expect(screen.getByTestId('schema-rel-DIRECTED')).toHaveTextContent('DIRECTED');

    expect(screen.getByTestId('schema-prop-title')).toHaveTextContent('STRING');
    expect(screen.getByTestId('schema-prop-released')).toHaveTextContent('INTEGER');

    expect(screen.getByTestId('schema-patterns-section')).toBeInTheDocument();
    expect(screen.getByText('─[ACTED_IN]─▶')).toBeInTheDocument();
  });

  it('handles item selection callbacks for label and relationship', async () => {
    vi.spyOn(apiClient, 'getSchema').mockResolvedValueOnce({
      labels: ['Movie'],
      relationship_types: ['ACTED_IN'],
      property_keys: {},
      patterns: [],
    });

    const onSelectLabel = vi.fn();
    const onSelectType = vi.fn();

    render(
      <SchemaVisualizer
        onSelectLabel={onSelectLabel}
        onSelectType={onSelectType}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('schema-visualizer')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('schema-label-Movie'));
    expect(onSelectLabel).toHaveBeenCalledWith('Movie');

    fireEvent.click(screen.getByTestId('schema-rel-ACTED_IN'));
    expect(onSelectType).toHaveBeenCalledWith('ACTED_IN');
  });

  it('renders error state when schema fetch fails', async () => {
    vi.spyOn(apiClient, 'getSchema').mockRejectedValueOnce(new Error('Traverse connection refused'));

    render(<SchemaVisualizer />);

    await waitFor(() => {
      expect(screen.getByTestId('schema-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Traverse connection refused')).toBeInTheDocument();
  });
});
