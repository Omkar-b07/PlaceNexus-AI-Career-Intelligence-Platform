import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { csvRecords, dsaDocument, importDsaCsv } from '../src/services/dsaImportService.js';
import { dsaListQuery } from '../src/controllers/dsaController.js';
import { activityFromProgress, streaksFromActivity } from '../src/services/dsaProgressService.js';

const csv = 'problemId,title,difficulty,topics,leetcodeUrl\n1,"Array, Intro",Easy,Array; Hash Table,https://leetcode.com/problems/two-sum/\n2,No URL,Medium,,\n';

test('reads the supplied DSA CSV structure and preserves optional fields', () => {
  const { headers, records } = csvRecords(csv);
  assert.deepEqual(headers, ['problemId', 'title', 'difficulty', 'topics', 'leetcodeUrl']);
  assert.equal(records[0].values.title, 'Array, Intro');
  assert.deepEqual(dsaDocument(records[0].values).topics, ['Array', 'Hash Table']);
  assert.equal(dsaDocument(records[1].values).url, null);
});

test('the supplied DSA dataset has 2,800 unique stable problem IDs', async () => {
  const { records } = csvRecords(await readFile(new URL('../../shared/dsa_problems_clean.csv', import.meta.url), 'utf8'));
  assert.equal(records.length, 2800);
  assert.equal(new Set(records.map((record) => record.values.problemId)).size, records.length);
});

test('rejects malformed DSA rows and missing required CSV columns', () => {
  assert.throws(() => csvRecords('title,difficulty\nExample,Easy\n'), /problemId/);
  assert.throws(() => dsaDocument({ problemId: '1', title: 'Example', difficulty: 'Easy', leetcodeUrl: 'not-a-url' }), /valid http/);
});

test('imports idempotently using the dataset problem ID', async () => {
  const operations = [];
  const collection = { bulkWrite: async (writes) => { operations.push(...writes); return { upsertedCount: writes.length, matchedCount: 0 }; } };
  const first = await importDsaCsv(csv, collection);
  assert.equal(first.inserted, 2);
  assert.equal(first.skipped, 0);
  assert.equal(operations[0].updateOne.filter.externalId, '1');
  const duplicate = await importDsaCsv('problemId,title,difficulty,topics,leetcodeUrl\n1,One,Easy,,\n1,One again,Easy,,\n', collection);
  assert.equal(duplicate.duplicatesPrevented, 1);
});

test('builds validated server-side DSA filters and pagination', () => {
  assert.deepEqual(dsaListQuery({ search: 'array+', difficulty: 'Easy', topic: 'Array', status: 'solved', page: '2', limit: '10' }), { filter: { title: { $regex: 'array\\+', $options: 'i' }, difficulty: 'Easy', topics: 'Array' }, page: 2, limit: 10, status: 'solved' });
  assert.throws(() => dsaListQuery({ page: '0' }), /page/);
  assert.throws(() => dsaListQuery({ limit: '101' }), /limit/);
  assert.throws(() => dsaListQuery({ topic: '' }), /topic/);
  assert.throws(() => dsaListQuery({ status: 'pending' }), /status/);
});

test('derives day-level activity and streaks from student-specific solved problem references', () => {
  const activity = activityFromProgress({ solvedProblems: [{ problemId: '1', date: '2026-09-28' }, { problemId: '2', date: '2026-09-28' }, { problemId: '3', date: '2026-09-29' }, { problemId: '4', date: '2026-10-01' }] });
  assert.deepEqual(activity, [{ date: '2026-09-28', solvedCount: 2 }, { date: '2026-09-29', solvedCount: 1 }, { date: '2026-10-01', solvedCount: 1 }]);
  const result = streaksFromActivity(activity, new Date('2026-10-01T12:00:00.000Z'));
  assert.equal(result.longestStreak, 2);
  assert.equal(result.currentStreak, 1);
});

test('keeps yesterday’s streak active but resets it after a missed calendar day', () => {
  const reference = new Date('2026-10-03T12:00:00.000Z');
  assert.equal(streaksFromActivity([{ date: '2026-10-01', solvedCount: 1 }, { date: '2026-10-02', solvedCount: 4 }], reference).currentStreak, 2);
  assert.equal(streaksFromActivity([{ date: '2026-09-30', solvedCount: 1 }], reference).currentStreak, 0);
});
