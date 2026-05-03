import type { LibraryItem } from '../../app/types';
import bookMetadata from './bookMetadata.json';
import { assetUrlFor } from './assets';

export const packagedLibrary: LibraryItem[] = bookMetadata.map(({ serverContentFile: _serverContentFile, serverContentKey: _serverContentKey, ...item }) => ({
  ...item,
  cover: assetUrlFor(item.cover),
  content: []
})) as LibraryItem[];

export function getLibraryItem(itemId: string): LibraryItem | undefined {
  return packagedLibrary.find((item) => item.id === itemId);
}
