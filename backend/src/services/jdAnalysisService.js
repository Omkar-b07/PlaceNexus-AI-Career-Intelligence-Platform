import { createHash } from 'node:crypto';
import { requestGeminiJson } from './aiService.js';
import { isCatalogSkill, uniqueSkills, catalogSkills } from './skillNormalization.js';

const technicalFields = ['requiredSkills', 'preferredSkills', 'tools', 'technologies', 'frameworks'];
const textFields = ['responsibilities', 'roleKeywords'];

function jdError(message, code = 'JD_ANALYSIS_INVALID', statusCode = 422) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function cleanText(value, maxLength = 240) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function cleanTextList(value, label, maxItems = 20, maxLength = 240) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw jdError(`Job-description analysis returned an invalid ${label} list.`);
  }
  return [...new Set(value.map((item) => cleanText(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function cleanTechnicalList(value, label) {
  const entities = cleanTextList(value, label, 50, 120);
  const unsupported = entities.filter((entity) => !isCatalogSkill(entity));
  if (unsupported.length) {
    throw jdError(`Job-description analysis included unsupported ${label}. Review the description and try again.`, 'JD_ANALYSIS_UNSUPPORTED_ENTITY');
  }
  return uniqueSkills(entities);
}

function sourceText(jobDescription) {
  const description = cleanText(jobDescription, 12_000);
  if (!description) throw jdError('Enter a job description before analyzing it.', 'JD_DESCRIPTION_REQUIRED', 400);
  if (description.length < 50) throw jdError('Provide a more detailed job description (at least 50 characters) before analyzing it.', 'JD_DESCRIPTION_TOO_SHORT', 400);
  return description;
}

export function jobDescriptionHash(jobDescription) {
  return createHash('sha256').update(sourceText(jobDescription)).digest('hex');
}

function extractionPrompt(jobDescription) {
  return `You extract structured role requirements from one job description. Return JSON only with exactly these arrays:
{"requiredSkills":[],"preferredSkills":[],"tools":[],"technologies":[],"frameworks":[],"responsibilities":[],"roleKeywords":[]}

Rules:
- Extract only information explicitly supported by the job description. Never invent skills, requirements, student suitability, scores, or ranking.
- Put a skill in requiredSkills only when the JD says or clearly indicates required, must have, experience with, proficiency, strong knowledge, or an equivalent mandatory phrase.
- Put a skill in preferredSkills only for preferred, nice-to-have, good-to-have, plus, or similarly optional wording. If wording is ambiguous, prefer preferredSkills.
- Technical lists may contain ONLY a matching item from this centralized catalog: ${catalogSkills().join(', ')}.
- Keep Java and JavaScript distinct. Do not turn Node into Node.js yourself; list the literal technical entity only when it is catalog-compatible.
- tools, technologies, and frameworks may overlap requiredSkills or preferredSkills, but must also use only catalog skills.
- responsibilities and roleKeywords are short phrases directly supported by the JD.
- Every field must be an array of strings. Do not add prose, Markdown, or fields outside this JSON object.

JOB DESCRIPTION:
${jobDescription}`;
}

export function normalizeJdAnalysis(rawAnalysis, jobDescription, { requireSourceHash = false } = {}) {
  const description = sourceText(jobDescription);
  if (!rawAnalysis || typeof rawAnalysis !== 'object' || Array.isArray(rawAnalysis)) {
    throw jdError('Job-description analysis returned an invalid response.');
  }
  if (requireSourceHash && rawAnalysis.sourceHash !== jobDescriptionHash(description)) {
    throw jdError('The job description changed after analysis. Re-analyze it before saving.', 'JD_ANALYSIS_STALE', 409);
  }

  const normalized = Object.fromEntries(technicalFields.map((field) => [field, cleanTechnicalList(rawAnalysis[field], field)]));
  normalized.preferredSkills = normalized.preferredSkills.filter((skill) => !normalized.requiredSkills.includes(skill));
  for (const field of textFields) normalized[field] = cleanTextList(rawAnalysis[field], field, 20);
  return { ...normalized, sourceHash: jobDescriptionHash(description) };
}

/**
 * Uses Gemini once per JD to extract a reviewable interpretation. Matching is
 * intentionally handled later by jdMatchingService, never by the model.
 */
export async function analyzeJobDescription(jobDescription, generateJson = requestGeminiJson) {
  const description = sourceText(jobDescription);
  let extracted;
  try {
    extracted = await generateJson(extractionPrompt(description), 'Gemini returned no job-description analysis.');
  } catch (error) {
    if (error?.code?.startsWith('JD_')) throw error;
    if (error?.code === 'GEMINI_INVALID_RESPONSE') throw jdError('Job-description analysis returned invalid data. Please try again.', 'JD_ANALYSIS_INVALID');
    throw jdError('Unable to analyze the job description. Please try again.', 'JD_ANALYSIS_UNAVAILABLE', 503);
  }

  return { ...normalizeJdAnalysis(extracted, description), analyzedAt: new Date().toISOString() };
}
