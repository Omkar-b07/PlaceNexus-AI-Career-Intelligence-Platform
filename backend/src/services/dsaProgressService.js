import { getDsaProblemsCollection, getDsaProgressCollection } from './preparationDatabase.js';

// Progress dates deliberately use UTC calendar days. The API returns the same YYYY-MM-DD
// keys to every client, so streaks are calculated consistently instead of depending on a browser clock.
function dateKey(value = new Date()) { return new Date(value).toISOString().slice(0, 10); }
function dateNumber(date) { return Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 86_400_000); }

export function streaksFromActivity(activity, referenceDate = new Date()) {
  const dates = [...new Set(activity.map((item) => item.date).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
  let longestStreak = 0; let run = 0; let previous;
  for (const date of dates) { run = previous === undefined || dateNumber(date) === dateNumber(previous) + 1 ? run + 1 : 1; longestStreak = Math.max(longestStreak, run); previous = date; }
  const today = dateKey(referenceDate); const yesterday = dateKey(referenceDate.getTime() - 86_400_000); const endingDate = dates.at(-1);
  let currentStreak = 0;
  if (endingDate === today || endingDate === yesterday) {
    for (let index = dates.length - 1; index >= 0; index -= 1) { if (index === dates.length - 1 || dateNumber(dates[index + 1]) === dateNumber(dates[index]) + 1) currentStreak += 1; else break; }
  }
  return { currentStreak, longestStreak };
}

export function activityFromProgress(progress) {
  const counts = new Map();
  for (const item of progress?.solvedProblems || []) { if (item?.date) counts.set(item.date, (counts.get(item.date) || 0) + 1); }
  return [...counts].map(([date, solvedCount]) => ({ date, solvedCount })).sort((a, b) => a.date.localeCompare(b.date));
}

export async function progressForUser(userId) { return (await getDsaProgressCollection()).findOne({ userId }); }

export async function dashboardForUser(userId) {
  const [problems, progress] = await Promise.all([getDsaProblemsCollection(), progressForUser(userId)]);
  const [totalQuestions, difficultyRows] = await Promise.all([problems.countDocuments(), problems.aggregate([{ $group: { _id: '$difficulty', count: { $sum: 1 } } }]).toArray()]);
  const activity = activityFromProgress(progress); const { currentStreak, longestStreak } = streaksFromActivity(activity); const solved = progress?.solvedProblems?.length || 0;
  const difficultyCounts = Object.fromEntries(difficultyRows.map((row) => [String(row._id), row.count]));
  return { totalQuestions, solved, completionPercentage: totalQuestions ? Number(((solved / totalQuestions) * 100).toFixed(2)) : 0, currentStreak, longestStreak, activity, difficultyCounts };
}

export async function setProblemStatus(userId, problemId, status) {
  const problems = await getDsaProblemsCollection();
  if (!await problems.findOne({ externalId: problemId }, { projection: { _id: 1 } })) { const error = new Error('DSA problem was not found.'); error.code = 'DSA_PROBLEM_NOT_FOUND'; error.statusCode = 404; throw error; }
  const progress = await getDsaProgressCollection();
  if (status === 'solved') {
    const now = new Date(); const solvedProblem = { problemId, solvedAt: now.toISOString(), date: dateKey(now) };
    await progress.updateOne({ userId }, { $setOnInsert: { userId, createdAt: now }, $pull: { solvedProblems: { problemId } }, $set: { updatedAt: now } }, { upsert: true });
    await progress.updateOne({ userId }, { $push: { solvedProblems: solvedProblem }, $set: { updatedAt: now } });
  } else {
    await progress.updateOne({ userId }, { $pull: { solvedProblems: { problemId } }, $set: { updatedAt: new Date() } }, { upsert: true });
  }
  return dashboardForUser(userId);
}
