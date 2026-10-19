import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryEditor } from '../src/components/QueryEditor';

describe('QueryEditor component', () => {
  it('renders default query and dialect', () => {
    const onExecute = vi.fn();
    render(<QueryEditor onExecute={onExecute} isLoading={false} />);

    expect(screen.getByTestId('query-input')).toHaveValue('MATCH (n) RETURN n LIMIT 25');
    expect(screen.getByTestId('dialect-gql')).toHaveClass('active');
  });

  it('toggles dialect between GQL and Cypher', () => {
    const onExecute = vi.fn();
    render(<QueryEditor onExecute={onExecute} isLoading={false} />);

    const cypherBtn = screen.getByTestId('dialect-cypher');
    const gqlBtn = screen.getByTestId('dialect-gql');

    fireEvent.click(cypherBtn);
    expect(cypherBtn).toHaveClass('active');
    expect(gqlBtn).not.toHaveClass('active');

    fireEvent.click(gqlBtn);
    expect(gqlBtn).toHaveClass('active');
  });

  it('triggers onExecute on submit with current query and dialect', () => {
    const onExecute = vi.fn();
    render(<QueryEditor onExecute={onExecute} isLoading={false} />);

    const input = screen.getByTestId('query-input');
    fireEvent.change(input, { target: { value: 'MATCH (m:Movie) RETURN m' } });

    const cypherBtn = screen.getByTestId('dialect-cypher');
    fireEvent.click(cypherBtn);

    const runBtn = screen.getByTestId('run-query-btn');
    fireEvent.click(runBtn);

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith({
      query: 'MATCH (m:Movie) RETURN m',
      dialect: 'cypher',
    });
  });

  it('disables run button when query is empty or loading', () => {
    const onExecute = vi.fn();
    const { rerender } = render(<QueryEditor onExecute={onExecute} isLoading={false} defaultQuery="" />);

    const runBtn = screen.getByTestId('run-query-btn');
    expect(runBtn).toBeDisabled();

    rerender(<QueryEditor onExecute={onExecute} isLoading={true} defaultQuery="MATCH (n) RETURN n" />);
    expect(screen.getByTestId('run-query-btn')).toBeDisabled();
    expect(screen.getByText('Running...')).toBeInTheDocument();
  });
});
