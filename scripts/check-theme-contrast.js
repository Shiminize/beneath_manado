import { readFile } from 'node:fs/promises';

const tokenSource = await readFile('src/styles/tokens.css', 'utf8');
const tokens = new Map([...tokenSource.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));

/*
 * Folio has one app identity plus three reader themes (light / dark / contrast).
 * Every pair below reads solid-hex raw tokens from tokens.css, so there is no
 * palette list to keep in sync — adding a theme means adding its raw tokens here.
 */
const pairs = [
  // App chrome (Folio light)
  ['ink', 'bg-app', 4.5, 'primary text on app background'],
  ['ink', 'bg-panel', 4.5, 'primary text on panel'],
  ['ink', 'bg-panel-soft', 4.5, 'primary text on soft panel'],
  ['ink', 'bg-chip', 4.5, 'primary text on chip'],
  ['ink-muted', 'bg-app', 4.5, 'muted text on app background'],
  ['ink-muted', 'bg-panel', 4.5, 'muted text on panel'],
  ['ink-muted', 'bg-chip', 4.5, 'muted text on chip'],
  ['ivory', 'accent', 4.5, 'action label on claret accent'],
  ['accent', 'bg-app', 3, 'accent control on app background'],
  ['accent', 'bg-panel', 3, 'accent control on panel'],

  // Reader — light
  ['reader-text-ink', 'bg-reader', 4.5, 'reader text on light page'],
  ['reader-text-ink', 'bg-panel', 4.5, 'reader text on light panel'],
  ['ink-muted', 'bg-reader', 4.5, 'reader muted text on light page'],

  // Reader — dark
  ['reader-dark-text', 'reader-dark-bg', 4.5, 'reader text on dark page'],
  ['reader-dark-text', 'reader-dark-panel', 4.5, 'reader text on dark panel'],
  ['reader-dark-muted', 'reader-dark-bg', 4.5, 'reader muted text on dark page'],
  ['reader-dark-muted', 'reader-dark-panel', 4.5, 'reader muted text on dark panel'],
  ['reader-dark-accent', 'reader-dark-bg', 3, 'reader accent on dark page'],

  // Reader — high contrast
  ['reader-contrast-text', 'reader-contrast-bg', 4.5, 'reader text on high-contrast page'],
  ['reader-contrast-muted', 'reader-contrast-bg', 4.5, 'reader muted text on high-contrast page']
];

const violations = [];

for (const [foregroundKey, backgroundKey, minimum, label] of pairs) {
  const foreground = token(foregroundKey);
  const background = token(backgroundKey);
  const ratio = contrastRatio(foreground, background);
  if (ratio < minimum) {
    violations.push({ label, foregroundName: `--${foregroundKey}`, foreground, backgroundName: `--${backgroundKey}`, background, minimum, ratio });
  }
}

console.log(`Theme contrast scan: ${violations.length} contrast violations found.`);

if (violations.length) {
  for (const violation of violations) {
    console.error(
      `- ${violation.label}: ${violation.ratio.toFixed(2)}:1, expected >= ${violation.minimum}:1 ` +
        `(${violation.foregroundName} ${violation.foreground} on ${violation.backgroundName} ${violation.background})`
    );
  }
  process.exit(1);
}

function token(name) {
  const value = tokens.get(name);
  if (!value) {
    throw new Error(`Missing token --${name}`);
  }
  return value;
}

function contrastRatio(foreground, background) {
  const foregroundLum = relativeLuminance(parseHexColor(foreground));
  const backgroundLum = relativeLuminance(parseHexColor(background));
  return (Math.max(foregroundLum, backgroundLum) + 0.05) / (Math.min(foregroundLum, backgroundLum) + 0.05);
}

function parseHexColor(value) {
  const match = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    throw new Error(`Expected a solid hex color for contrast scan, received "${value}"`);
  }

  const hex = match[1].length === 3 ? match[1].replace(/./g, (character) => character + character) : match[1];
  return [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
}

function relativeLuminance([red, green, blue]) {
  const [linearRed, linearGreen, linearBlue] = [red, green, blue].map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
}
