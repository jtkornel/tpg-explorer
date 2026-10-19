import React, { useState } from 'react';
import { Search, ArrowRight } from 'lucide-react';

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Lookup node by ID or label...',
}) => {
  const [term, setTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (term.trim()) {
      onSearch(term.trim());
    }
  };

  return (
    <form className="search-bar-form" onSubmit={handleSubmit} data-testid="search-bar-form">
      <Search size={16} className="search-icon" />
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        data-testid="search-input"
      />
      <button type="submit" className="search-submit-btn" data-testid="search-submit-btn">
        <ArrowRight size={14} />
      </button>
    </form>
  );
};
