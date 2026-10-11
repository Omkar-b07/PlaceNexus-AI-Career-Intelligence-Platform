import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assignLegacyResume, getLegacyResumePreview, listLegacyResumes } from '../src/services/legacyResumeService.js';
import { requireAdmin } from '../src/middleware/requireAdmin.js';

const firstFile = '123e4567-e89b-12d3-a456-426614174000.pdf';
const secondFile = '123e4567-e89b-12d3-a456-426614174001.pdf';
const parsedResumeText = 'Built React user interfaces and Node.js APIs with MongoDB.';

function valueAt(document, dottedKey) {
  return dottedKey.split('.').reduce((value, key) => value && value[key], document);
}

function matches(document, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    const value = valueAt(document, key);
    if (expected && typeof expected === 'object' && '$exists' in expected) return expected.$exists ? value !== undefined : value === undefined;
    return value === expected;
  });
}

function setAt(document, dottedKey, value) {
  const keys = dottedKey.split('.');
  const last = keys.pop();
  const parent = keys.reduce((current, key) => (current[key] ||= {}), document);
  parent[last] = value;
}

function unsetAt(document, dottedKey) {
  const keys = dottedKey.split('.');
  const last = keys.pop();
  const parent = keys.reduce((current, key) => current?.[key], document);
  if (parent) delete parent[last];
}

function memoryProfiles(records) {
  return {
    records,
    find(filter) { return { toArray: async () => records.filter((record) => matches(record, filter)) }; },
    async findOne(filter) { return records.find((record) => matches(record, filter)) || null; },
    async updateOne(filter, update, options = {}) {
      let record = records.find((candidate) => matches(candidate, filter));
      if (!record && options.upsert) {
        record = { userId: filter.userId };
        records.push(record);
      }
      if (!record) return { matchedCount: 0 };
      for (const [key, value] of Object.entries(update.$set || {})) setAt(record, key, value);
      for (const key of Object.keys(update.$unset || {})) unsetAt(record, key);
      return { matchedCount: 1 };
    }
  };
}

function memoryAssignments(records = []) {
  return {
    records,
    find(filter) { return { toArray: async () => records.filter((record) => matches(record, filter)) }; },
    async findOne(filter) { return records.find((record) => matches(record, filter)) || null; },
    async insertOne(record) {
      if (records.some((candidate) => candidate.legacyResumeId === record.legacyResumeId)) throw { code: 11000 };
      records.push({ ...record });
      return { insertedId: record.legacyResumeId };
    },
    async updateOne(filter, update) {
      const record = records.find((candidate) => matches(candidate, filter));
      if (!record) return { matchedCount: 0 };
      for (const [key, value] of Object.entries(update.$set || {})) setAt(record, key, value);
      for (const key of Object.keys(update.$unset || {})) unsetAt(record, key);
      return { matchedCount: 1 };
    },
    async deleteOne(filter) {
      const index = records.findIndex((record) => matches(record, filter));
      if (index >= 0) records.splice(index, 1);
      return { deletedCount: index >= 0 ? 1 : 0 };
    }
  };
}

async function fixture(t, files = [firstFile]) {
  const resumeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'placex-legacy-resumes-'));
  await Promise.all(files.map((file) => fs.writeFile(path.join(resumeDirectory, file), 'legacy resume fixture')));
  t.after(() => fs.rm(resumeDirectory, { recursive: true, force: true }));
  const profiles = memoryProfiles([{ userId: 'student-1', fullName: 'Student One' }]);
  const users = { async findOne(query) { return query._id === 'student-1' ? { _id: 'student-1', role: 'STUDENT' } : null; } };
  const assignments = memoryAssignments();
  return { resumeDirectory, profiles, users, assignments };
}

function serviceOptions(state, extra = {}) {
  return {
    profilesCollection: state.profiles,
    usersCollection: state.users,
    assignmentsCollection: state.assignments,
    resumeDirectory: state.resumeDirectory,
    extractText: async () => parsedResumeText,
    generateJson: async () => ({ skills: ['React', 'Node.js', 'MongoDB'], tools: [], technologies: [], frameworks: [], projects: [], experience: [], certifications: [] }),
    ...extra
  };
}

function middlewareResult(role) {
  return new Promise((resolve) => requireAdmin({ user: { role } }, {}, (error) => resolve(error || null)));
}

test('limits legacy inventory access to TPO/admin roles', async () => {
  assert.equal(await middlewareResult('TPO'), null);
  assert.equal(await middlewareResult('ADMIN'), null);
  const error = await middlewareResult('STUDENT');
  assert.equal(error?.code, 'ADMIN_ACCESS_REQUIRED');
  assert.equal(error?.statusCode, 403);
});

test('lists and previews only safe metadata for unlinked legacy files', async (t) => {
  const state = await fixture(t);
  const items = await listLegacyResumes(serviceOptions(state));

  assert.equal(items.length, 1);
  assert.deepEqual(Object.keys(items[0]).sort(), ['fileType', 'legacyResumeId', 'mimeType', 'modifiedAt', 'originalName', 'size', 'status']);
  assert.equal(items[0].legacyResumeId, firstFile);
  assert.equal(items[0].originalName, null);
  assert.equal(items[0].status, 'UNLINKED');
  assert.equal(JSON.stringify(items).includes(parsedResumeText), false);

  const preview = await getLegacyResumePreview(firstFile, serviceOptions(state));
  assert.equal(preview.filePath, path.join(state.resumeDirectory, firstFile));
  assert.equal(preview.metadata.mimeType, 'application/pdf');
});

test('manually reattaches a selected legacy file as the canonical profile resume and audits it', async (t) => {
  const state = await fixture(t);
  let analysisCalls = 0;
  const result = await assignLegacyResume({
    legacyResumeId: firstFile, studentId: 'student-1', assignedBy: 'tpo-1', confirmed: true
  }, serviceOptions(state, { generateJson: async () => { analysisCalls += 1; return { skills: ['React', 'Node.js', 'MongoDB'], tools: [], technologies: [], frameworks: [], projects: [], experience: [], certifications: [] }; } }));

  const profile = state.profiles.records[0];
  assert.equal(result.analysisStatus, 'READY');
  assert.equal(analysisCalls, 1);
  assert.equal(profile.resume.id, firstFile);
  assert.equal(profile.resume.resumeText, parsedResumeText);
  assert.equal(profile.resume.parseStatus, 'READY');
  assert.match(profile.resume.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(profile.resumeAnalysis.status, 'READY');
  assert.deepEqual(state.assignments.records[0] && {
    legacyResumeId: state.assignments.records[0].legacyResumeId,
    studentId: state.assignments.records[0].studentId,
    assignedBy: state.assignments.records[0].assignedBy,
    action: state.assignments.records[0].action,
    status: state.assignments.records[0].status
  }, { legacyResumeId: firstFile, studentId: 'student-1', assignedBy: 'tpo-1', action: 'RESUME_REATTACHED', status: 'ASSIGNED' });
  assert.deepEqual(await listLegacyResumes(serviceOptions(state)), []);
});

test('requires explicit replacement and prevents duplicate legacy assignment', async (t) => {
  const state = await fixture(t, [firstFile, secondFile]);
  state.profiles.records[0].resume = { id: 'existing.pdf', updatedAt: '2026-10-01T00:00:00.000Z', sourceHash: 'old-hash' };
  await assert.rejects(
    () => assignLegacyResume({ legacyResumeId: firstFile, studentId: 'student-1', assignedBy: 'tpo-1', confirmed: true }, serviceOptions(state)),
    { code: 'STUDENT_RESUME_EXISTS' }
  );
  assert.equal(state.profiles.records[0].resume.id, 'existing.pdf');
  assert.equal(state.assignments.records.length, 0);

  await assert.rejects(
    () => assignLegacyResume({ legacyResumeId: firstFile, studentId: 'student-1', assignedBy: 'tpo-1', replaceExisting: true, confirmed: false }, serviceOptions(state)),
    { code: 'REATTACHMENT_CONFIRMATION_REQUIRED' }
  );
  await assignLegacyResume({ legacyResumeId: firstFile, studentId: 'student-1', assignedBy: 'tpo-1', replaceExisting: true, confirmed: true }, serviceOptions(state));
  assert.equal(state.profiles.records[0].resume.id, firstFile);

  await assert.rejects(
    () => assignLegacyResume({ legacyResumeId: firstFile, studentId: 'student-1', assignedBy: 'tpo-2', confirmed: true }, serviceOptions(state)),
    { code: 'LEGACY_RESUME_ALREADY_ASSIGNED' }
  );
});

test('does not attach a file when its unique assignment reservation loses a concurrent race', async (t) => {
  const state = await fixture(t);
  state.assignments.insertOne = async () => { throw { code: 11000 }; };
  await assert.rejects(
    () => assignLegacyResume({ legacyResumeId: firstFile, studentId: 'student-1', assignedBy: 'tpo-1', confirmed: true }, serviceOptions(state)),
    { code: 'LEGACY_RESUME_ALREADY_ASSIGNED' }
  );
  assert.equal(state.profiles.records[0].resume, undefined);
});
