import { createHash } from 'node:crypto';

const REQUIRED_COLUMNS = ['problemId', 'title', 'difficulty'];

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += character;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

export function csvRecords(text) {
  const rows = parseCsv(text);
  const headers = rows.shift()?.map((header) => header.trim()) || [];
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) throw new Error(`CSV is missing required column(s): ${missing.join(', ')}.`);
  return { headers, records: rows.filter((row) => row.some((value) => value.trim())).map((row, rowIndex) => ({ line: rowIndex + 2, values: Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])) })) };
}

function optionalUrl(value) {
  const url = value.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch { return null; }
}

function topicsFrom(value) {
  return [...new Set(value.split(/[|;,/]/).map((topic) => topic.trim()).filter(Boolean))];
}

export function dsaDocument(values) {
  const problemId = values.problemId.trim();
  const title = values.title.trim();
  const difficulty = values.difficulty.trim();
  if (!title || !difficulty) throw new Error('title and difficulty are required.');
  const externalId = problemId || createHash('sha256').update(`${title.toLocaleLowerCase()}|${difficulty.toLocaleLowerCase()}|${values.leetcodeUrl.trim()}`).digest('hex');
  const url = optionalUrl(values.leetcodeUrl || '');
  if (values.leetcodeUrl?.trim() && !url) throw new Error('leetcodeUrl must be a valid http or https URL.');
  return { externalId, title, difficulty, topics: topicsFrom(values.topics || ''), url, source: url ? 'LeetCode' : null };
}

export async function importDsaCsv(text, collection) {
  const { records } = csvRecords(text);
  const stats = { rowsRead: records.length, inserted: 0, updated: 0, skipped: 0, duplicatesPrevented: 0, errors: [] };
  const operations = [];
  const seen = new Set();
  for (const record of records) {
    try {
      const document = dsaDocument(record.values);
      if (seen.has(document.externalId)) { stats.duplicatesPrevented += 1; continue; }
      seen.add(document.externalId);
      operations.push({ updateOne: { filter: { externalId: document.externalId }, update: { $set: { ...document, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, upsert: true } });
    } catch (error) {
      stats.skipped += 1;
      stats.errors.push(`Line ${record.line}: ${error.message}`);
    }
  }
  if (operations.length) {
    const result = await collection.bulkWrite(operations, { ordered: false });
    stats.inserted = result.upsertedCount;
    stats.updated = result.matchedCount;
  }
  return stats;
}
