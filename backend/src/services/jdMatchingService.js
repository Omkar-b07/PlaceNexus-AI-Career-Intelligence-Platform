import { normalizeSkill, uniqueSkills } from './skillNormalization.js';

export const JD_MATCH_WEIGHTS = Object.freeze({ required: 0.8, preferred: 0.2 });
export const JD_ROLE_FIT_BUCKETS = Object.freeze([
  { key: 'excellent', label: '90–100%', minimum: 90 },
  { key: 'strong', label: '75–89%', minimum: 75 },
  { key: 'developing', label: '60–74%', minimum: 60 },
  { key: 'early', label: 'Below 60%', minimum: 0 }
]);

function percentage(value, total) {
  return total > 0 ? (value / total) * 100 : 0;
}

function matchingSkills(studentSkills, requirements) {
  const normalizedStudentSkills = new Set(uniqueSkills(studentSkills).map(normalizeSkill));
  const required = uniqueSkills(requirements);
  return {
    matched: required.filter((skill) => normalizedStudentSkills.has(normalizeSkill(skill))),
    missing: required.filter((skill) => !normalizedStudentSkills.has(normalizeSkill(skill))),
    total: required.length
  };
}

/**
 * A deterministic role-fit score. Required skills contribute 80% and preferred
 * skills 20%; when a JD has only one category, that category supplies 100%.
 */
export function matchStudentToJd(profile, jdAnalysis) {
  const required = matchingSkills(profile?.skills, jdAnalysis?.requiredSkills);
  const preferred = matchingSkills(profile?.skills, jdAnalysis?.preferredSkills);
  const requiredPercentage = required.total ? percentage(required.matched.length, required.total) : null;
  const preferredPercentage = preferred.total ? percentage(preferred.matched.length, preferred.total) : null;
  const matchPercentage = requiredPercentage !== null && preferredPercentage !== null
    ? Math.round(requiredPercentage * JD_MATCH_WEIGHTS.required + preferredPercentage * JD_MATCH_WEIGHTS.preferred)
    : Math.round(requiredPercentage ?? preferredPercentage ?? 0);

  return {
    requiredMatched: required.matched,
    requiredMissing: required.missing,
    requiredTotal: required.total,
    requiredPercentage,
    preferredMatched: preferred.matched,
    preferredMissing: preferred.missing,
    preferredTotal: preferred.total,
    preferredPercentage,
    matchPercentage
  };
}

export function roleFitBucket(matchPercentage) {
  return JD_ROLE_FIT_BUCKETS.find((bucket) => matchPercentage >= bucket.minimum) || JD_ROLE_FIT_BUCKETS.at(-1);
}
