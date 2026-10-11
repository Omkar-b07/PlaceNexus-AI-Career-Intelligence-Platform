import { getStudentProfilesCollection, getUsersCollection } from './database.js';
import { normalizeLocations, normalizeProfileSkills, normalizeRoles } from './profileNormalization.js';
import { resumeTextHash } from './resumeAnalysisService.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const profileCatalog = require('../../../shared/profileCatalog.json');
const branchValues = new Set(profileCatalog.branchOptions.map(({ value }) => value));

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'INVALID_PROFILE';
  return error;
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function text(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function skillState(value) {
  const normalized = normalizeProfileSkills(value);
  return {
    skills: normalized.skills.map((skill) => text(skill, 80)).slice(0, 50),
    legacySkills: normalized.legacySkills.map((skill) => text(skill, 80)).slice(0, 50)
  };
}

function savedSkills(value) {
  const normalized = skillState(value);
  if (normalized.legacySkills.length) {
    throw validationError(`Choose skills from the catalog instead of unsupported entries: ${normalized.legacySkills.join(', ')}.`);
  }
  return normalized.skills;
}

function storedNumber(value, integer = false) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && (!integer || Number.isInteger(number)) ? number : null;
}

function numberOrNull(value, label, min, max, integer = false) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
    throw validationError(`${label} must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}.`);
  }
  return number;
}

function phone(value) {
  const cleaned = String(value || '').replace(/[\s()\-]/g, '');
  if (cleaned && !/^\+?\d{7,15}$/.test(cleaned)) throw validationError('Enter a valid phone number with 7 to 15 digits.');
  return cleaned;
}

const socialLinkDefinitions = Object.freeze({
  github: { label: 'GitHub', domain: 'github.com' },
  linkedin: { label: 'LinkedIn', domain: 'linkedin.com' },
  portfolio: { label: 'Portfolio' },
  leetcode: { label: 'LeetCode', domain: 'leetcode.com' }
});

export const emptySocialLinks = Object.freeze({ github: '', linkedin: '', portfolio: '', leetcode: '' });

function socialUrl(value, definition) {
  const candidate = text(value, 300);
  if (!candidate) return '';
  let parsed;
  try { parsed = new URL(candidate); } catch { throw validationError(`${definition.label} must be a valid http or https URL.`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw validationError(`${definition.label} must be a valid http or https URL.`);
  }
  if (definition.domain && parsed.hostname !== definition.domain && !parsed.hostname.endsWith(`.${definition.domain}`)) {
    throw validationError(`Enter a ${definition.label} URL hosted on ${definition.domain}.`);
  }
  return parsed.toString();
}

export function normalizeSocialLinks(value, { validate = true } = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(socialLinkDefinitions).map(([key, definition]) => {
    try { return [key, socialUrl(source[key], definition)]; }
    catch (error) {
      if (validate) throw error;
      return [key, ''];
    }
  }));
}

function storedProfilePhotoUrl(value) {
  const url = text(value, 300);
  return /^\/profile-photos\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i.test(url) ? url : null;
}

function publicResume(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    originalName: text(value.originalName, 180),
    fileType: text(value.fileType, 20),
    size: storedNumber(value.size, true) || 0,
    updatedAt: text(value.updatedAt || value.uploadedAt, 40)
  };
}

function projects(value, validateTechnologies = false) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((project) => {
    const item = project && typeof project === 'object' ? project : {};
    const technologies = skillState(item.technologies ?? item.skills);
    if (validateTechnologies && technologies.legacySkills.length) {
      throw validationError(`Choose project technologies from the catalog instead of unsupported entries: ${technologies.legacySkills.join(', ')}.`);
    }
    return {
      title: text(item.title, 120),
      description: text(item.description, 500),
      technologies: technologies.skills,
      githubUrl: text(item.githubUrl, 300),
      liveUrl: text(item.liveUrl || item.url, 300),
      startDate: text(item.startDate, 10),
      endDate: text(item.endDate, 10)
    };
  }).filter((project) => project.title || project.description || project.technologies.length || project.githubUrl || project.liveUrl);
}

export function normalizePartial(input, existingBranch) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw validationError('Profile data must be an object.');
  const next = {};
  if (own(input, 'fullName')) next.fullName = text(input.fullName, 120);
  if (own(input, 'phone')) next.phone = phone(input.phone);
  if (own(input, 'branch')) {
    const branch = text(input.branch, 120);
    if (branchValues.has(branch)) next.branch = branch;
    else if (branch !== existingBranch) throw validationError('Choose a valid branch / department.');
  }
  if (own(input, 'college')) next.college = text(input.college, 160);
  if (own(input, 'cgpa')) next.cgpa = numberOrNull(input.cgpa, 'CGPA', 0, 10);
  if (own(input, 'backlogs')) next.backlogs = numberOrNull(input.backlogs, 'Backlogs', 0, 50, true);
  if (own(input, 'graduationYear')) next.graduationYear = numberOrNull(input.graduationYear, 'Graduation year', 2020, 2045, true);
  if (own(input, 'skills')) next.skills = savedSkills(input.skills);
  if (own(input, 'projects')) next.projects = projects(input.projects, true);
  if (own(input, 'preferredRoles')) next.preferredRoles = normalizeRoles(input.preferredRoles).map((role) => text(role, 80)).slice(0, 15);
  if (own(input, 'preferredLocations')) next.preferredLocations = normalizeLocations(input.preferredLocations).map((location) => text(location, 80)).slice(0, 15);
  if (own(input, 'socialLinks')) next.socialLinks = normalizeSocialLinks(input.socialLinks);
  return next;
}

function toProfile(user, document) {
  const profile = document || {};
  const skills = skillState(profile.skills);
  return {
    fullName: profile.fullName || '',
    phone: profile.phone || '',
    branch: profile.branch || '',
    college: profile.college || '',
    cgpa: storedNumber(profile.cgpa),
    backlogs: storedNumber(profile.backlogs, true),
    graduationYear: storedNumber(profile.graduationYear, true),
    skills: skills.skills,
    legacySkills: skills.legacySkills,
    projects: projects(profile.projects),
    preferredRoles: normalizeRoles(profile.preferredRoles),
    preferredLocations: normalizeLocations(profile.preferredLocations),
    // Parsed resume text and its cached analysis stay server-side. A student
    // receives only their resume metadata through the profile endpoint.
    resume: publicResume(profile.resume),
    profilePhotoUrl: storedProfilePhotoUrl(profile.profilePhotoUrl),
    socialLinks: normalizeSocialLinks(profile.socialLinks, { validate: false }),
    email: user.email
  };
}

function present(value) {
  return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== '';
}

export function profileCompletion(profile) {
  const fields = [
    ['fullName', 'Full name', true], ['phone', 'Phone number', true], ['branch', 'Branch / department', true],
    ['college', 'College', true], ['cgpa', 'CGPA', true], ['backlogs', 'Backlogs', true],
    ['graduationYear', 'Graduation year', true], ['skills', 'Skills', true], ['projects', 'Projects', false],
    ['resume', 'Resume', false], ['preferredRoles', 'Preferred job roles', true], ['preferredLocations', 'Preferred locations', true]
  ].map(([key, label, mandatory]) => ({ key, label, mandatory, completed: present(profile[key]) }));
  const completed = fields.filter((field) => field.completed).length;
  return {
    percentage: Math.round((completed / fields.length) * 100),
    fields,
    missingFields: fields.filter((field) => !field.completed).map((field) => field.label),
    missingMandatory: fields.filter((field) => field.mandatory && !field.completed).map((field) => field.label)
  };
}

export async function getStudentProfile(user) {
  const document = await (await getStudentProfilesCollection()).findOne({ userId: user.id });
  return toProfile(user, document);
}

export async function listStudentProfiles() {
  const profiles = await (await getStudentProfilesCollection()).find({}).toArray();
  return profiles.map((profile) => ({ ...profile, id: String(profile._id) }));
}

export async function listActiveStudentProfiles() {
  const profiles = await (await getStudentProfilesCollection()).find({ userId: { $exists: true, $ne: '' } }).toArray();
  const userIds = [...new Set(profiles.map((profile) => String(profile.userId)).filter(Boolean))];
  if (!userIds.length) return [];

  // Accounts created before roles were introduced are treated as students,
  // matching the auth service's existing default-role behavior.
  const studentUsers = await (await getUsersCollection()).find(
    { _id: { $in: userIds }, role: { $in: ['STUDENT', null] } },
    { projection: { _id: 1 } }
  ).toArray();
  const activeStudentIds = new Set(studentUsers.map((user) => String(user._id)));
  return profiles
    // The same mandatory fields used by the student workspace determine whether
    // a profile represents a usable student record for TPO analytics.
    .filter((profile) => activeStudentIds.has(String(profile.userId)) && profileCompletion(profile).missingMandatory.length === 0)
    .map((profile) => ({ ...profile, id: String(profile._id) }));
}

/**
 * Resume analysis can evaluate a student whose only missing profile field is
 * skills. The existing profile-mode listing remains unchanged, so its default
 * behavior and eligibility population are preserved.
 */
export async function listActiveStudentProfilesForResumeAnalytics() {
  const profiles = await (await getStudentProfilesCollection()).find({ userId: { $exists: true, $ne: '' } }).toArray();
  const userIds = [...new Set(profiles.map((profile) => String(profile.userId)).filter(Boolean))];
  if (!userIds.length) return [];
  const studentUsers = await (await getUsersCollection()).find(
    { _id: { $in: userIds }, role: { $in: ['STUDENT', null] } },
    { projection: { _id: 1 } }
  ).toArray();
  const activeStudentIds = new Set(studentUsers.map((user) => String(user._id)));
  return profiles
    .filter((profile) => {
      if (!activeStudentIds.has(String(profile.userId))) return false;
      return profileCompletion(profile).missingMandatory.every((field) => field === 'Skills');
    })
    .map((profile) => ({ ...profile, id: String(profile._id) }));
}

export async function listStudentProfilesForTpo() {
  const [profiles, users] = await Promise.all([
    (await getStudentProfilesCollection()).find({ userId: { $exists: true, $ne: '' } }).toArray(),
    (await getUsersCollection()).find(
      { role: { $in: ['STUDENT', null] } },
      { projection: { _id: 1 } }
    ).toArray()
  ]);
  const profilesByUserId = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  return users.map((user) => {
    const profile = profilesByUserId.get(String(user._id)) || {};
    return { ...profile, userId: String(user._id), id: profile._id ? String(profile._id) : null };
  });
}

export async function updateStudentProfile(user, input) {
  const profiles = await getStudentProfilesCollection();
  const existing = await profiles.findOne({ userId: user.id }, { projection: { branch: 1 } });
  const changes = normalizePartial(input, existing?.branch);
  const now = new Date().toISOString();
  await profiles.updateOne(
    { userId: user.id },
    { $set: { ...changes, updatedAt: now }, $setOnInsert: { userId: user.id, createdAt: now } },
    { upsert: true }
  );
  return getStudentProfile(user);
}

function resumePrecondition(expectedResume) {
  if (expectedResume === null) return { resume: { $exists: false } };
  if (!expectedResume || typeof expectedResume !== 'object') return {};
  const updatedAt = text(expectedResume.updatedAt, 40);
  if (updatedAt) return { 'resume.updatedAt': updatedAt };
  const id = text(expectedResume.id, 80);
  if (id) return { 'resume.id': id };
  const originalName = text(expectedResume.originalName, 180);
  if (originalName) return { 'resume.originalName': originalName };
  return { resume: expectedResume };
}

export async function setProfileResume(userId, resume, { profilesCollection = getStudentProfilesCollection(), expectedResume = undefined } = {}) {
  const profiles = await profilesCollection;
  const resumeText = String(resume?.resumeText || '').trim();
  const sourceHash = resumeTextHash(resumeText);
  const now = new Date().toISOString();
  const current = await profiles.findOne({ userId }, { projection: { resume: 1 } });
  const update = {
    $set: {
      resume: {
        // These fields are already produced by the existing upload flow. Keep
        // them with the canonical resume record instead of discarding the
        // only safe reference to the uploaded file.
        id: text(resume.id, 80),
        originalName: text(resume.originalName, 180),
        mimeType: text(resume.mimeType, 120),
        fileType: text(resume.fileType, 20),
        size: storedNumber(resume.size, true) || 0,
        uploadedAt: text(resume.uploadedAt, 40) || now,
        updatedAt: now,
        parseStatus: 'READY',
        parsedAt: now,
        sourceHash,
        // This text was already extracted by the backend from the student's
        // authorized upload. It is never sent to TPO analytics clients.
        resumeText
      },
      updatedAt: now
    },
    $setOnInsert: { userId, createdAt: now }
  };
  if (current?.resume?.sourceHash !== sourceHash) update.$unset = { resumeAnalysis: '' };
  const result = await profiles.updateOne(
    { userId, ...(expectedResume === undefined ? {} : resumePrecondition(expectedResume)) },
    update,
    { upsert: expectedResume === undefined }
  );
  return {
    updated: expectedResume === undefined || Number(result?.matchedCount || 0) === 1,
    resume: update.$set.resume
  };
}

export async function replaceProfilePhoto(userId, profilePhotoUrl) {
  const profiles = await getStudentProfilesCollection();
  const current = await profiles.findOne({ userId }, { projection: { profilePhotoUrl: 1 } });
  const now = new Date().toISOString();
  await profiles.updateOne(
    { userId },
    { $set: { profilePhotoUrl: storedProfilePhotoUrl(profilePhotoUrl), updatedAt: now }, $setOnInsert: { userId, createdAt: now } },
    { upsert: true }
  );
  return storedProfilePhotoUrl(current?.profilePhotoUrl);
}

export async function removeProfilePhoto(userId) {
  const profiles = await getStudentProfilesCollection();
  const current = await profiles.findOne({ userId }, { projection: { profilePhotoUrl: 1 } });
  if (!current) return null;
  const now = new Date().toISOString();
  await profiles.updateOne({ userId }, { $unset: { profilePhotoUrl: '' }, $set: { updatedAt: now } });
  return storedProfilePhotoUrl(current.profilePhotoUrl);
}
