import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const releaseDirectory = path.resolve(process.cwd(), process.argv[2] ?? 'Releases');
const checksumName = 'SHA256SUMS.txt';

async function main() {
  const entries = await fs.readdir(releaseDirectory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name !== checksumName)
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    throw new Error(`No release files found in ${releaseDirectory}.`);
  }

  const lines = [];
  for (const fileName of files) {
    const filePath = path.join(releaseDirectory, fileName);
    const contents = await fs.readFile(filePath);
    const digest = crypto.createHash('sha256').update(contents).digest('hex').toUpperCase();
    lines.push(`${digest}  ${fileName}`);
  }

  await fs.writeFile(path.join(releaseDirectory, checksumName), `${lines.join('\n')}\n`, 'ascii');
  console.log(`Wrote ${checksumName} for ${files.length} release files.`);
  for (const line of lines) console.log(line);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
