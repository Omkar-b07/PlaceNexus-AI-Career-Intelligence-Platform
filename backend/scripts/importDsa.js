import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { importDsaCsv } from '../src/services/dsaImportService.js';
import { getDsaProblemsCollection } from '../src/services/preparationDatabase.js';

const directory = dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(directory, '../../shared/dsa_problems_clean.csv');

try {
  console.log('DSA import started...');
  const stats = await importDsaCsv(await readFile(csvPath, 'utf8'), await getDsaProblemsCollection());
  console.log(`Rows read: ${stats.rowsRead}`);
  console.log(`Inserted: ${stats.inserted}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Duplicates prevented: ${stats.duplicatesPrevented}`);
  if (stats.errors.length) console.error(`Invalid rows:\n${stats.errors.join('\n')}`);
  console.log('DSA import completed.');
  if (stats.errors.length) process.exitCode = 1;
} catch (error) {
  console.error(`DSA import failed: ${error.message}`);
  process.exitCode = 1;
}
