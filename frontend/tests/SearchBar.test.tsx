import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from '../src/components/SearchBar';

describe('SearchBar', () => {
  it('renders input with placeholder and calls onSearch on submit', () => {
    const handleSearch = vi.fn();
    render(<SearchBar onSearch={handleSearch} placeholder="Search nodes..." />);

    const input = screen.getByTestId('search-input');
    expect(input).toHaveAttribute('placeholder', 'Search nodes...');

    fireEvent.change(input, { target: { value: 'person:42' } });
    fireEvent.submit(screen.getByTestId('search-bar-form'));

    expect(handleSearch).toHaveBeenCalledWith('person:42');
  });

  it('does not submit when input is empty or whitespace', () => {
    const handleSearch = vi.fn();
    render(<SearchBar onSearch={handleSearch} />);

    fireEvent.submit(screen.getByTestId('search-bar-form'));
    expect(handleSearch).not.toHaveBeenCalled();

    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(screen.getByTestId('search-bar-form'));
    expect(handleSearch).not.toHaveBeenCalled();
  });
});
