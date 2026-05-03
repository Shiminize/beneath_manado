import { Check, FolderPlus, Grid2X2, List, Plus, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AppState, Collection, LibraryItem, ReadingStatus } from '../../app/types';
import { AppIcon, BookCover, ChipRail, IconButton } from '../../ui';

interface LibraryScreenProps {
  items: LibraryItem[];
  state: AppState;
  initialCollectionId?: string;
  onOpenItem: (itemId: string) => void;
  onSetStatus: (itemId: string, status: ReadingStatus) => void;
  onCreateCollection: (name: string) => void;
  onAddToCollection: (collectionId: string, itemId: string) => void;
  onRemoveFromCollection: (collectionId: string, itemId: string) => void;
}

export function LibraryScreen({
  items,
  state,
  initialCollectionId = 'all',
  onOpenItem,
  onSetStatus,
  onCreateCollection,
  onAddToCollection,
  onRemoveFromCollection
}: LibraryScreenProps) {
  const [activeCollectionId, setActiveCollectionId] = useState(initialCollectionId);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [newCollectionName, setNewCollectionName] = useState('');
  const activeCollection = state.collections.find((collection) => collection.id === activeCollectionId) || state.collections[0];
  const customCollections = state.collections.filter((collection) => !collection.system);

  const visibleItems = useMemo(() => {
    if (!activeCollection || activeCollection.id === 'all') return items;
    return items.filter((item) => activeCollection.itemIds.includes(item.id));
  }, [activeCollection, items]);

  return (
    <main className="screen screen-library">
      <header className="screen-header">
        <div>
          <h1>Library</h1>
          <p>{visibleItems.length} items</p>
        </div>
        <div className="header-actions">
          <IconButton
            label={layout === 'grid' ? 'Show list' : 'Show grid'}
            icon={layout === 'grid' ? List : Grid2X2}
            variant="soft"
            onClick={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
          />
        </div>
      </header>

      <ChipRail
        activeId={activeCollectionId}
        ariaLabel="Collections"
        items={state.collections.map((collection) => ({ id: collection.id, label: collection.name }))}
        onSelect={setActiveCollectionId}
      />

      <form
        className="collection-form"
        onSubmit={(event) => {
          event.preventDefault();
          const name = newCollectionName.trim();
          if (!name) return;
          onCreateCollection(name);
          setNewCollectionName('');
        }}
      >
        <AppIcon icon={FolderPlus} />
        <input
          aria-label="New collection name"
          name="new-collection-name"
          value={newCollectionName}
          onChange={(event) => setNewCollectionName(event.target.value)}
          placeholder="New collection"
        />
        <IconButton label="Create collection" icon={Plus} variant="soft" type="submit" />
      </form>

      <section className={layout === 'grid' ? 'library-grid' : 'library-list'} aria-label={activeCollection?.name || 'Library'}>
        {visibleItems.map((item) => (
          <article key={item.id} className="library-card">
            <button type="button" className="library-cover-button" aria-label={`Open ${item.title}`} onClick={() => onOpenItem(item.id)}>
              <BookCover src={item.cover} />
            </button>
            <div className="library-card-body">
              <button type="button" className="library-title-button" onClick={() => onOpenItem(item.id)}>
                <strong>{item.title}</strong>
                <span>{item.author}</span>
              </button>
              <p>{item.subtitle}</p>
              <div className="library-meta">
                <span>{item.type.toUpperCase()}</span>
                <span>{state.progress[item.id]?.percent || 0}%</span>
              </div>
              <div className="library-actions">
                <IconButton
                  label="Mark want to read"
                  icon={Star}
                  iconSize="compact"
                  size="compact"
                  variant="soft"
                  onClick={() => onSetStatus(item.id, 'want-to-read')}
                />
                <IconButton
                  label="Mark finished"
                  icon={Check}
                  iconSize="compact"
                  size="compact"
                  variant="soft"
                  onClick={() => onSetStatus(item.id, 'finished')}
                />
                {customCollections.length > 0 && (
                  <CollectionSelect
                    item={item}
                    collections={customCollections}
                    onAddToCollection={onAddToCollection}
                    onRemoveFromCollection={onRemoveFromCollection}
                  />
                )}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

interface CollectionSelectProps {
  item: LibraryItem;
  collections: Collection[];
  onAddToCollection: (collectionId: string, itemId: string) => void;
  onRemoveFromCollection: (collectionId: string, itemId: string) => void;
}

function CollectionSelect({ item, collections, onAddToCollection, onRemoveFromCollection }: CollectionSelectProps) {
  return (
    <select
      className="collection-select"
      aria-label={`Custom collection for ${item.title}`}
      value=""
      onChange={(event) => {
        const [action, collectionId] = event.target.value.split(':');
        if (!collectionId) return;
        if (action === 'add') onAddToCollection(collectionId, item.id);
        if (action === 'remove') onRemoveFromCollection(collectionId, item.id);
      }}
    >
      <option value="">Collection</option>
      {collections.map((collection) => {
        const hasItem = collection.itemIds.includes(item.id);
        return (
          <option key={collection.id} value={`${hasItem ? 'remove' : 'add'}:${collection.id}`}>
            {hasItem ? 'Remove from' : 'Add to'} {collection.name}
          </option>
        );
      })}
    </select>
  );
}
