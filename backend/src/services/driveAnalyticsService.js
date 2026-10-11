import { evaluateEligibility } from './eligibilityService.js';
import { JD_MATCH_WEIGHTS, JD_ROLE_FIT_BUCKETS, matchStudentToJd, roleFitBucket } from './jdMatchingService.js';
import { resumeAvailabilityState, resumeEvidenceSkills } from './resumeAnalysisService.js';
import { uniqueSkills } from './skillNormalization.js';

export const STUDENT_ANALYSIS_SOURCES = Object.freeze({ PROFILE: 'profile', RESUME: 'resume' });

export function normalizeAnalysisSource(value) {
  return value === STUDENT_ANALYSIS_SOURCES.RESUME ? STUDENT_ANALYSIS_SOURCES.RESUME : STUDENT_ANALYSIS_SOURCES.PROFILE;
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentage(value, total) {
  return total > 0 ? (value / total) * 100 : 0;
}

function applicationStatusByStudent(applications) {
  return new Map(
    applications
      .filter((application) => application?.userId)
      .map((application) => [String(application.userId), typeof application.status === 'string' ? application.status : null])
  );
}

function sourceEvidence(profile, analysisSource) {
  if (analysisSource === STUDENT_ANALYSIS_SOURCES.PROFILE) {
    return { available: true, status: 'AVAILABLE', label: 'Profile Skills', skills: uniqueSkills(profile?.skills) };
  }

  const resume = profile?.resume && typeof profile.resume === 'object' ? profile.resume : null;
  const analysis = profile?.resumeAnalysis;
  const sourceHash = typeof resume?.sourceHash === 'string' ? resume.sourceHash : '';
  if (!resume?.resumeText || !sourceHash) {
    return { available: false, status: resumeAvailabilityState(profile), label: 'Resume Analysis', skills: [], analyzedAt: null };
  }
  if (!analysis) return { available: false, status: 'ANALYSIS_PENDING', label: 'Resume Analysis', skills: [], analyzedAt: null };
  if (analysis?.resumeHash !== sourceHash) return { available: false, status: 'STALE', label: 'Resume Analysis', skills: [], analyzedAt: null };
  if (analysis?.status === 'READY') {
    return { available: true, status: 'READY', label: 'Resume Analysis', skills: resumeEvidenceSkills(analysis), analyzedAt: typeof analysis.analyzedAt === 'string' ? analysis.analyzedAt : null };
  }
  return { available: false, status: analysis?.status === 'FAILED' ? 'ANALYSIS_FAILED' : 'ANALYSIS_PENDING', label: 'Resume Analysis', skills: [], analyzedAt: typeof analysis?.analyzedAt === 'string' ? analysis.analyzedAt : null };
}

function createBranchSummary(branch) {
  return { branch, totalStudents: 0, analyzedStudents: 0, resumeUnavailableStudents: 0, eligibleStudents: 0, partialMatchStudents: 0, notEligibleStudents: 0, trainingCandidates: 0, totalJdMatch: 0, skillGaps: new Map() };
}

function publicStudent(profile, jdMatch, applicationStatus, analysisSource, evidence) {
  const match = jdMatch || null;
  return {
    studentId: String(profile.userId), fullName: String(profile.fullName || profile.userId || '').trim(), branch: String(profile.branch || '').trim(), cgpa: asNumber(profile.cgpa),
    // This is always the selected source. Profile and resume evidence are never merged.
    skills: evidence.skills, evidenceSkills: evidence.skills, analysisSource, evidenceLabel: evidence.label, analysisStatus: evidence.status, sourceAvailable: evidence.available, resumeAnalyzedAt: evidence.analyzedAt || null,
    matchedSkills: match?.requiredMatched || [], missingSkills: match?.requiredMissing || [],
    skillMatch: match ? { matchedSkills: match.requiredMatched.length, requiredSkills: match.requiredTotal, percentage: match.requiredPercentage ?? 0 } : null,
    jdMatch: match, applicationStatus
  };
}

function sortedGaps(gapCounts, totalStudents) {
  return [...gapCounts.entries()]
    .map(([skill, studentsMissing]) => ({ skill, studentsMissing, percentage: percentage(studentsMissing, totalStudents) }))
    .sort((left, right) => right.studentsMissing - left.studentsMissing || left.skill.localeCompare(right.skill));
}

function sourceAvailability(profiles, analysisSource) {
  const availability = {
    totalStudents: profiles.length,
    // Explicit resume-state totals for TPO clients. The existing concise keys
    // remain for compatibility with already-rendered analytics screens.
    studentsWithResume: 0,
    studentsWithoutResume: 0,
    studentsPendingParsing: 0,
    studentsWithParsedResume: 0,
    studentsWithResumeAnalysis: 0,
    uploaded: 0,
    available: 0,
    unavailable: 0,
    noUpload: 0,
    legacyMetadata: 0,
    parsingPending: 0,
    parsingFailed: 0,
    analysisPending: 0,
    analysisFailed: 0
  };
  for (const profile of profiles) {
    const evidence = sourceEvidence(profile, analysisSource);
    const resume = profile?.resume && typeof profile.resume === 'object' ? profile.resume : null;
    if (analysisSource === STUDENT_ANALYSIS_SOURCES.RESUME && resume) {
      availability.uploaded += 1;
      availability.studentsWithResume += 1;
      if (typeof resume.resumeText === 'string' && resume.resumeText.trim()) availability.studentsWithParsedResume += 1;
    }
    if (evidence.available) {
      availability.available += 1;
      if (analysisSource === STUDENT_ANALYSIS_SOURCES.RESUME) availability.studentsWithResumeAnalysis += 1;
      continue;
    }
    availability.unavailable += 1;
    if (analysisSource !== STUDENT_ANALYSIS_SOURCES.RESUME) continue;
    if (evidence.status === 'NO_UPLOAD') {
      availability.noUpload += 1;
      availability.studentsWithoutResume += 1;
    }
    if (evidence.status === 'LEGACY_METADATA') availability.legacyMetadata += 1;
    if (evidence.status === 'PARSING_PENDING') {
      availability.parsingPending += 1;
      availability.studentsPendingParsing += 1;
    }
    if (evidence.status === 'PARSING_FAILED') availability.parsingFailed += 1;
    if (evidence.status === 'ANALYSIS_PENDING' || evidence.status === 'STALE') availability.analysisPending += 1;
    if (evidence.status === 'ANALYSIS_FAILED') availability.analysisFailed += 1;
  }
  return availability;
}

function unavailableAnalytics(drive, studentProfiles, applications, analysisSource) {
  const profiles = Array.isArray(studentProfiles) ? studentProfiles : [];
  const statusByStudent = applicationStatusByStudent(Array.isArray(applications) ? applications : []);
  const students = profiles.map((profile) => publicStudent(profile, null, statusByStudent.get(String(profile.userId)) || null, analysisSource, sourceEvidence(profile, analysisSource)));
  const status = drive?.jdAnalysisStatus === 'STALE' ? 'STALE' : drive?.jdAnalysisStatus === 'FAILED' ? 'FAILED' : 'NOT_ANALYZED';
  const availability = sourceAvailability(profiles, analysisSource);
  return {
    analysisSource, sourceAvailability: availability,
    drive: { id: drive.id, companyName: drive.companyName, role: drive.role, requiredSkills: [], jdAnalysisStatus: status, jdAnalysis: null },
    jdAnalysis: { available: false, status, message: status === 'STALE' ? 'The job description changed. Re-analyze it before using role-fit analytics.' : 'Job description analysis is not available for this drive.' },
    summary: { totalStudents: students.length, analyzedStudents: availability.available, resumeUnavailable: analysisSource === 'resume' ? availability.unavailable : 0, eligible: 0, partialMatch: 0, notEligible: 0, driveEligibilityReadiness: 0 },
    officialEligibility: { eligible: 0, notEligible: 0, readinessPercentage: 0 },
    jdRoleFit: { formula: { requiredWeight: JD_MATCH_WEIGHTS.required, preferredWeight: JD_MATCH_WEIGHTS.preferred, description: 'Role fit is unavailable until the job description is analyzed.' }, distribution: JD_ROLE_FIT_BUCKETS.map((bucket) => ({ ...bucket, students: 0, percentage: 0 })), requiredCoverage: { matched: 0, possible: 0, percentage: 0 }, preferredCoverage: { matched: 0, possible: 0, percentage: 0 } },
    skillGaps: [], preferredSkillGaps: [], branchAnalysis: [], branchSkillGaps: [], trainingPriorities: [], eligibleStudents: [], trainingCandidates: [], notEligibleStudents: [], resumeUnavailableStudents: analysisSource === 'resume' ? students : [], students
  };
}

/**
 * Builds live analytics from persisted JD requirements and a single selected
 * student evidence source. Gemini never runs here.
 */
export function buildDriveAnalytics(drive, studentProfiles, applications = [], { analysisSource: requestedSource } = {}) {
  const analysisSource = normalizeAnalysisSource(requestedSource);
  if (drive?.jdAnalysisStatus !== 'READY' || !drive?.jdAnalysis) return unavailableAnalytics(drive || {}, studentProfiles, applications, analysisSource);

  const profiles = Array.isArray(studentProfiles) ? studentProfiles : [];
  const statusByStudent = applicationStatusByStudent(Array.isArray(applications) ? applications : []);
  const requiredGapCounts = new Map();
  const preferredGapCounts = new Map();
  const branchSummaries = new Map();
  const classifiedStudents = { eligible: [], partialMatch: [], notEligible: [], unavailable: [] };
  const roleFitCounts = new Map(JD_ROLE_FIT_BUCKETS.map((bucket) => [bucket.key, 0]));
  const officialEligibility = { eligible: 0, notEligible: 0 };
  let requiredMatched = 0;
  let preferredMatched = 0;
  let analyzedStudents = 0;

  for (const profile of profiles) {
    const eligibility = evaluateEligibility(profile, drive);
    const satisfiesFixedCriteria = eligibility.branchEligible && eligibility.cgpaEligible && eligibility.backlogEligible && eligibility.graduationYearEligible;
    if (satisfiesFixedCriteria) officialEligibility.eligible += 1;
    else officialEligibility.notEligible += 1;

    const branch = String(profile.branch || '').trim() || 'Not provided';
    const branchSummary = branchSummaries.get(branch) || createBranchSummary(branch);
    const evidence = sourceEvidence(profile, analysisSource);
    branchSummary.totalStudents += 1;
    if (!evidence.available) {
      if (analysisSource === STUDENT_ANALYSIS_SOURCES.RESUME) branchSummary.resumeUnavailableStudents += 1;
      classifiedStudents.unavailable.push(publicStudent(profile, null, statusByStudent.get(String(profile.userId)) || null, analysisSource, evidence));
      branchSummaries.set(branch, branchSummary);
      continue;
    }

    analyzedStudents += 1;
    branchSummary.analyzedStudents += 1;
    const jdMatch = matchStudentToJd({ skills: evidence.skills }, drive.jdAnalysis);
    const category = !satisfiesFixedCriteria ? 'notEligible' : jdMatch.requiredMissing.length > 0 ? 'partialMatch' : 'eligible';
    const student = publicStudent(profile, jdMatch, statusByStudent.get(String(profile.userId)) || null, analysisSource, evidence);
    branchSummary.totalJdMatch += jdMatch.matchPercentage;
    if (category === 'eligible') branchSummary.eligibleStudents += 1;
    if (category === 'partialMatch') { branchSummary.partialMatchStudents += 1; branchSummary.trainingCandidates += 1; }
    if (category === 'notEligible') branchSummary.notEligibleStudents += 1;
    requiredMatched += jdMatch.requiredMatched.length;
    preferredMatched += jdMatch.preferredMatched.length;
    for (const skill of jdMatch.requiredMissing) {
      requiredGapCounts.set(skill, (requiredGapCounts.get(skill) || 0) + 1);
      branchSummary.skillGaps.set(skill, (branchSummary.skillGaps.get(skill) || 0) + 1);
    }
    for (const skill of jdMatch.preferredMissing) preferredGapCounts.set(skill, (preferredGapCounts.get(skill) || 0) + 1);
    branchSummaries.set(branch, branchSummary);
    const bucket = roleFitBucket(jdMatch.matchPercentage);
    roleFitCounts.set(bucket.key, (roleFitCounts.get(bucket.key) || 0) + 1);
    classifiedStudents[category].push(student);
  }

  const availability = sourceAvailability(profiles, analysisSource);
  const skillGaps = sortedGaps(requiredGapCounts, analyzedStudents);
  const preferredSkillGaps = sortedGaps(preferredGapCounts, analyzedStudents);
  const branchAnalysis = [...branchSummaries.values()].map((branch) => ({
    branch: branch.branch, totalStudents: branch.totalStudents, analyzedStudents: branch.analyzedStudents, resumeUnavailableStudents: branch.resumeUnavailableStudents,
    eligibleStudents: branch.eligibleStudents, partialMatchStudents: branch.partialMatchStudents, notEligibleStudents: branch.notEligibleStudents, trainingCandidates: branch.trainingCandidates,
    readinessPercentage: percentage(branch.eligibleStudents, branch.analyzedStudents), averageJdMatchPercentage: percentage(branch.totalJdMatch, branch.analyzedStudents)
  })).sort((left, right) => right.totalStudents - left.totalStudents || left.branch.localeCompare(right.branch));
  const branchSkillGaps = [...branchSummaries.values()].map((branch) => ({
    branch: branch.branch, totalStudents: branch.totalStudents, analyzedStudents: branch.analyzedStudents, resumeUnavailableStudents: branch.resumeUnavailableStudents,
    skillGaps: [...branch.skillGaps.entries()].map(([skill, studentsMissing]) => ({ skill, studentsMissing })).sort((left, right) => right.studentsMissing - left.studentsMissing || left.skill.localeCompare(right.skill))
  })).sort((left, right) => right.totalStudents - left.totalStudents || left.branch.localeCompare(right.branch));
  const requiredPossible = analyzedStudents * uniqueSkills(drive.jdAnalysis.requiredSkills).length;
  const preferredPossible = analyzedStudents * uniqueSkills(drive.jdAnalysis.preferredSkills).length;

  return {
    analysisSource, sourceAvailability: availability,
    drive: { id: drive.id, companyName: drive.companyName, role: drive.role, requiredSkills: uniqueSkills(drive.jdAnalysis.requiredSkills), jdAnalysisStatus: 'READY', jdAnalysis: drive.jdAnalysis },
    jdAnalysis: { available: true, status: 'READY', ...drive.jdAnalysis },
    summary: { totalStudents: profiles.length, analyzedStudents, resumeUnavailable: analysisSource === 'resume' ? availability.unavailable : 0, eligible: classifiedStudents.eligible.length, partialMatch: classifiedStudents.partialMatch.length, notEligible: classifiedStudents.notEligible.length, driveEligibilityReadiness: percentage(classifiedStudents.eligible.length, analyzedStudents) },
    // This is fixed-criteria only: branch, CGPA, backlogs, and graduation year.
    officialEligibility: { ...officialEligibility, readinessPercentage: percentage(officialEligibility.eligible, profiles.length) },
    jdRoleFit: {
      formula: { requiredWeight: JD_MATCH_WEIGHTS.required, preferredWeight: JD_MATCH_WEIGHTS.preferred, description: 'Required skills contribute 80% and preferred skills 20%. When only one category exists, its coverage contributes 100%.' },
      distribution: JD_ROLE_FIT_BUCKETS.map((bucket) => ({ ...bucket, students: roleFitCounts.get(bucket.key) || 0, percentage: percentage(roleFitCounts.get(bucket.key) || 0, analyzedStudents) })),
      requiredCoverage: { matched: requiredMatched, possible: requiredPossible, percentage: percentage(requiredMatched, requiredPossible) }, preferredCoverage: { matched: preferredMatched, possible: preferredPossible, percentage: percentage(preferredMatched, preferredPossible) }
    },
    skillGaps, preferredSkillGaps, branchAnalysis, branchSkillGaps, trainingPriorities: skillGaps.map((gap, index) => ({ rank: index + 1, ...gap })),
    eligibleStudents: classifiedStudents.eligible, trainingCandidates: classifiedStudents.partialMatch, notEligibleStudents: classifiedStudents.notEligible, resumeUnavailableStudents: classifiedStudents.unavailable,
    students: [...classifiedStudents.eligible, ...classifiedStudents.partialMatch, ...classifiedStudents.notEligible, ...classifiedStudents.unavailable]
  };
}
