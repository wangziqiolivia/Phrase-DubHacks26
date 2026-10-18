// Compile without starting Next.js, loading .env files, or calling providers.
const fs = require('node:fs');
const path = require('node:path');
const project = process.argv[2] || path.resolve(__dirname, '..');
const { transform, loadBindings } = require(path.join(project, 'node_modules/next/dist/build/swc'));
const { getLoaderSWCOptions } = require(path.join(project, 'node_modules/next/dist/build/swc/options'));
async function main() {
  await loadBindings();
  const filename = path.join(project, 'src/app/api/scene/route.ts');
  const source = fs.readFileSync(filename, 'utf8');
  for (const bundleLayer of ['rsc', 'app-pages-browser']) {
    const options = getLoaderSWCOptions({
      filename, development: true, isServer: bundleLayer === 'rsc',
      isPageFile: false, isCacheComponents: true, configDir: project,
      appDir: path.join(project, 'src/app'), relativeFilePathFromRoot: 'src/app/api/scene/route.ts',
      serverComponents: true, bundleLayer, esm: true,
      serverReferenceHashSalt: 'offline-test', pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
      useCacheEnabled: true, taintEnabled: false,
    });
    await transform(source, { ...options, filename });
  }
  console.log('Scene route compiled with Next.js SWC and Cache Components enabled (server and browser layers).');
}
main().catch((error) => { console.error(String(error)); process.exitCode = 1; });
