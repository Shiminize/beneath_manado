import algorithmOfEnvySource from '../reader/books/algorithm-of-envy.js?raw';
import beneathManadoSource from '../reader/books/beneath-manado.js?raw';
import echoChamberSource from '../reader/books/echo-chamber.js?raw';
import structuralIntegrityOfWallsSource from '../reader/books/structural-integrity-of-walls.js?raw';
import sunriseHarvestSource from '../reader/books/sunrise-harvest.js?raw';
import theImposterSource from '../reader/books/the-imposter.js?raw';
import frictionSource from '../reader/data.js?raw';
import type { BookContent } from '../../app/types';

const imageModules = import.meta.glob('../../assets/images/**/*.{png,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

const imageUrlByLegacyPath = new Map(
  Object.entries(imageModules).map(([modulePath, url]) => {
    const legacyPath = `src/assets/images/${modulePath.split('../../assets/images/')[1]}`;
    return [legacyPath, url];
  })
);

interface LegacyWindow {
  PocketReader: {
    bookContent?: BookContent[];
  };
}

export function loadLegacyBookContent(source = frictionSource): BookContent[] {
  const legacyWindow: LegacyWindow = { PocketReader: {} };
  const pocketReader = legacyWindow.PocketReader;

  const execute = new Function(
    'window',
    'PocketReader',
    `${source}; return window.PocketReader.bookContent || PocketReader.bookContent || [];`
  ) as (windowRef: LegacyWindow, pocketRef: LegacyWindow['PocketReader']) => BookContent[];

  const content = execute(legacyWindow, pocketReader);

  return content.map((chapter, index) => ({
    ...chapter,
    chapter: typeof chapter.chapter === 'number' ? chapter.chapter : index,
    isChapterStart: chapter.isChapterStart ?? true,
    title: chapter.title || `Chapter ${index}`,
    content: rewriteLegacyAssetPaths(chapter.content || ''),
    cover: chapter.cover ? assetUrlFor(chapter.cover) : chapter.cover
  }));
}

export const frictionBookContent = loadLegacyBookContent();
export const algorithmOfEnvyContent = loadLegacyBookContent(algorithmOfEnvySource);
export const beneathManadoContent = loadLegacyBookContent(beneathManadoSource);
export const echoChamberContent = loadLegacyBookContent(echoChamberSource);
export const structuralIntegrityOfWallsContent = loadLegacyBookContent(structuralIntegrityOfWallsSource);
export const sunriseHarvestContent = loadLegacyBookContent(sunriseHarvestSource);
export const theImposterContent = loadLegacyBookContent(theImposterSource);

export function assetUrlFor(path: string): string {
  return imageUrlByLegacyPath.get(path.replace(/^\//, '')) || path;
}

function rewriteLegacyAssetPaths(html: string): string {
  return html.replace(/(["'])((?:\.\/)?src\/assets\/images\/[^"']+)\1/g, (match, quote: string, path: string) => {
    const normalized = path.replace(/^\.\//, '');
    return `${quote}${assetUrlFor(normalized)}${quote}`;
  });
}
