import { createHash } from 'node:crypto';
import { requestGeminiJson } from './aiService.js';
import { catalogSkills, isCatalogSkill, uniqueSkills } from './skillNormalization.js';
import { getStudentProfilesCollection } from './database.js';
import { extractResumeText } from './resumeParser.js';
import { resumePathFromId } from '../middleware/upload.js';

const technicalFields = ['skills', 'tools', 'technologies', 'frameworks'];
const RETRY_DELAY_MS = 5 * 60 * 1000;

function resumeError(message, code = 'RESUME_ANALYSIS_INVALID', statusCode = 422) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function cleanText(value, maxLength = 240) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function cleanTextList(value, label, maxItems = 30, maxLength = 240) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function cleanTechnicalList(value, label) {
  const entities = cleanTextList(value, label, 50, 120);
  // Gemini can mention resume-specific terms that the shared catalog does not
  // support. Ignore only those terms; never replace them with profile skills
  // or a guessed catalog value.
  return uniqueSkills(entities.filter(isCatalogSkill));
}

function cleanProjects(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((project) => {
    const item = project && typeof project === 'object' && !Array.isArray(project) ? project : {};
    const name = cleanText(item.name, 160);
    const technologies = cleanTechnicalList(Array.isArray(item.technologies) ? item.technologies : [], 'project technologies');
    return { name, technologies };
  }).filter((project) => project.name || project.technologies.length);
}

function sourceText(resumeText) {
  const text = String(resumeText || '').trim().slice(0, 50_000);
  if (!text) throw resumeError('A parsed resume is required before resume analysis can run.', 'RESUME_UNAVAILABLE', 400);
  return text;
}

export function resumeTextHash(resumeText) {
  return createHash('sha256').update(sourceText(resumeText)).digest('hex');
}

function extractionPrompt(resumeText) {
  return `You extract structured technical evidence from one student resume. Return JSON only with exactly this shape:
{"skills":[],"tools":[],"technologies":[],"frameworks":[],"projects":[{"name":"","technologies":[]}],"experience":[],"certifications":[]}

Rules:
- Extract only information explicitly supported by the resume. Never invent skills, technologies, projects, experience, certifications, scores, eligibility, rankings, or missing skills.
- The arrays skills, tools, technologies, frameworks, and every projects[].technologies list may contain ONLY a matching item from this centralized catalog: ${catalogSkills().join(', ')}.
- Preserve technical distinctions: Java and JavaScript are different. Do not infer a technology from a generic statement such as "worked on a web application".
- A project technology may be listed only when the resume explicitly names it for that project.
- experience and certifications are concise text entries directly supported by the resume. Do not include contact details or personal identifiers.
- Every field must be an array. Do not add prose, Markdown, or fields outside this JSON object.

RESUME:\n${resumeText}`;
}

export function normalizeResumeAnalysis(rawAnalysis, resumeText) {
  const text = sourceText(resumeText);
  if (!rawAnalysis || typeof rawAnalysis !== 'object' || Array.isArray(rawAnalysis)) {
    throw resumeError('Resume analysis returned an invalid response.');
  }
  const normalized = Object.fromEntries(technicalFields.map((field) => [field, cleanTechnicalList(rawAnalysis[field], field)]));
  normalized.projects = cleanProjects(rawAnalysis.projects);
  normalized.experience = cleanTextList(rawAnalysis.experience, 'experience', 20);
  normalized.certifications = cleanTextList(rawAnalysis.certifications, 'certifications', 20);
  return { ...normalized, resumeHash: resumeTextHash(text) };
}

export function resumeEvidenceSkills(analysis) {
  if (!analysis || analysis.status !== 'READY') return [];
  const projectTechnologies = Array.isArray(analysis.projects) ? analysis.projects.flatMap((project) => project?.technologies || []) : [];
  return uniqueSkills([
    ...(analysis.skills || []),
    ...(analysis.tools || []),
    ...(analysis.technologies || []),
    ...(analysis.frameworks || []),
    ...projectTechnologies
  ]).filter(isCatalogSkill);
}

/** Gemini extracts evidence only. JD matching is deliberately handled elsewhere. */
export async function analyzeResumeText(resumeText, generateJson = requestGeminiJson) {
  const text = sourceText(resumeText);
  let extracted;
  try {
    extracted = await generateJson(extractionPrompt(text), 'Gemini returned no resume analysis.');
  } catch (error) {
    if (error?.code?.startsWith('RESUME_')) throw error;
    if (error?.code === 'GEMINI_INVALID_RESPONSE') throw resumeError('Resume analysis returned invalid data. Please try again.', 'RESUME_ANALYSIS_INVALID');
    throw resumeError('Unable to analyze this resume right now.', 'RESUME_ANALYSIS_UNAVAILABLE', 503);
  }
  return { status: 'READY', ...normalizeResumeAnalysis(extracted, text), analyzedAt: new Date().toISOString() };
}

function resumeSource(profile) {
  const resume = profile?.resume && typeof profile.resume === 'object' ? profile.resume : null;
  const resumeText = typeof resume?.resumeText === 'string' ? resume.resumeText : '';
  if (!resumeText.trim()) return null;
  return { resumeText, resumeHash: resumeTextHash(resumeText) };
}

export function resumeAvailabilityState(profile) {
  const resume = profile?.resume && typeof profile.resume === 'object' ? profile.resume : null;
  if (!resume) return 'NO_UPLOAD';
  if (typeof resume.resumeText === 'string' && resume.resumeText.trim()) return 'PARSED';
  if (resume.parseStatus === 'FAILED') return 'PARSING_FAILED';
  if (resumePathFromId(resume.id)) return 'PARSING_PENDING';
  // Older records may prove an upload happened but have neither parsed text
  // nor the generated file id needed to locate it. They must not be reported
  // as "no upload" and cannot be safely paired with an arbitrary disk file.
  return 'LEGACY_METADATA';
}

function canRetryAt(value) {
  const timestamp = Date.parse(String(value || ''));
  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}

async function persistResumeSource(profile, resume, source, profilesCollection) {
  const currentHash = typeof resume.sourceHash === 'string' ? resume.sourceHash : '';
  if (currentHash === source.resumeHash) return { ...profile, resume: { ...resume, sourceHash: source.resumeHash } };
  await (await profilesCollection).updateOne(
    { userId: profile.userId },
    {
      $set: { 'resume.sourceHash': source.resumeHash, 'resume.parseStatus': 'READY', updatedAt: new Date().toISOString() },
      $unset: { resumeAnalysis: '' }
    }
  );
  return { ...profile, resume: { ...resume, sourceHash: source.resumeHash, parseStatus: 'READY' }, resumeAnalysis: null };
}

async function ensureResumeSource(profile, { extractText = extractResumeText, profilesCollection } = {}) {
  const resume = profile?.resume && typeof profile.resume === 'object' ? profile.resume : null;
  if (!resume) return { profile, source: null, availability: 'NO_UPLOAD' };

  const stored = resumeSource(profile);
  if (stored) {
    return { profile: await persistResumeSource(profile, resume, stored, profilesCollection), source: stored, availability: 'PARSED' };
  }

  if (resume.parseStatus === 'FAILED' && !canRetryAt(resume.parseRetryAt)) {
    return { profile, source: null, availability: 'PARSING_FAILED' };
  }

  const filePath = resumePathFromId(resume.id);
  if (!filePath) return { profile, source: null, availability: 'LEGACY_METADATA' };

  let parsedText;
  try {
    parsedText = sourceText(await extractText(filePath));
  } catch {
    const parseRetryAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
    await (await profilesCollection).updateOne(
      { userId: profile.userId, 'resume.id': resume.id },
      { $set: { 'resume.parseStatus': 'FAILED', 'resume.parseRetryAt': parseRetryAt, updatedAt: new Date().toISOString() } }
    );
    return { profile: { ...profile, resume: { ...resume, parseStatus: 'FAILED', parseRetryAt } }, source: null, availability: 'PARSING_FAILED' };
  }

  const source = { resumeText: parsedText, resumeHash: resumeTextHash(parsedText) };
  await (await profilesCollection).updateOne(
    { userId: profile.userId, 'resume.id': resume.id },
    {
      $set: {
        'resume.resumeText': parsedText,
        'resume.sourceHash': source.resumeHash,
        'resume.parseStatus': 'READY',
        'resume.parsedAt': new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      $unset: { 'resume.parseRetryAt': '', resumeAnalysis: '' }
    }
  );
  return { profile: { ...profile, resume: { ...resume, resumeText: parsedText, sourceHash: source.resumeHash, parseStatus: 'READY' }, resumeAnalysis: null }, source, availability: 'PARSED' };
}

function cachedAnalysis(profile, source) {
  const cached = profile?.resumeAnalysis;
  if (!cached || cached.resumeHash !== source.resumeHash) return null;
  if (cached.status === 'READY') return cached;
  if (cached.status === 'FAILED' && !canRetryAt(cached.retryAfter)) return cached;
  return null;
}

function failedAnalysis(resumeHash, error) {
  return {
    status: 'FAILED',
    resumeHash,
    analyzedAt: new Date().toISOString(),
    retryAfter: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
    failureCode: error?.code === 'RESUME_ANALYSIS_INVALID' ? 'RESUME_ANALYSIS_INVALID' : 'RESUME_ANALYSIS_UNAVAILABLE'
  };
}

/**
 * Returns a profile copy containing a hash-matched cached extraction. Resume
 * text never leaves this service or the student-owned upload response.
 */
export async function ensureResumeAnalysis(profile, { generateJson = requestGeminiJson, extractText = extractResumeText, profilesCollection = getStudentProfilesCollection() } = {}) {
  const prepared = await ensureResumeSource(profile, { extractText, profilesCollection });
  if (!prepared.source) return { ...prepared.profile, resumeAnalysis: null };
  const cached = cachedAnalysis(prepared.profile, prepared.source);
  if (cached) return { ...prepared.profile, resumeAnalysis: cached };

  let analysis;
  try {
    analysis = await analyzeResumeText(prepared.source.resumeText, generateJson);
  } catch (error) {
    analysis = failedAnalysis(prepared.source.resumeHash, error);
  }

  await (await profilesCollection).updateOne(
    { userId: prepared.profile.userId, 'resume.sourceHash': prepared.source.resumeHash },
    { $set: { resumeAnalysis: analysis, updatedAt: new Date().toISOString() } }
  );
  return { ...prepared.profile, resumeAnalysis: analysis };
}

export async function ensureResumeAnalyses(profiles, options = {}) {
  const sourceProfiles = Array.isArray(profiles) ? profiles : [];
  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || 2, 4));
  const results = new Array(sourceProfiles.length);
  let cursor = 0;
  async function worker() {
    while (cursor < sourceProfiles.length) {
      const index = cursor++;
      results[index] = await ensureResumeAnalysis(sourceProfiles[index], options);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sourceProfiles.length) }, worker));
  return results;
}
