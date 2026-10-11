import assert from 'node:assert/strict';
import test from 'node:test';
import { requireAdmin } from '../src/middleware/requireAdmin.js';
import { buildDriveAnalytics } from '../src/services/driveAnalyticsService.js';

const drive = {
  id: 'drive-1',
  companyName: 'Example Corp',
  role: 'Developer',
  minimumCgpa: 7,
  maximumBacklogs: 0,
  eligibleBranches: ['Computer Engineering', 'Information Technology'],
  graduationYears: [2027],
  requiredSkills: ['Java', 'Node.js', 'React'],
  jdAnalysisStatus: 'READY',
  jdAnalysis: {
    requiredSkills: ['Java', 'Node.js', 'React'], preferredSkills: [], tools: ['Node.js'], technologies: ['React'], frameworks: ['React'],
    responsibilities: ['Build applications'], roleKeywords: ['Developer'], sourceHash: 'test'
  }
};

function student(userId, skills, overrides = {}) {
  return {
    userId,
    fullName: userId,
    branch: 'Computer Engineering',
    cgpa: 8,
    backlogs: 0,
    graduationYear: 2027,
    skills,
    ...overrides
  };
}

function middlewareResult(role) {
  return new Promise((resolve) => {
    requireAdmin({ user: { role } }, {}, (error) => resolve(error || null));
  });
}

test('builds fit categories and skill-gap analytics from eligibility results', () => {
  const analytics = buildDriveAnalytics(drive, [
    student('eligible', ['Java', 'Node.js', 'React']),
    student('training', ['Java', 'NodeJS'], { branch: 'Information Technology' }),
    student('wrong-branch', ['Java', 'Node.js', 'React'], { branch: 'Electronics' }),
    student('low-cgpa', ['Node.js'], { cgpa: 6.5 }),
    student('backlogs', ['Java', 'Node.js', 'React'], { backlogs: 1 })
  ], [{ userId: 'eligible', status: 'Shortlisted' }]);

  assert.deepEqual(analytics.summary, {
    totalStudents: 5,
    analyzedStudents: 5,
    resumeUnavailable: 0,
    eligible: 1,
    partialMatch: 1,
    notEligible: 3,
    driveEligibilityReadiness: 20
  });
  assert.deepEqual(analytics.skillGaps, [
    { skill: 'React', studentsMissing: 2, percentage: 40 },
    { skill: 'Java', studentsMissing: 1, percentage: 20 }
  ]);
  assert.equal(analytics.trainingCandidates.length, 1);
  assert.equal(analytics.trainingCandidates[0].studentId, 'training');
  assert.deepEqual(analytics.trainingCandidates[0].missingSkills, ['React']);
  assert.equal(analytics.eligibleStudents[0].applicationStatus, 'Shortlisted');
  assert.equal(analytics.eligibleStudents[0].email, undefined);
  assert.equal(analytics.eligibleStudents[0].passwordHash, undefined);
});

test('keeps Java distinct from JavaScript while applying Node.js aliases', () => {
  const analytics = buildDriveAnalytics(
    { ...drive, requiredSkills: ['Java', 'Node.js'], jdAnalysis: { ...drive.jdAnalysis, requiredSkills: ['Java', 'Node.js'] } },
    [student('aliases', ['JavaScript', 'node js'])]
  );

  assert.equal(analytics.summary.eligible, 0);
  assert.equal(analytics.summary.partialMatch, 1);
  assert.deepEqual(analytics.trainingCandidates[0].matchedSkills, ['Node.js']);
  assert.deepEqual(analytics.trainingCandidates[0].missingSkills, ['Java']);
});

test('handles empty student populations and drives without required skills', () => {
  const empty = buildDriveAnalytics(drive, []);
  assert.deepEqual(empty.summary, {
    totalStudents: 0,
    analyzedStudents: 0,
    resumeUnavailable: 0,
    eligible: 0,
    partialMatch: 0,
    notEligible: 0,
    driveEligibilityReadiness: 0
  });
  assert.deepEqual(empty.skillGaps, []);

  const noSkillDrive = buildDriveAnalytics({ ...drive, requiredSkills: [], jdAnalysis: { ...drive.jdAnalysis, requiredSkills: [] } }, [student('ready', [])]);
  assert.equal(noSkillDrive.summary.eligible, 1);
  assert.equal(noSkillDrive.summary.partialMatch, 0);
});

test('summarizes real branch populations and leaves fixed-criteria failures out of training candidates', () => {
  const analytics = buildDriveAnalytics(drive, [
    student('it-training', ['Java'], { branch: 'Information Technology' }),
    student('ce-training', ['React'], { branch: 'Computer Engineering' }),
    student('wrong-year', ['Java'], { graduationYear: 2028, branch: 'Information Technology' })
  ]);

  assert.deepEqual(analytics.branchAnalysis.map(({ branch, totalStudents, trainingCandidates }) => ({ branch, totalStudents, trainingCandidates })), [
    { branch: 'Information Technology', totalStudents: 2, trainingCandidates: 1 },
    { branch: 'Computer Engineering', totalStudents: 1, trainingCandidates: 1 }
  ]);
  assert.equal(analytics.trainingCandidates.some((candidate) => candidate.studentId === 'wrong-year'), false);
  assert.equal(analytics.trainingPriorities[0].studentsMissing, 3);
});

test('does not fabricate role requirements for legacy drives without JD analysis', () => {
  const analytics = buildDriveAnalytics({ ...drive, jdAnalysisStatus: 'NOT_ANALYZED', jdAnalysis: null }, [student('legacy', ['Java', 'Node.js', 'React'])]);

  assert.equal(analytics.jdAnalysis.available, false);
  assert.equal(analytics.jdAnalysis.status, 'NOT_ANALYZED');
  assert.deepEqual(analytics.skillGaps, []);
  assert.equal(analytics.summary.totalStudents, 1);
});

test('keeps profile-skill and resume-evidence analytics independent for the same JD', () => {
  const sourceHash = 'resume-version-1';
  const separateSources = student('separate-sources', ['React', 'Node.js', 'MongoDB'], {
    resume: { resumeText: 'private parsed resume text', sourceHash },
    resumeAnalysis: {
      status: 'READY', resumeHash: sourceHash, analyzedAt: '2026-10-02T00:00:00.000Z',
      skills: ['React', 'Node.js', 'REST APIs'], tools: [], technologies: [], frameworks: [], projects: []
    }
  });
  const jd = {
    ...drive,
    requiredSkills: ['React', 'Node.js', 'MongoDB', 'REST APIs'],
    jdAnalysis: { ...drive.jdAnalysis, requiredSkills: ['React', 'Node.js', 'MongoDB', 'REST APIs'] }
  };

  const profileAnalytics = buildDriveAnalytics(jd, [separateSources]);
  const resumeAnalytics = buildDriveAnalytics(jd, [separateSources], [], { analysisSource: 'resume' });

  assert.equal(profileAnalytics.analysisSource, 'profile');
  assert.deepEqual(profileAnalytics.trainingCandidates[0].matchedSkills, ['React', 'Node.js', 'MongoDB']);
  assert.deepEqual(profileAnalytics.trainingCandidates[0].missingSkills, ['REST API']);
  assert.equal(resumeAnalytics.analysisSource, 'resume');
  assert.deepEqual(resumeAnalytics.trainingCandidates[0].matchedSkills, ['React', 'Node.js', 'REST API']);
  assert.deepEqual(resumeAnalytics.trainingCandidates[0].missingSkills, ['MongoDB']);
  assert.equal(JSON.stringify(resumeAnalytics).includes('private parsed resume text'), false);
});

test('marks a missing resume unavailable rather than assigning a zero role-fit score', () => {
  const sourceHash = 'resume-version-2';
  const withResume = student('with-resume', [], {
    resume: { resumeText: 'private resume text', sourceHash },
    resumeAnalysis: { status: 'READY', resumeHash: sourceHash, skills: ['Java', 'Node.js', 'React'], tools: [], technologies: [], frameworks: [], projects: [] }
  });
  const withoutResume = student('without-resume', ['Java', 'Node.js', 'React']);
  const analytics = buildDriveAnalytics(drive, [withResume, withoutResume], [], { analysisSource: 'resume' });

  assert.deepEqual(analytics.sourceAvailability, {
    totalStudents: 2,
    studentsWithResume: 1,
    studentsWithoutResume: 1,
    studentsPendingParsing: 0,
    studentsWithParsedResume: 1,
    studentsWithResumeAnalysis: 1,
    uploaded: 1,
    available: 1,
    unavailable: 1,
    noUpload: 1,
    legacyMetadata: 0,
    parsingPending: 0,
    parsingFailed: 0,
    analysisPending: 0,
    analysisFailed: 0
  });
  assert.equal(analytics.summary.analyzedStudents, 1);
  assert.equal(analytics.summary.resumeUnavailable, 1);
  assert.equal(analytics.resumeUnavailableStudents[0].studentId, 'without-resume');
  assert.equal(analytics.resumeUnavailableStudents[0].jdMatch, null);
  assert.equal(analytics.jdRoleFit.distribution.reduce((total, bucket) => total + bucket.students, 0), 1);
  assert.equal(analytics.officialEligibility.eligible, 2);
});

test('reports legacy uploads and cached analysis failures without calling either state no upload', () => {
  const sourceHash = 'resume-version-4';
  const failed = student('failed-analysis', [], {
    resume: { resumeText: 'private resume text', sourceHash },
    resumeAnalysis: { status: 'FAILED', resumeHash: sourceHash, failureCode: 'RESUME_ANALYSIS_INVALID' }
  });
  const legacy = student('legacy-upload', [], { resume: { originalName: 'old.pdf', fileType: 'PDF' } });
  const analytics = buildDriveAnalytics(drive, [failed, legacy], [], { analysisSource: 'resume' });

  assert.equal(analytics.sourceAvailability.uploaded, 2);
  assert.equal(analytics.sourceAvailability.analysisFailed, 1);
  assert.equal(analytics.sourceAvailability.legacyMetadata, 1);
  assert.equal(analytics.sourceAvailability.noUpload, 0);
  assert.deepEqual(analytics.resumeUnavailableStudents.map((student) => student.analysisStatus).sort(), ['ANALYSIS_FAILED', 'LEGACY_METADATA']);
});

test('returns distinct TPO resume counters and per-student states throughout parsing and analysis', () => {
  const sourceHash = 'resume-version-states';
  const analytics = buildDriveAnalytics(drive, [
    student('no-upload', []),
    student('parse-pending', [], { resume: { id: '123e4567-e89b-12d3-a456-426614174000.pdf' } }),
    student('parse-failed', [], { resume: { id: '123e4567-e89b-12d3-a456-426614174001.pdf', parseStatus: 'FAILED' } }),
    student('analysis-pending', [], { resume: { resumeText: 'private parsed resume', sourceHash } }),
    student('analysis-ready', [], {
      resume: { resumeText: 'private parsed resume', sourceHash },
      resumeAnalysis: { status: 'READY', resumeHash: sourceHash, skills: ['React'], tools: [], technologies: [], frameworks: [], projects: [] }
    })
  ], [], { analysisSource: 'resume' });

  assert.deepEqual(analytics.sourceAvailability, {
    totalStudents: 5,
    studentsWithResume: 4,
    studentsWithoutResume: 1,
    studentsPendingParsing: 1,
    studentsWithParsedResume: 2,
    studentsWithResumeAnalysis: 1,
    uploaded: 4,
    available: 1,
    unavailable: 4,
    noUpload: 1,
    legacyMetadata: 0,
    parsingPending: 1,
    parsingFailed: 1,
    analysisPending: 1,
    analysisFailed: 0
  });
  assert.deepEqual(analytics.resumeUnavailableStudents.map((student) => student.analysisStatus).sort(), [
    'ANALYSIS_PENDING', 'NO_UPLOAD', 'PARSING_FAILED', 'PARSING_PENDING'
  ]);
  assert.equal(JSON.stringify(analytics).includes('private parsed resume'), false);
});

test('uses centralized aliases but keeps Java distinct from JavaScript in resume mode', () => {
  const sourceHash = 'resume-version-3';
  const resumeStudent = student('resume-aliases', [], {
    resume: { resumeText: 'private resume text', sourceHash },
    resumeAnalysis: { status: 'READY', resumeHash: sourceHash, skills: ['JavaScript', 'nodejs'], tools: [], technologies: [], frameworks: [], projects: [] }
  });
  const analytics = buildDriveAnalytics({ ...drive, requiredSkills: ['Java', 'Node.js'], jdAnalysis: { ...drive.jdAnalysis, requiredSkills: ['Java', 'Node.js'] } }, [resumeStudent], [], { analysisSource: 'resume' });

  assert.deepEqual(analytics.trainingCandidates[0].matchedSkills, ['Node.js']);
  assert.deepEqual(analytics.trainingCandidates[0].missingSkills, ['Java']);
});

test('allows TPO and admin management routes while rejecting a student analytics request', async () => {
  assert.equal(await middlewareResult('TPO'), null);
  assert.equal(await middlewareResult('ADMIN'), null);
  const error = await middlewareResult('STUDENT');
  assert.equal(error?.statusCode, 403);
  assert.equal(error?.code, 'ADMIN_ACCESS_REQUIRED');
});
