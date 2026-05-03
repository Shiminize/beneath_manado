import type { LibraryItem } from '../../app/types';
import {
  algorithmOfEnvyContent,
  assetUrlFor,
  beneathManadoContent,
  echoChamberContent,
  frictionBookContent,
  structuralIntegrityOfWallsContent,
  sunriseHarvestContent,
  theImposterContent
} from './legacyCartridge';

export const packagedLibrary: LibraryItem[] = [
  {
    id: 'friction-of-the-spark',
    type: 'book',
    title: 'The Friction of the Spark',
    author: 'Shiminize',
    subtitle: 'Dark romantic suspense tragedy',
    cover: assetUrlFor('src/assets/images/cover.jpg'),
    description: 'Control, survival, grief, and the cost of choosing friction over silence.',
    section: 'Continue',
    tags: ['dark romantic suspense', 'tragedy', 'survival', 'finished manuscript'],
    totalChapters: frictionBookContent.length,
    content: frictionBookContent,
    initialStatus: 'reading'
  },
  {
    id: 'algorithm-of-envy',
    type: 'book',
    title: 'The Algorithm of Envy',
    author: 'Shiminize',
    subtitle: 'Digital psychological thriller',
    cover: assetUrlFor('src/assets/images/books/algorithm-of-envy/cover.jpg'),
    description: 'A social algorithm, a rejected obsession, and the data trail left by envy.',
    section: 'Imported Novels',
    tags: ['psychological thriller', 'algorithmic obsession', 'digital intimacy'],
    totalChapters: algorithmOfEnvyContent.length,
    content: algorithmOfEnvyContent,
    initialStatus: 'want-to-read'
  },
  {
    id: 'echo-chamber',
    type: 'book',
    title: 'The Echo Chamber',
    author: 'Shiminize',
    subtitle: 'Voice-room psychological horror',
    cover: assetUrlFor('src/assets/images/books/echo-chamber/cover.png'),
    description: 'A digital room turns unstable as projection, surveillance, and identity fold into one another.',
    section: 'Imported Novels',
    tags: ['psychological horror', 'voice room', 'digital identity'],
    totalChapters: echoChamberContent.length,
    content: echoChamberContent,
    initialStatus: 'want-to-read'
  },
  {
    id: 'sunrise-harvest',
    type: 'book',
    title: 'The Sunrise Harvest',
    author: 'Shiminize',
    subtitle: 'Tropical psychological horror',
    cover: assetUrlFor('src/assets/images/books/sunrise-harvest/cover.jpg'),
    description: 'A Manado heatwave of ritual, hunger, and digital residue.',
    section: 'Imported Novels',
    tags: ['Manado', 'psychological horror', 'ritual'],
    totalChapters: sunriseHarvestContent.length,
    content: sunriseHarvestContent,
    initialStatus: 'want-to-read'
  },
  {
    id: 'structural-integrity-of-walls',
    type: 'book',
    title: 'The Structural Integrity of Walls',
    author: 'Shiminize',
    subtitle: 'Psychological suspense',
    cover: assetUrlFor('src/assets/images/books/structural-integrity-of-walls/cover.png'),
    description: 'A private chat becomes a test of safety, pressure, and everything people build to stay intact.',
    section: 'Imported Novels',
    tags: ['psychological suspense', 'digital intimacy', 'collapse'],
    totalChapters: structuralIntegrityOfWallsContent.length,
    content: structuralIntegrityOfWallsContent,
    initialStatus: 'want-to-read'
  },
  {
    id: 'beneath-manado',
    type: 'book',
    title: 'Beneath Manado',
    author: 'Shiminize',
    subtitle: 'Literary psychological horror',
    cover: assetUrlFor('src/assets/images/books/beneath-manado/cover.jpg'),
    description: 'A long-form Manado novel about rejection, performance, and the body under social pressure.',
    section: 'Imported Novels',
    tags: ['Manado', 'literary horror', 'social pressure'],
    totalChapters: beneathManadoContent.length,
    content: beneathManadoContent,
    initialStatus: 'want-to-read'
  },
  {
    id: 'the-imposter',
    type: 'book',
    title: 'The Imposter',
    author: 'Shiminize',
    subtitle: 'Identity psychological thriller',
    cover: assetUrlFor('src/assets/images/books/the-imposter/cover.png'),
    description: 'A retreat story of identity fracture, social masks, and the person no one can quite locate.',
    section: 'Imported Novels',
    tags: ['identity', 'psychological thriller', 'retreat'],
    totalChapters: theImposterContent.length,
    content: theImposterContent,
    initialStatus: 'want-to-read'
  },
  {
    id: 'structural-audit-pdf',
    type: 'pdf',
    title: 'Structural Audit Notes',
    author: 'Project file',
    subtitle: 'PDF-style project reference',
    cover: assetUrlFor('src/assets/images/TheStructuralIntegrityofWalls.png'),
    description: 'A packaged reference item for the Library PDF collection.',
    section: 'PDFs',
    tags: ['pdf', 'reference', 'structure'],
    totalChapters: 1,
    content: [
      {
        chapter: 1,
        isChapterStart: true,
        title: 'Structural Audit Notes',
        content:
          '<p>This packaged reference item keeps the PDF collection functional in the no-upload V1 app.</p><p>Cloud uploads and imported documents are deferred until backend storage and privacy rules are defined.</p>'
      }
    ],
    initialStatus: 'want-to-read'
  },
  {
    id: 'sample-reader-entry',
    type: 'sample',
    title: 'Reader Sample',
    author: 'Pocket Reader',
    subtitle: 'Sample collection entry',
    cover: assetUrlFor('src/assets/images/TheSunriseHarvest.png'),
    description: 'A short packaged sample used to validate samples, suggestions, and custom collections.',
    section: 'Samples',
    tags: ['sample', 'library', 'reader'],
    totalChapters: 1,
    content: [
      {
        chapter: 1,
        isChapterStart: true,
        title: 'Reader Sample',
        content:
          '<p>This sample verifies that packaged samples can be filtered, opened, and tracked without adding a Book Store or account system.</p>'
      }
    ],
    initialStatus: 'new'
  }
];

export function getLibraryItem(itemId: string): LibraryItem | undefined {
  return packagedLibrary.find((item) => item.id === itemId);
}
