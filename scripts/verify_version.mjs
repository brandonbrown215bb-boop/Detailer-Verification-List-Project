import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadataPath = path.join(root, 'version.json');
const packagePath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');

const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const lockJson = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const errors = [];
const args = process.argv.slice(2);

if (!semverPattern.test(metadata.version)) {
  errors.push(`version.json version is not SemVer: ${metadata.version}`);
}
if (!/^\d+\.\d+$/.test(metadata.dvlFormatVersion)) {
  errors.push(`version.json dvlFormatVersion must be major.minor: ${metadata.dvlFormatVersion}`);
}
if (typeof metadata.documentSchemaVersion !== 'string' || metadata.documentSchemaVersion.trim() === '') {
  errors.push('version.json documentSchemaVersion must be a non-empty source-document schema identity.');
}
if (packageJson.version !== metadata.version) {
  errors.push(`package.json version ${packageJson.version} does not match version ${metadata.version}.`);
}
if (lockJson.version !== metadata.version || lockJson.packages?.['']?.version !== metadata.version) {
  errors.push('package-lock.json root version does not match version.json version.');
}

const expected = args.find((arg, index) => arg === '--expected' && args[index + 1])
  ? args[args.indexOf('--expected') + 1]
  : null;
if (expected && !semverPattern.test(expected)) {
  errors.push(`Requested release version is not SemVer: ${expected}`);
}
if (expected && expected !== metadata.version) {
  errors.push(`Requested release version ${expected} does not match authoritative version ${metadata.version}. Update version.json and package metadata before tagging or dispatching a release.`);
}
const injected = process.env.VITE_APP_VERSION?.trim();
if (injected && injected !== metadata.version) {
  errors.push(`VITE_APP_VERSION ${injected} does not match authoritative version ${metadata.version}.`);
}

if (args.includes('--check-dist')) {
  const distPath = path.join(root, 'dist');
  if (!fs.existsSync(distPath)) {
    errors.push(`Cannot check built frontend identity because ${distPath} does not exist.`);
  } else {
    const builtFiles = [];
    const visit = directory => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(entryPath);
        else if (/\.(?:html|js|css)$/i.test(entry.name)) builtFiles.push(entryPath);
      }
    };
    visit(distPath);
    const expectedBuiltVersion = expected || metadata.version;
    if (!builtFiles.some(file => fs.readFileSync(file, 'utf8').includes(expectedBuiltVersion))) {
      errors.push(`Built frontend does not contain the expected application version ${expectedBuiltVersion}. Rebuild with the authoritative version metadata.`);
    }
  }
}

const publishDirectories = args.flatMap((arg, index) => arg === '--publish-dir' && args[index + 1] ? [args[index + 1]] : []);
for (const directory of publishDirectories) {
  const publishedMetadataPath = path.resolve(root, directory, 'version.json');
  if (!fs.existsSync(publishedMetadataPath)) {
    errors.push(`Published output is missing version.json: ${publishedMetadataPath}`);
    continue;
  }
  const published = JSON.parse(fs.readFileSync(publishedMetadataPath, 'utf8'));
  if (published.version !== metadata.version || published.dvlFormatVersion !== metadata.dvlFormatVersion || published.documentSchemaVersion !== metadata.documentSchemaVersion) {
    errors.push(`Published version metadata does not match version.json: ${publishedMetadataPath}`);
  }
  if (expected && published.version !== expected) {
    errors.push(`Published application version ${published.version} does not match requested release ${expected}: ${publishedMetadataPath}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Version metadata is consistent: app ${metadata.version}, DVL ${metadata.dvlFormatVersion}, document schema ${metadata.documentSchemaVersion}`);
