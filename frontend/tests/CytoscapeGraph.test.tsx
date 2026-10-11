import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CytoscapeGraph } from '../src/components/CytoscapeGraph';
import type { GraphElements } from '../src/utils/graphParser';

describe('CytoscapeGraph component', () => {
  const sampleElements: GraphElements = {
    nodes: [
      {
        id: 'node-1',
        label: ':Movie',
        labels: ['Movie'],
        properties: { title: 'The Matrix', year: 1999 },
      },
      {
        id: 'node-2',
        label: ':Person',
        labels: ['Person'],
        properties: { name: 'Keanu Reeves' },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-2',
        target: 'node-1',
        type: 'ACTED_IN',
        properties: { role: 'Neo' },
      },
    ],
  };

  it('renders graph container, canvas, toolbar and layout buttons', () => {
    render(<CytoscapeGraph elements={sampleElements} />);

    expect(screen.getByTestId('graph-view-container')).toBeInTheDocument();
    expect(screen.getByTestId('cytoscape-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('layout-cose')).toBeInTheDocument();
    expect(screen.getByTestId('layout-circle')).toBeInTheDocument();
    expect(screen.getByTestId('layout-grid')).toBeInTheDocument();
    expect(screen.getByTestId('layout-concentric')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-in-btn')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-out-btn')).toBeInTheDocument();
    expect(screen.getByTestId('fit-btn')).toBeInTheDocument();
    expect(screen.getByTestId('reset-btn')).toBeInTheDocument();
  });

  it('allows switching layouts', () => {
    render(<CytoscapeGraph elements={sampleElements} />);

    const coseBtn = screen.getByTestId('layout-cose');
    const circleBtn = screen.getByTestId('layout-circle');

    expect(coseBtn).toHaveClass('active');
    fireEvent.click(circleBtn);
    expect(circleBtn).toHaveClass('active');
    expect(coseBtn).not.toHaveClass('active');
  });

  it('allows clicking zoom and fit buttons without error', () => {
    render(<CytoscapeGraph elements={sampleElements} />);

    fireEvent.click(screen.getByTestId('zoom-in-btn'));
    fireEvent.click(screen.getByTestId('zoom-out-btn'));
    fireEvent.click(screen.getByTestId('fit-btn'));
    fireEvent.click(screen.getByTestId('reset-btn'));
  });
});
