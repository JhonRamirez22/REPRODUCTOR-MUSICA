import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

const root = process.cwd();
const webRoot = join(root, 'web', 'dist');
const migrationsRoot = join(root, 'server', 'migrations');
const outputPath = join(root, 'server', 'dist', 'vercel-bundle.js');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return filesUnder(path);
      return entry.isFile() ? [path] : [];
    }),
  );
  return nested.flat().sort();
}

const assetPaths = await filesUnder(webRoot);
if (!assetPaths.some((path) => relative(webRoot, path) === 'index.html')) {
  throw new Error('web/dist/index.html is required for a Vercel build.');
}

const webAssets = Object.fromEntries(
  await Promise.all(
    assetPaths.map(async (path) => {
      const assetPath = relative(webRoot, path).split(sep).join('/');
      const contentType = contentTypes[extname(path).toLowerCase()] ?? 'application/octet-stream';
      const data = (await readFile(path)).toString('base64');
      return [assetPath, { contentType, data }];
    }),
  ),
);

const migrationPaths = (await filesUnder(migrationsRoot)).filter((path) =>
  /^\d+_[a-z0-9_-]+\.sql$/i.test(relative(migrationsRoot, path)),
);
const bundledMigrations = Object.fromEntries(
  await Promise.all(
    migrationPaths.map(async (path) => [
      relative(migrationsRoot, path),
      await readFile(path, 'utf8'),
    ]),
  ),
);

await mkdir(join(root, 'server', 'dist'), { recursive: true });
await writeFile(
  outputPath,
  `export const webAssets = ${JSON.stringify(webAssets)};\nexport const bundledMigrations = ${JSON.stringify(bundledMigrations)};\n`,
);
