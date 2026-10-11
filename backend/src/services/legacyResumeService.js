import fs from 'node:fs/promises';
import path from 'node:path';
import { getLegacyResumeAssignmentsCollection, getStudentProfilesCollection, getUsersCollection } from './database.js';
import { setProfileResume } from './profileService.js';
import { ensureResumeAnalysis } from './resumeAnalysisService.js';
import { extractResumeText } from './resumeParser.js';
import { resumeFileNameFromId, resumeUploadDirectory, supportedFiles } from '../middleware/upload.js';

function serviceError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function validLegacyResumeId(value) {
  const fileName = resumeFileNameFromId(value);
  if (!fileName) throw serviceError('That legacy resume identifier is invalid.', 'INVALID_LEGACY_RESUME_ID', 400);
  return fileName;
}

function metadata(fileName, stat) {
  const extension = path.extname(fileName).toLowerCase();
  return {
    legacyResumeId: fileName,
    originalName: null,
    fileType: extension.slice(1).toUpperCase(),
    mimeType: supportedFiles.get(extension) || 'application/octet-stream',
    size: Number(stat.size) || 0,
    modifiedAt: stat.mtime.toISOString(),
    status: 'UNLINKED'
  };
}

async function rows(collection, filter, options) {
  const cursor = (await collection).find(filter, options);
  return cursor.toArray();
}

async function availableFile(legacyResumeId, { profilesCollection, assignmentsCollection, resumeDirectory }) {
  const fileName = validLegacyResumeId(legacyResumeId);
  const filePath = path.join(resumeDirectory, fileName);
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    throw serviceError('That legacy resume file is no longer available.', 'LEGACY_RESUME_NOT_FOUND', 404);
  }
  if (!stat.isFile()) throw serviceError('That legacy resume file is no longer available.', 'LEGACY_RESUME_NOT_FOUND', 404);

  const [canonicalProfile, assignment] = await Promise.all([
    (await profilesCollection).findOne({ 'resume.id': fileName }, { projection: { userId: 1 } }),
    (await assignmentsCollection).findOne({ legacyResumeId: fileName }, { projection: { status: 1 } })
  ]);
  if (canonicalProfile || assignment) {
    throw serviceError('This legacy resume has already been assigned and cannot be attached again.', 'LEGACY_RESUME_ALREADY_ASSIGNED', 409);
  }
  return { fileName, filePath, metadata: metadata(fileName, stat) };
}

/** Lists only unlinked file metadata. Resume bytes and text never leave this service. */
export async function listLegacyResumes({
  profilesCollection = getStudentProfilesCollection(),
  assignmentsCollection = getLegacyResumeAssignmentsCollection(),
  resumeDirectory = resumeUploadDirectory
} = {}) {
  const [profiles, assignments, entries] = await Promise.all([
    rows(profilesCollection, { 'resume.id': { $exists: true } }, { projection: { 'resume.id': 1 } }),
    rows(assignmentsCollection, {}, { projection: { legacyResumeId: 1 } }),
    fs.readdir(resumeDirectory, { withFileTypes: true }).catch(() => [])
  ]);
  const assignedIds = new Set(assignments.map((assignment) => String(assignment.legacyResumeId || '')).filter(Boolean));
  const canonicalIds = new Set(profiles.map((profile) => String(profile?.resume?.id || '')).filter(Boolean));
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => resumeFileNameFromId(entry.name))
    .filter(Boolean)
    .filter((fileName) => !canonicalIds.has(fileName) && !assignedIds.has(fileName));
  const items = await Promise.all(files.map(async (fileName) => {
    try {
      const stat = await fs.stat(path.join(resumeDirectory, fileName));
      return stat.isFile() ? metadata(fileName, stat) : null;
    } catch {
      return null;
    }
  }));
  return items.filter(Boolean).sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt) || left.legacyResumeId.localeCompare(right.legacyResumeId));
}

/** Resolves a safe, authorized-preview-only file handle. It is never serialized. */
export async function getLegacyResumePreview(legacyResumeId, {
  profilesCollection = getStudentProfilesCollection(),
  assignmentsCollection = getLegacyResumeAssignmentsCollection(),
  resumeDirectory = resumeUploadDirectory
} = {}) {
  return availableFile(legacyResumeId, { profilesCollection, assignmentsCollection, resumeDirectory });
}

function duplicateReservation(error) {
  return error?.code === 11000 || error?.code === 'LEGACY_RESUME_ALREADY_ASSIGNED';
}

function studentNotFound() {
  return serviceError('That student account was not found.', 'STUDENT_NOT_FOUND', 404);
}

function existingResumeError() {
  return serviceError('This student already has a resume. Confirm replacement before assigning this legacy file.', 'STUDENT_RESUME_EXISTS', 409);
}

/**
 * Explicitly links one selected file to one selected student. There is no
 * matching, suggestion, or heuristic in this path.
 */
export async function assignLegacyResume({ legacyResumeId, studentId, assignedBy, replaceExisting = false, confirmed = false }, {
  profilesCollection = getStudentProfilesCollection(),
  usersCollection = getUsersCollection(),
  assignmentsCollection = getLegacyResumeAssignmentsCollection(),
  resumeDirectory = resumeUploadDirectory,
  extractText = extractResumeText,
  generateJson
} = {}) {
  if (!confirmed) throw serviceError('Confirm the selected student before assigning this resume.', 'REATTACHMENT_CONFIRMATION_REQUIRED', 400);
  const normalizedStudentId = String(studentId || '').trim();
  const normalizedAssignerId = String(assignedBy || '').trim();
  if (!normalizedStudentId || !normalizedAssignerId) throw serviceError('A student and authorized TPO account are required.', 'REATTACHMENT_INPUT_REQUIRED', 400);

  const [profiles, users, assignments] = await Promise.all([profilesCollection, usersCollection, assignmentsCollection]);
  const file = await availableFile(legacyResumeId, { profilesCollection: profiles, assignmentsCollection: assignments, resumeDirectory });
  const [user, profile] = await Promise.all([
    users.findOne({ _id: normalizedStudentId }, { projection: { _id: 1, role: 1 } }),
    profiles.findOne({ userId: normalizedStudentId })
  ]);
  if (!user || !['STUDENT', null].includes(user.role)) throw studentNotFound();
  if (profile?.resume && !replaceExisting) throw existingResumeError();

  let resumeText;
  try {
    resumeText = await extractText(file.filePath);
  } catch (error) {
    throw error;
  }

  const now = new Date().toISOString();
  try {
    await assignments.insertOne({
      legacyResumeId: file.fileName,
      status: 'PENDING',
      studentId: normalizedStudentId,
      assignedBy: normalizedAssignerId,
      reservedAt: now,
      action: 'RESUME_REATTACHED'
    });
  } catch (error) {
    if (duplicateReservation(error)) throw serviceError('This legacy resume has already been assigned and cannot be attached again.', 'LEGACY_RESUME_ALREADY_ASSIGNED', 409);
    throw error;
  }

  const resume = {
    id: file.fileName,
    // Historical records do not retain the student-supplied filename. This is
    // an explicit display label, not a claim about the original filename.
    originalName: `Recovered legacy resume.${file.metadata.fileType.toLowerCase()}`,
    mimeType: file.metadata.mimeType,
    fileType: file.metadata.fileType,
    size: file.metadata.size,
    uploadedAt: file.metadata.modifiedAt,
    resumeText
  };
  let saved;
  try {
    saved = await setProfileResume(normalizedStudentId, resume, {
      profilesCollection: profiles,
      // A normal upload has no precondition. A manual reattachment must not
      // overwrite a profile changed after the TPO opened this confirmation.
      expectedResume: profile?.resume || null
    });
    if (!saved.updated) {
      throw serviceError('This student resume changed before assignment. Reopen the student and confirm again.', 'STUDENT_RESUME_CHANGED', 409);
    }
  } catch (error) {
    await assignments.deleteOne({ legacyResumeId: file.fileName, status: 'PENDING' }).catch(() => {});
    throw error;
  }

  const profileForAnalysis = {
    ...(profile || {}),
    userId: normalizedStudentId,
    resume: saved.resume,
    resumeAnalysis: profile?.resume?.sourceHash === saved.resume.sourceHash ? profile.resumeAnalysis : null
  };
  const analyzed = await ensureResumeAnalysis(profileForAnalysis, { profilesCollection: profiles, generateJson });
  const assignedAt = new Date().toISOString();
  await assignments.updateOne(
    { legacyResumeId: file.fileName, status: 'PENDING' },
    {
      $set: {
        status: 'ASSIGNED',
        studentId: normalizedStudentId,
        assignedBy: normalizedAssignerId,
        assignedAt,
        action: 'RESUME_REATTACHED'
      },
      $unset: { reservedAt: '' }
    }
  );
  return {
    legacyResume: { ...file.metadata, status: 'ASSIGNED' },
    studentId: normalizedStudentId,
    analysisStatus: analyzed.resumeAnalysis?.status || 'PENDING',
    assignedAt
  };
}
