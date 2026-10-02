import { getDsaProblemsCollection } from '../services/preparationDatabase.js';
import { dashboardForUser, progressForUser, setProblemStatus } from '../services/dsaProgressService.js';

const MAX_LIMIT = 100;

function queryError(message) { const error = new Error(message); error.code = 'INVALID_DSA_QUERY'; error.statusCode = 400; return error; }

function positiveInteger(value, fallback, name) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) throw queryError(`${name} must be a positive integer.`);
  return Number(value);
}

export function dsaListQuery(query) {
  const page = positiveInteger(query.page, 1, 'page');
  const limit = positiveInteger(query.limit, 20, 'limit');
  if (limit > MAX_LIMIT) throw queryError(`limit must not exceed ${MAX_LIMIT}.`);
  const filter = {};
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (query.search !== undefined && typeof query.search !== 'string') throw queryError('search must be text.');
  if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };
  for (const field of ['difficulty', 'topic', 'status']) {
    if (query[field] !== undefined && (typeof query[field] !== 'string' || !query[field].trim())) throw queryError(`${field} must be non-empty text.`);
  }
  if (query.difficulty?.trim()) filter.difficulty = query.difficulty.trim();
  if (query.topic?.trim()) filter.topics = query.topic.trim();
  const status = query.status?.trim() || 'unsolved';
  if (!['all', 'solved', 'unsolved'].includes(status)) throw queryError('status must be all, solved, or unsolved.');
  return { filter, page, limit, status };
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function publicProblem(problem, solvedIds) { return { id: problem.externalId, title: problem.title, difficulty: problem.difficulty, topics: problem.topics || [], url: problem.url || null, status: solvedIds.has(problem.externalId) ? 'solved' : 'unsolved' }; }

export async function listProblems(req, res, next) {
  try {
    const { filter, page, limit, status } = dsaListQuery(req.query);
    const collection = await getDsaProblemsCollection();
    const progress = await progressForUser(req.user.id); const solvedIds = new Set((progress?.solvedProblems || []).map((item) => item.problemId));
    if (status === 'solved') filter.externalId = { $in: [...solvedIds] };
    if (status === 'unsolved' && solvedIds.size) filter.externalId = { $nin: [...solvedIds] };
    const [problems, total] = await Promise.all([collection.find(filter).project({ _id: 0, externalId: 1, title: 1, difficulty: 1, topics: 1, url: 1 }).sort({ title: 1, externalId: 1 }).skip((page - 1) * limit).limit(limit).toArray(), collection.countDocuments(filter)]);
    return res.json({ success: true, data: { problems: problems.map((problem) => publicProblem(problem, solvedIds)), pagination: { page, limit, total } } });
  } catch (error) { return next(error); }
}

async function distinctValues(field, res, next) {
  try { const values = (await (await getDsaProblemsCollection()).distinct(field, field === 'topics' ? { topics: { $ne: '' } } : {})).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))); return res.json({ success: true, data: { items: values } }); } catch (error) { return next(error); }
}
export const listTopics = (_req, res, next) => distinctValues('topics', res, next);
export const listDifficulties = (_req, res, next) => distinctValues('difficulty', res, next);
export async function getDashboard(req, res, next) { try { return res.json({ success: true, data: await dashboardForUser(req.user.id) }); } catch (error) { return next(error); } }
export async function getProgress(req, res, next) { try { const progress = await progressForUser(req.user.id); return res.json({ success: true, data: { solvedProblemIds: (progress?.solvedProblems || []).map((item) => item.problemId) } }); } catch (error) { return next(error); } }
export async function updateProblemStatus(req, res, next) { try { const status = req.body?.status; if (!['solved', 'unsolved'].includes(status)) throw queryError('status must be solved or unsolved.'); if (typeof req.params.problemId !== 'string' || !req.params.problemId.trim() || req.params.problemId.length > 200) throw queryError('A valid problem ID is required.'); return res.json({ success: true, data: { dashboard: await setProblemStatus(req.user.id, req.params.problemId, status) } }); } catch (error) { return next(error); } }
