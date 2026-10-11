import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeResumeText, ensureResumeAnalysis, normalizeResumeAnalysis, resumeAvailabilityState, resumeEvidenceSkills, resumeTextHash } from '../src/services/resumeAnalysisService.js';

const resumeText = 'Built React and Node.js REST APIs with MongoDB. Used Git and Docker for a capstone project.';

function extraction(overrides = {}) {
  return {
    skills: ['React', 'NodeJS', 'MongoDB', 'REST APIs', 'Git'],
    tools: ['Docker'],
    technologies: ['React', 'Node.js', 'MongoDB'],
    frameworks: ['React'],
    projects: [{ name: 'Capstone', technologies: ['React', 'Node.js'] }],
    experience: ['Built REST APIs using Node.js.'],
    certifications: [],
    ...overrides
  };
}

function profile(text = resumeText, analysis = null) {
  return {
    userId: 'student-1',
    resume: { resumeText: text, sourceHash: resumeTextHash(text) },
    resumeAnalysis: analysis
  };
}

test('normalizes resume evidence with the centralized catalog while preserving Java distinctions', () => {
  const result = normalizeResumeAnalysis(extraction({ skills: ['JavaScript', 'nodejs', 'Java'] }), resumeText);
  assert.deepEqual(result.skills, ['JavaScript', 'Node.js', 'Java']);
  assert.deepEqual(resumeEvidenceSkills({ status: 'READY', ...result }), ['JavaScript', 'Node.js', 'Java', 'Docker', 'React', 'MongoDB']);
});

test('drops unsupported Gemini labels without inventing a profile-skill fallback', () => {
  const result = normalizeResumeAnalysis(extraction({ skills: ['React', 'Problem Solving'], tools: ['Hobbies'] }), resumeText);
  assert.deepEqual(result.skills, ['React']);
  assert.deepEqual(result.tools, []);
});

test('extracts structured resume information through a supplied Gemini transport only', async () => {
  let prompt = '';
  const result = await analyzeResumeText(resumeText, async (value) => { prompt = value; return extraction(); });
  assert.equal(result.status, 'READY');
  assert.equal(result.resumeHash, resumeTextHash(resumeText));
  assert.deepEqual(result.projects, [{ name: 'Capstone', technologies: ['React', 'Node.js'] }]);
  assert.match(prompt, /never invent skills/i);
  assert.match(prompt, /Java and JavaScript are different/i);
});

test('reuses a hash-matched cached resume extraction and invalidates it when resume text changes', async () => {
  let calls = 0;
  const writes = [];
  const collection = { async updateOne(filter, update) { writes.push({ filter, update }); } };
  const generateJson = async () => { calls += 1; return extraction(); };

  const first = await ensureResumeAnalysis(profile(), { generateJson, profilesCollection: collection });
  assert.equal(calls, 1);
  assert.equal(first.resumeAnalysis.status, 'READY');
  assert.equal(writes.length, 1);

  const cached = await ensureResumeAnalysis(first, { generateJson, profilesCollection: collection });
  assert.equal(calls, 1);
  assert.equal(cached.resumeAnalysis.resumeHash, first.resume.sourceHash);

  const changedText = 'Built React, Node.js, and REST APIs. Used Docker.';
  const changed = await ensureResumeAnalysis(profile(changedText, first.resumeAnalysis), { generateJson, profilesCollection: collection });
  assert.equal(calls, 2);
  assert.equal(changed.resumeAnalysis.resumeHash, resumeTextHash(changedText));
  assert.equal(writes.length, 2);
});

test('stores a failed extraction as a hash-matched unavailable state without exposing resume text', async () => {
  const collection = { async updateOne() {} };
  const result = await ensureResumeAnalysis(profile(), { generateJson: async () => { throw new Error('service unavailable'); }, profilesCollection: collection });
  assert.equal(result.resumeAnalysis.status, 'FAILED');
  assert.equal(JSON.stringify(result.resumeAnalysis).includes(resumeText), false);
  assert.ok(result.resumeAnalysis.retryAfter);
});

test('retries legacy failed analysis records that were cached without a retry window', async () => {
  let calls = 0;
  const staleFailure = { status: 'FAILED', resumeHash: resumeTextHash(resumeText), failureCode: 'RESUME_ANALYSIS_INVALID' };
  const result = await ensureResumeAnalysis(profile(resumeText, staleFailure), {
    generateJson: async () => { calls += 1; return extraction(); },
    profilesCollection: { async updateOne() {} }
  });
  assert.equal(calls, 1);
  assert.equal(result.resumeAnalysis.status, 'READY');
});

test('recovers a persisted UUID-backed resume through the existing parser when parsed text is absent', async () => {
  const updates = [];
  const storedProfile = {
    userId: 'student-2',
    resume: { id: '123e4567-e89b-12d3-a456-426614174000.pdf', originalName: 'resume.pdf', fileType: 'PDF' }
  };
  const result = await ensureResumeAnalysis(storedProfile, {
    extractText: async (filePath) => { assert.match(filePath, /123e4567-e89b-12d3-a456-426614174000\.pdf$/); return resumeText; },
    generateJson: async () => extraction(),
    profilesCollection: { async updateOne(filter, update) { updates.push({ filter, update }); } }
  });
  assert.equal(result.resumeAnalysis.status, 'READY');
  assert.equal(result.resume.sourceHash, resumeTextHash(resumeText));
  assert.equal(updates.length, 2);
  assert.equal(updates[0].update.$set['resume.resumeText'], resumeText);
});

test('distinguishes no upload from unrecoverable legacy upload metadata', () => {
  assert.equal(resumeAvailabilityState({}), 'NO_UPLOAD');
  assert.equal(resumeAvailabilityState({ resume: { originalName: 'legacy.pdf', fileType: 'PDF' } }), 'LEGACY_METADATA');
});
