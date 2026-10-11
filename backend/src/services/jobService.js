import { randomUUID } from 'node:crypto';
import { getJobsCollection } from './database.js';
import { normalizeJdAnalysis } from './jdAnalysisService.js';
import { uniqueSkills } from './skillNormalization.js';

export const jobSourceTypes = Object.freeze({ ON_CAMPUS: 'ON_CAMPUS', OFF_CAMPUS: 'OFF_CAMPUS' });
export const campusJobStatuses = Object.freeze(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'CLOSED', 'ARCHIVED']);

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'INVALID_JOB';
  return error;
}

function text(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function nullableText(value, maxLength) {
  return text(value, maxLength) || null;
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function list(value, maxItems = 30, maxLength = 100) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(source.map((item) => text(String(item), maxLength)).filter(Boolean))].slice(0, maxItems);
}

function publicJdAnalysis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const output = {};
  for (const field of ['requiredSkills', 'preferredSkills', 'tools', 'technologies', 'frameworks', 'responsibilities', 'roleKeywords']) {
    output[field] = list(value[field], field === 'responsibilities' || field === 'roleKeywords' ? 20 : 50, field === 'responsibilities' || field === 'roleKeywords' ? 240 : 120);
  }
  return { ...output, sourceHash: text(value.sourceHash, 128), analyzedAt: value.analyzedAt || null };
}

function date(value, label = 'Application deadline', required = false) {
  if (value === null || value === undefined || value === '') {
    if (required) throw validationError(`${label} is required.`);
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw validationError(`${label} must be a valid date.`);
  return parsed.toISOString();
}

function number(value, label, min, max, integer = false, required = false) {
  if (value === null || value === undefined || value === '') {
    if (required) throw validationError(`${label} is required.`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) throw validationError(`${label} is invalid.`);
  return parsed;
}

export function safeApplicationUrl(value) {
  const candidate = text(value, 2_048);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function isValidApplicationUrl(value) {
  return safeApplicationUrl(value) !== null;
}

function publicStatus(job) {
  if (job.jobStatus && job.jobStatus !== 'PUBLISHED') return 'expired';
  if (job.status === 'expired') return 'expired';
  const deadline = job.deadline ? new Date(job.deadline).getTime() : null;
  return deadline !== null && !Number.isNaN(deadline) && deadline < Date.now() ? 'expired' : 'active';
}

export function publicJob(job) {
  if (!job) return null;
  const { _id, createdBy, ...details } = job;
  return {
    ...details,
    id: String(_id),
    sourceType: details.sourceType || jobSourceTypes.ON_CAMPUS,
    jobStatus: details.jobStatus || 'PUBLISHED',
    companyName: nullableText(details.companyName, 120),
    role: nullableText(details.role, 120),
    jobDescription: nullableText(details.jobDescription, 12_000),
    ctc: nullableText(details.ctc, 80),
    ctcLpa: finiteNumberOrNull(details.ctcLpa),
    salaryMin: finiteNumberOrNull(details.salaryMin),
    salaryMax: finiteNumberOrNull(details.salaryMax),
    location: nullableText(details.location, 120),
    deadline: details.deadline || null,
    postedAt: details.postedAt || null,
    applicationUrl: safeApplicationUrl(details.applicationUrl),
    requiredSkills: uniqueSkills(details.requiredSkills),
    jdAnalysisStatus: ['NOT_ANALYZED', 'READY', 'STALE', 'FAILED'].includes(details.jdAnalysisStatus) ? details.jdAnalysisStatus : details.jdAnalysis ? 'READY' : 'NOT_ANALYZED',
    jdAnalysis: publicJdAnalysis(details.jdAnalysis),
    eligibleBranches: list(details.eligibleBranches),
    graduationYears: list(details.graduationYears, 10, 4).map(Number).filter(Number.isInteger),
    minimumCgpa: finiteNumberOrNull(details.minimumCgpa),
    maximumBacklogs: finiteNumberOrNull(details.maximumBacklogs),
    employmentType: nullableText(details.employmentType, 80),
    status: publicStatus(job)
  };
}

export function normalizeOnCampusJob(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw validationError('Job data must be an object.');
  const result = {};
  const fields = [
    ['companyName', 120], ['role', 120], ['jobDescription', 12_000], ['ctc', 80], ['location', 120], ['additionalCriteria', 1_000], ['employmentType', 80]
  ];
  for (const [field, maxLength] of fields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) result[field] = text(input[field], maxLength);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'deadline')) result.deadline = date(input.deadline, 'Application deadline', !partial);
  if (Object.prototype.hasOwnProperty.call(input, 'ctcLpa')) result.ctcLpa = number(input.ctcLpa, 'CTC', 0, 200);
  if (Object.prototype.hasOwnProperty.call(input, 'minimumCgpa')) result.minimumCgpa = number(input.minimumCgpa, 'Minimum CGPA', 0, 10, false, !partial);
  if (Object.prototype.hasOwnProperty.call(input, 'maximumBacklogs')) result.maximumBacklogs = number(input.maximumBacklogs, 'Maximum backlogs', 0, 50, true, !partial);
  if (Object.prototype.hasOwnProperty.call(input, 'eligibleBranches')) result.eligibleBranches = list(input.eligibleBranches);
  if (Object.prototype.hasOwnProperty.call(input, 'graduationYears')) result.graduationYears = list(input.graduationYears, 10, 4).map(Number).filter(Number.isInteger);
  if (Object.prototype.hasOwnProperty.call(input, 'requiredSkills')) result.requiredSkills = uniqueSkills(input.requiredSkills).slice(0, 50);
  if (Object.prototype.hasOwnProperty.call(input, 'jdAnalysis')) {
    if (input.jdAnalysis === null) {
      result.jdAnalysis = null;
    } else {
      const description = Object.prototype.hasOwnProperty.call(input, 'jobDescription') ? result.jobDescription : input.jobDescription;
      if (!description) throw validationError('A job description is required before saving JD requirements.');
      result.jdAnalysis = { ...normalizeJdAnalysis(input.jdAnalysis, description, { requireSourceHash: true }), analyzedAt: new Date().toISOString() };
      result.requiredSkills = result.jdAnalysis.requiredSkills;
    }
  }

  if (!partial) {
    for (const field of ['companyName', 'role', 'jobDescription', 'ctc', 'location', 'deadline']) {
      if (!result[field]) throw validationError(`${field} is required.`);
    }
    for (const field of ['minimumCgpa', 'maximumBacklogs', 'ctcLpa']) {
      if (result[field] === null || result[field] === undefined) throw validationError(`${field} is required.`);
    }
    if (!Array.isArray(result.eligibleBranches) || !result.eligibleBranches.length) throw validationError('At least one eligible branch is required.');
    if (!Array.isArray(result.graduationYears) || !result.graduationYears.length) throw validationError('At least one eligible graduation year is required.');
    if (!Array.isArray(result.requiredSkills)) result.requiredSkills = [];
  }
  return result;
}

export async function purgeLegacyGeneratedJobs() {
  const jobs = await getJobsCollection();
  // Previous releases marked generated sample rows with this exact shape. Real
  // TPO and provider rows always have an explicit sourceType.
  await jobs.deleteMany({ createdBy: 'system', sourceType: { $exists: false } });
  await jobs.updateMany(
    { sourceType: { $exists: false }, createdBy: { $ne: 'system' } },
    { $set: { sourceType: jobSourceTypes.ON_CAMPUS, jobStatus: 'PUBLISHED', updatedAt: new Date().toISOString() } }
  );
}

export async function listOnCampusJobs() {
  await purgeLegacyGeneratedJobs();
  const jobs = await (await getJobsCollection()).find({ sourceType: jobSourceTypes.ON_CAMPUS, jobStatus: 'PUBLISHED' }).sort({ deadline: 1 }).toArray();
  return jobs.map(publicJob).filter((job) => job.status === 'active');
}

export async function listCampusJobsForManagement() {
  await purgeLegacyGeneratedJobs();
  const jobs = await (await getJobsCollection()).find({ sourceType: jobSourceTypes.ON_CAMPUS }).sort({ updatedAt: -1 }).toArray();
  return jobs.map(publicJob);
}

export async function findJob(jobId) {
  await purgeLegacyGeneratedJobs();
  return publicJob(await (await getJobsCollection()).findOne({ _id: jobId }));
}

export async function createCampusJob(input, managerId) {
  // A drive begins as a draft, so the TPO can save work before every official
  // criterion is known. Publishing performs the complete validation below.
  const job = normalizeOnCampusJob(input, true);
  const now = new Date().toISOString();
  const record = {
    _id: randomUUID(),
    ...job,
    sourceType: jobSourceTypes.ON_CAMPUS,
    jobStatus: 'DRAFT',
    jdAnalysisStatus: job.jdAnalysis ? 'READY' : 'NOT_ANALYZED',
    applicationUrl: null,
    createdBy: managerId,
    createdAt: now,
    updatedAt: now
  };
  await (await getJobsCollection()).insertOne(record);
  return publicJob(record);
}

export async function updateCampusJob(jobId, input, jobsCollection = getJobsCollection()) {
  const changes = normalizeOnCampusJob(input, true);
  if (Object.prototype.hasOwnProperty.call(input, 'jdAnalysis')) {
    changes.jdAnalysisStatus = changes.jdAnalysis ? 'READY' : 'STALE';
    if (!changes.jdAnalysis) changes.requiredSkills = [];
  } else if (Object.prototype.hasOwnProperty.call(input, 'jobDescription')) {
    // A changed description invalidates the prior interpretation. It must be
    // explicitly re-analyzed; neither analytics nor student skill matching can
    // continue to use the old JD-derived required-skills snapshot.
    changes.jdAnalysis = null;
    changes.jdAnalysisStatus = 'STALE';
    changes.requiredSkills = [];
  }
  const result = await (await jobsCollection).findOneAndUpdate(
    // Archiving removes a drive from the student-facing lifecycle, but the
    // management UI still lists it and allows TPOs to correct its criteria.
    { _id: jobId, sourceType: jobSourceTypes.ON_CAMPUS },
    { $set: { ...changes, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  return publicJob(result);
}

export async function setCampusJobStatus(jobId, jobStatus) {
  if (!campusJobStatuses.includes(jobStatus)) throw validationError('Campus job status is invalid.');
  const jobs = await getJobsCollection();
  if (jobStatus === 'PUBLISHED') {
    const existing = await jobs.findOne({ _id: jobId, sourceType: jobSourceTypes.ON_CAMPUS });
    if (!existing) return null;
    // Validate the stored canonical fields, including jobDescription, before a
    // draft becomes visible to students.
    normalizeOnCampusJob(existing);
    if (existing.jdAnalysisStatus !== 'READY' || !existing.jdAnalysis) {
      throw validationError('Analyze the job description and confirm its JD requirements before publishing this drive.');
    }
  }
  const result = await jobs.findOneAndUpdate(
    { _id: jobId, sourceType: jobSourceTypes.ON_CAMPUS },
    { $set: { jobStatus, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  return publicJob(result);
}

export async function archiveCampusJob(jobId) {
  return setCampusJobStatus(jobId, 'ARCHIVED');
}
