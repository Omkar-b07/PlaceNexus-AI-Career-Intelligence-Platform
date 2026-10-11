import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateEligibility } from '../src/services/eligibilityService.js';
import { normalizeSkill, uniqueSkills } from '../src/services/skillNormalization.js';
import { normalizeLocations, normalizeProfileSkills, normalizeRoles } from '../src/services/profileNormalization.js';
import { profileCompletion } from '../src/services/profileService.js';
import profileCatalog from '../../shared/profileCatalog.json' with { type: 'json' };

const job = {
  minimumCgpa: 6.5,
  maximumBacklogs: 1,
  eligibleBranches: ['Information Technology'],
  graduationYears: [2027],
  requiredSkills: ['JavaScript', 'Node.js', 'Git']
};

function profile(skills, overrides = {}) {
  return {
    cgpa: 7.2,
    backlogs: 0,
    branch: 'Information Technology',
    graduationYear: 2027,
    skills,
    ...overrides
  };
}

test('marks a student eligible when every required skill is present', () => {
  const result = evaluateEligibility(profile(['JavaScript', 'Node.js', 'Git']), job);

  assert.equal(result.eligible, true);
  assert.deepEqual(result.checks.skills, {
    passed: true,
    matched: ['JavaScript', 'Node.js', 'Git'],
    missing: [],
    required: ['JavaScript', 'Node.js', 'Git'],
    studentSkillCount: 3
  });
});

test('reports only skills that are genuinely missing', () => {
  const result = evaluateEligibility(profile(['JavaScript', 'Git']), job);

  assert.equal(result.eligible, false);
  assert.deepEqual(result.checks.skills.matched, ['JavaScript', 'Git']);
  assert.deepEqual(result.checks.skills.missing, ['Node.js']);
});

test('matches skill names case-insensitively and ignores surrounding whitespace', () => {
  const result = evaluateEligibility(profile([' javascript ', 'NODE.JS', 'git']), job);

  assert.equal(result.eligible, true);
  assert.deepEqual(result.checks.skills.missing, []);
});

test('treats an empty skill profile as missing every job requirement', () => {
  const result = evaluateEligibility(profile([]), job);

  assert.equal(result.eligible, false);
  assert.equal(result.checks.skills.studentSkillCount, 0);
  assert.deepEqual(result.checks.skills.missing, ['JavaScript', 'Node.js', 'Git']);
});

test('keeps passing skills visible when another eligibility rule fails', () => {
  const result = evaluateEligibility(profile(['JavaScript', 'Node.js', 'Git'], { cgpa: 6.1 }), job);

  assert.equal(result.eligible, false);
  assert.equal(result.checks.cgpa.passed, false);
  assert.equal(result.checks.skills.passed, true);
  assert.deepEqual(result.checks.skills.missing, []);
});

test('supports existing object-shaped skill values without conflating distinct skills', () => {
  const result = evaluateEligibility(profile([{ name: 'JavaScript' }, { skillName: ' Node.js ' }, { label: 'Git' }]), job);

  assert.equal(result.eligible, true);
  assert.deepEqual(uniqueSkills([' JavaScript ', 'javascript', { skill: 'Node.js' }]), ['JavaScript', 'Node.js']);
  assert.equal(normalizeSkill('C++'), 'c++');
  assert.notEqual(normalizeSkill('C++'), normalizeSkill('C'));
});

test('accepts safe Node.js and React variations without making Java match JavaScript', () => {
  const variationJob = { ...job, requiredSkills: ['Node.js', 'React', 'JavaScript'] };
  const result = evaluateEligibility(profile(['NodeJS', 'ReactJS', 'JavaScript']), variationJob);

  assert.equal(result.checks.skills.passed, true);
  assert.equal(normalizeSkill('Java'), 'java');
  assert.notEqual(normalizeSkill('Java'), normalizeSkill('JavaScript'));
});

test('normalizes branch formatting and numeric profile values from stored legacy documents', () => {
  const result = evaluateEligibility(
    profile(['JavaScript', 'Node.js', 'Git'], { branch: 'Electronics and Computer Engineering', cgpa: '7.8', backlogs: '0', graduationYear: '2027' }),
    { ...job, minimumCgpa: '7.0', maximumBacklogs: '2', eligibleBranches: ['Electronics & Computer Engineering'], graduationYears: ['2026', '2027'] }
  );

  assert.equal(result.eligible, true);
  assert.equal(result.checks.branch.passed, true);
  assert.equal(result.checks.cgpa.passed, true);
  assert.equal(result.checks.backlogs.passed, true);
  assert.equal(result.checks.graduationYear.passed, true);
});

test('matches every student branch catalog value when the same value is selected for a drive', () => {
  for (const { value } of profileCatalog.branchOptions) {
    const result = evaluateEligibility(profile(['JavaScript', 'Node.js', 'Git'], { branch: value }), { ...job, eligibleBranches: [value] });
    assert.equal(result.checks.branch.passed, true, value);
  }
});

test('canonicalizes catalog skills and flags malformed legacy skills without guessing', () => {
  const normalized = normalizeProfileSkills(['React.js', 'NODEJS', 'JS', 'Java', 'react']);
  const malformed = normalizeProfileSkills('reacttonodejs');

  assert.deepEqual(normalized.skills, ['React', 'Node.js', 'JavaScript', 'Java']);
  assert.deepEqual(normalized.legacySkills, []);
  assert.deepEqual(malformed.skills, []);
  assert.deepEqual(malformed.legacySkills, ['reacttonodejs']);
});

test('normalizes roles, locations, and completion from array-shaped profile data', () => {
  const profile = {
    fullName: 'Student', phone: '+919999999999', branch: 'Electronics and Computer Engineering', college: 'PlaceNexus College',
    cgpa: 8.14, backlogs: 0, graduationYear: 2027, skills: ['React'], projects: [], resume: null,
    preferredRoles: normalizeRoles(['fullstackdev']), preferredLocations: normalizeLocations(['bangalore'])
  };
  const completion = profileCompletion(profile);

  assert.deepEqual(profile.preferredRoles, ['Full Stack Developer']);
  assert.deepEqual(profile.preferredLocations, ['Bengaluru']);
  assert.deepEqual(normalizeLocations(['goa']), ['Goa']);
  assert.equal(completion.missingMandatory.includes('Skills'), false);
  assert.equal(completion.missingMandatory.length, 0);
});
