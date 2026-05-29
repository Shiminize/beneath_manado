import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/*
 * Folio geometry policy.
 *
 * The Folio system is built from hairline rules and small, crisp radii, with
 * pills reserved for the nav, toggles, and chip rails and full circles for
 * covers and avatars. Structure comes from borders, so normal-state borders
 * are allowed — raw border widths and colours are already blocked by
 * check:css-values, which keeps every stroke tokenised.
 *
 * This guard therefore enforces a single rule: every `border-radius` must come
 * from a semantic `--radius-*` token (or be `inherit` / `0`). Raw radius
 * lengths and percentages are caught by check:css-values.
 */

const activeRoots = ['src/styles'];
const targetExtensions = new Set(['.css']);
const approvedRawValueFiles = new Set([normalize('src/styles/tokens.css')]);
const radiusTokenPattern = /var\(\s*--radius-[a-z0-9-]+\s*\)/;
const allowedLiteralRadii = new Set(['inherit', '0']);

const files = [];
for (const root of activeRoots) {
  await collectFiles(root, files);
}

const violations = [];
for (const file of files) {
  const normalizedFile = normalize(file);
  if (approvedRawValueFiles.has(normalizedFile)) continue;

  const source = await readFile(file, 'utf8');
  const lines = source.split('\n');

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line.startsWith('border-radius:')) continue;

    const value = line.slice('border-radius:'.length).replace(/;.*$/, '').trim();
    if (allowedLiteralRadii.has(value)) continue;
    if (radiusTokenPattern.test(value)) continue;

    addViolation(
      normalizedFile,
      index,
      'non-semantic-radius',
      line,
      'Use a semantic --radius-* token (or inherit/0) for border-radius.'
    );
  }
}

const grouped = new Map();
for (const violation of violations) {
  const key = `${violation.file}:${violation.rule}`;
  grouped.set(key, (grouped.get(key) || 0) + 1);
}

console.log(`UI geometry scan: ${violations.length} geometry policy violations found outside approved token files.`);
for (const [key, count] of [...grouped.entries()].sort()) {
  console.log(`- ${key} (${count})`);
}

if (violations.length) {
  console.error('\nFirst violation examples:');
  for (const violation of violations.slice(0, 20)) {
    console.error(`${violation.file}:${violation.line} [${violation.rule}] ${violation.value} - ${violation.message}`);
  }
  process.exit(1);
}

async function collectFiles(root, output) {
  if (targetExtensions.has(path.extname(root))) {
    output.push(root);
    return;
  }

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, output);
      continue;
    }

    if (targetExtensions.has(path.extname(entry.name))) {
      output.push(fullPath);
    }
  }
}

function normalize(file) {
  return file.split(path.sep).join('/');
}

function addViolation(file, index, rule, value, message) {
  violations.push({
    file,
    line: index + 1,
    rule,
    value,
    message
  });
}
