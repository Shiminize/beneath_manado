import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LibraryItem } from '../../app/types';
import { Field } from '../../ui';

interface SearchScreenProps {
  items: LibraryItem[];
  initialQuery?: string;
  onOpenItem: (itemId: string, chapterIndex?: number) => void;
}

export function SearchScreen({ items, initialQuery = '', onOpenItem }: SearchScreenProps) {
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    return searchLibraryMetadata(items, trimmed);
  }, [items, query]);

  return (
    <main className="screen screen-search">
      <header className="screen-header">
        <div>
          <h1>Search</h1>
          <p>{results.length} results</p>
        </div>
      </header>

      <Field icon={<Search size={20} aria-hidden="true" />}>
        <input
          aria-label="Find books and text"
          name="global-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a title, author, genre, or collection"
          autoFocus
        />
      </Field>

      <section className="search-results" aria-label="Search results">
        {results.map((result) => (
          <button
            key={`${result.item.id}-${result.chapterIndex}-${result.snippet}`}
            type="button"
            className="search-result"
            onClick={() => onOpenItem(result.item.id, result.chapterIndex)}
          >
            <span>{result.item.title}</span>
            <strong>{result.title}</strong>
            <small>{result.snippet}</small>
          </button>
        ))}
      </section>
    </main>
  );
}

function searchLibraryMetadata(items: LibraryItem[], query: string) {
  const normalized = query.toLowerCase();
  return items
    .filter((item) => {
      const haystack = [item.title, item.author, item.subtitle, item.description, item.section, ...item.tags].join(' ').toLowerCase();
      return haystack.includes(normalized);
    })
    .map((item) => ({
      item,
      chapterIndex: undefined,
      title: item.title,
      snippet: item.description
    }))
    .slice(0, 24);
}
