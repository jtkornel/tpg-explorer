import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ObjectDetailView } from '../src/components/ObjectDetailView';
import { apiClient } from '../src/apiClient';

describe('ObjectDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then displays properties and relation badges', async () => {
    vi.spyOn(apiClient, 'getNode').mockResolvedValueOnce({
      id: 'movie:101',
      labels: ['Movie'],
      properties: {
        title: 'The Matrix',
        released: 1999,
      },
      relations_summary: {
        incoming: { ACTED_IN: 3, DIRECTED: 1 },
        outgoing: {},
      },
    });

    render(
      <ObjectDetailView
        nodeId="movie:101"
        onNavigateNode={vi.fn()}
      />
    );

    expect(screen.getByTestId('object-detail-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('object-detail-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('node-id-title')).toHaveTextContent('Node: movie:101');
    expect(screen.getByText('The Matrix')).toBeInTheDocument();
    expect(screen.getByText('1999')).toBeInTheDocument();

    const incomingBadges = screen.getByTestId('incoming-relation-badges');
    expect(incomingBadges).toHaveTextContent('ACTED_IN');
    expect(incomingBadges).toHaveTextContent('3');
  });

  it('expands related nodes list when clicking a relation badge', async () => {
    vi.spyOn(apiClient, 'getNode').mockResolvedValueOnce({
      id: 'movie:101',
      labels: ['Movie'],
      properties: { title: 'The Matrix' },
      relations_summary: {
        incoming: { ACTED_IN: 1 },
        outgoing: {},
      },
    });

    vi.spyOn(apiClient, 'getRelatedNodes').mockResolvedValueOnce({
      relation_type: 'ACTED_IN',
      direction: 'incoming',
      items: [
        {
          relation_properties: { roles: ['Neo'] },
          node: {
            id: 'person:201',
            labels: ['Person'],
            summary_properties: { name: 'Keanu Reeves' },
          },
        },
      ],
      total: 1,
    });

    const onNavigateMock = vi.fn();

    render(
      <ObjectDetailView
        nodeId="movie:101"
        onNavigateNode={onNavigateMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('rel-badge-incoming-ACTED_IN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('rel-badge-incoming-ACTED_IN'));

    await waitFor(() => {
      expect(screen.getByTestId('related-nodes-section')).toBeInTheDocument();
    });

    expect(screen.getByText('Keanu Reeves')).toBeInTheDocument();
    expect(screen.getByText('person:201')).toBeInTheDocument();

    // Click to navigate to related node
    const navBtn = screen.getByTestId('navigate-node-person:201');
    fireEvent.click(navBtn);
    expect(onNavigateMock).toHaveBeenCalledWith('person:201');
  });

  it('renders error state when node lookup fails', async () => {
    vi.spyOn(apiClient, 'getNode').mockRejectedValueOnce(new Error('Node not found'));

    render(
      <ObjectDetailView
        nodeId="invalid:999"
        onNavigateNode={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('object-detail-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Node not found')).toBeInTheDocument();
  });
});
