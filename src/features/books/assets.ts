const imageModules = import.meta.glob('../../assets/images/**/*.{png,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

const imageUrlByLegacyPath = new Map(
  Object.entries(imageModules).map(([modulePath, url]) => {
    const relativePath = modulePath.split('assets/images/')[1];
    const legacyPath = `src/assets/images/${relativePath}`;
    return [legacyPath, url];
  })
);

export function assetUrlFor(path: string): string {
  return imageUrlByLegacyPath.get(path.replace(/^\//, '')) || path;
}

export function rewriteLegacyAssetPaths(html: string): string {
  return html.replace(/(["'])((?:\.\/|\/)?src\/assets\/images\/[^"']+)\1/g, (_match, quote: string, path: string) => {
    const normalized = path.replace(/^(?:\.\/|\/)/, '');
    return `${quote}${assetUrlFor(normalized)}${quote}`;
  });
}
