import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeJobDescription, jobDescriptionHash, normalizeJdAnalysis } from '../src/services/jdAnalysisService.js';
import { JD_MATCH_WEIGHTS, matchStudentToJd } from '../src/services/jdMatchingService.js';
import { normalizeOnCampusJob } from '../src/services/jobService.js';

const description = 'Build web applications with React, Node.js, MongoDB and REST APIs. Docker and AWS are preferred for this software engineering role.';
const extraction = {
  requiredSkills: ['ReactJS', 'node js', 'MongoDB', 'REST APIs', 'Java'],
  preferredSkills: ['Docker', 'AWS', 'JavaScript'],
  tools: ['Docker'], technologies: ['React', 'Node.js', 'MongoDB', 'AWS'], frameworks: ['React'],
  responsibilities: ['Build web applications'], roleKeywords: ['Software Engineer']
};

test('validates, normalizes, and separates supported JD extraction entities', async () => {
  const analysis = await analyzeJobDescription(description, async () => extraction);

  assert.deepEqual(analysis.requiredSkills, ['React', 'Node.js', 'MongoDB', 'REST API', 'Java']);
  assert.deepEqual(analysis.preferredSkills, ['Docker', 'AWS', 'JavaScript']);
  assert.equal(analysis.sourceHash, jobDescriptionHash(description));
  assert.ok(analysis.analyzedAt);
});

test('fails safely for empty, malformed, and unsupported JD extraction responses', async () => {
  await assert.rejects(() => analyzeJobDescription(''), { code: 'JD_DESCRIPTION_REQUIRED' });
  await assert.rejects(() => analyzeJobDescription(description, async () => ({ requiredSkills: [] })), { code: 'JD_ANALYSIS_INVALID' });
  await assert.rejects(() => analyzeJobDescription(description, async () => ({ ...extraction, requiredSkills: ['Uncatalogued Platform'] })), { code: 'JD_ANALYSIS_UNSUPPORTED_ENTITY' });
  await assert.rejects(() => analyzeJobDescription(description, async () => { const error = new Error('malformed'); error.code = 'GEMINI_INVALID_RESPONSE'; throw error; }), { code: 'JD_ANALYSIS_INVALID' });
  await assert.rejects(() => analyzeJobDescription(description, async () => { throw new Error('network unavailable'); }), { code: 'JD_ANALYSIS_UNAVAILABLE' });
});

test('matches students deterministically with required-primary JD weighting', () => {
  const match = matchStudentToJd({ skills: ['JavaScript', 'nodejs', 'Docker'] }, { requiredSkills: ['Java', 'Node.js'], preferredSkills: ['Docker', 'AWS'] });

  assert.deepEqual(match.requiredMatched, ['Node.js']);
  assert.deepEqual(match.requiredMissing, ['Java']);
  assert.deepEqual(match.preferredMatched, ['Docker']);
  assert.deepEqual(match.preferredMissing, ['AWS']);
  assert.equal(match.matchPercentage, 50);
  assert.deepEqual(JD_MATCH_WEIGHTS, { required: 0.8, preferred: 0.2 });
});

test('uses the only available JD requirement category when required skills are absent', () => {
  const match = matchStudentToJd({ skills: ['AWS'] }, { requiredSkills: [], preferredSkills: ['AWS', 'Docker'] });
  assert.equal(match.matchPercentage, 50);
  assert.equal(match.requiredPercentage, null);
  assert.equal(match.preferredPercentage, 50);
});

test('requires a matching JD source hash when a TPO confirms analysis and marks changed descriptions stale', () => {
  const analysis = { ...normalizeJdAnalysis(extraction, description), sourceHash: jobDescriptionHash(description) };
  const confirmed = normalizeOnCampusJob({ jobDescription: description, jdAnalysis: analysis }, true);
  assert.deepEqual(confirmed.requiredSkills, ['React', 'Node.js', 'MongoDB', 'REST API', 'Java']);
  assert.equal(confirmed.jdAnalysis?.sourceHash, jobDescriptionHash(description));
  assert.throws(() => normalizeOnCampusJob({ jobDescription: `${description} Updated.`, jdAnalysis: analysis }, true), { code: 'JD_ANALYSIS_STALE' });
});
