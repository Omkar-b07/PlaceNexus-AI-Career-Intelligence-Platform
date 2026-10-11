import { evaluateEligibility } from '../services/eligibilityService.js';
import { buildDriveAnalytics, normalizeAnalysisSource } from '../services/driveAnalyticsService.js';
import { analyzeJobDescription } from '../services/jdAnalysisService.js';
import { archiveCampusJob, createCampusJob, findJob, jobSourceTypes, listCampusJobsForManagement, listOnCampusJobs, setCampusJobStatus, updateCampusJob } from '../services/jobService.js';
import { listOffCampusJobs } from '../services/offCampusJobService.js';
import { getStudentProfile, listActiveStudentProfiles, listActiveStudentProfilesForResumeAnalytics } from '../services/profileService.js';
import { ensureResumeAnalyses } from '../services/resumeAnalysisService.js';
import { listApplicationsForCampusJob, listCampusApplicationStatuses, updateCampusApplicationStatus } from '../services/applicationService.js';

function notFound() {
  const error = new Error('That job was not found.');
  error.statusCode = 404;
  error.code = 'JOB_NOT_FOUND';
  return error;
}

function withEligibility(profile, jobs) {
  return jobs.map((job) => ({ ...job, eligibility: evaluateEligibility(profile, job) }));
}

export async function listOnCampusPlacementJobs(req, res, next) {
  try {
    const [profile, jobs] = await Promise.all([getStudentProfile(req.user), listOnCampusJobs()]);
    return res.status(200).json({ success: true, data: { items: withEligibility(profile, jobs) } });
  } catch (error) { return next(error); }
}

export async function listOffCampusPlacementJobs(req, res, next) {
  try {
    const [profile, result] = await Promise.all([
      getStudentProfile(req.user),
      listOffCampusJobs({ what: req.query.what, where: req.query.where, limit: req.query.limit })
    ]);
    return res.status(200).json({ success: true, data: { ...result, items: withEligibility(profile, result.items) } });
  } catch (error) { return next(error); }
}

export async function getPlacementJob(req, res, next) {
  try {
    const [profile, job] = await Promise.all([getStudentProfile(req.user), findJob(req.params.jobId)]);
    if (!job || (job.sourceType === jobSourceTypes.ON_CAMPUS && job.jobStatus !== 'PUBLISHED')) throw notFound();
    return res.status(200).json({ success: true, data: { ...job, eligibility: evaluateEligibility(profile, job) } });
  } catch (error) { return next(error); }
}

export async function listManagedCampusJobs(_req, res, next) {
  try {
    return res.status(200).json({ success: true, data: { items: await listCampusJobsForManagement() } });
  } catch (error) { return next(error); }
}

export async function createCampusPlacementJob(req, res, next) {
  try {
    return res.status(201).json({ success: true, data: await createCampusJob(req.body, req.user.id) });
  } catch (error) { return next(error); }
}

export async function analyzeCampusJobDescription(req, res, next) {
  try {
    return res.status(200).json({ success: true, data: await analyzeJobDescription(req.body?.jobDescription) });
  } catch (error) { return next(error); }
}

export async function updateCampusPlacementJob(req, res, next) {
  try {
    const job = await updateCampusJob(req.params.jobId, req.body);
    if (!job) throw notFound();
    return res.status(200).json({ success: true, data: job });
  } catch (error) { return next(error); }
}

function changeCampusJobStatus(jobStatus) {
  return async (req, res, next) => {
    try {
      const job = await setCampusJobStatus(req.params.jobId, jobStatus);
      if (!job) throw notFound();
      return res.status(200).json({ success: true, data: job });
    } catch (error) { return next(error); }
  };
}

export const publishCampusPlacementJob = changeCampusJobStatus('PUBLISHED');
export const unpublishCampusPlacementJob = changeCampusJobStatus('UNPUBLISHED');
export const closeCampusPlacementJob = changeCampusJobStatus('CLOSED');

export async function archiveCampusPlacementJob(req, res, next) {
  try {
    const job = await archiveCampusJob(req.params.jobId);
    if (!job) throw notFound();
    return res.status(200).json({ success: true, data: job });
  } catch (error) { return next(error); }
}

export async function listCampusJobApplications(req, res, next) {
  try {
    const job = await findJob(req.params.jobId);
    if (!job || job.sourceType !== jobSourceTypes.ON_CAMPUS) throw notFound();
    return res.status(200).json({ success: true, data: { items: await listApplicationsForCampusJob(job.id) } });
  } catch (error) { return next(error); }
}

export async function listEligibleCampusStudents(req, res, next) {
  try {
    const job = await findJob(req.params.jobId);
    if (!job || job.sourceType !== jobSourceTypes.ON_CAMPUS) throw notFound();
    const students = (await listActiveStudentProfiles()).map((profile) => ({
      studentId: profile.userId,
      profile,
      eligibility: evaluateEligibility(profile, job)
    })).filter((student) => student.eligibility.eligible);
    return res.status(200).json({ success: true, data: { items: students } });
  } catch (error) { return next(error); }
}

export async function updateCampusApplication(req, res, next) {
  try {
    const application = await updateCampusApplicationStatus(req.params.applicationId, req.body?.status);
    if (!application) {
      const error = new Error('That campus application was not found.');
      error.statusCode = 404;
      error.code = 'APPLICATION_NOT_FOUND';
      throw error;
    }
    return res.status(200).json({ success: true, data: application });
  } catch (error) { return next(error); }
}

export async function getCampusDriveAnalytics(req, res, next) {
  try {
    const job = await findJob(req.params.jobId);
    if (!job || job.sourceType !== jobSourceTypes.ON_CAMPUS) throw notFound();
    const analysisSource = normalizeAnalysisSource(req.query?.analysisSource);
    const [listedStudents, applications] = await Promise.all([
      analysisSource === 'resume' ? listActiveStudentProfilesForResumeAnalytics() : listActiveStudentProfiles(),
      listCampusApplicationStatuses(job.id)
    ]);
    // JD analysis is the required target. Do not spend Gemini calls on resume
    // extraction until a reviewed JD is available for deterministic matching.
    const students = analysisSource === 'resume' && job.jdAnalysisStatus === 'READY' && job.jdAnalysis
      ? await ensureResumeAnalyses(listedStudents, { concurrency: 2 })
      : listedStudents;
    return res.status(200).json({ success: true, data: buildDriveAnalytics(job, students, applications, { analysisSource }) });
  } catch (error) { return next(error); }
}
