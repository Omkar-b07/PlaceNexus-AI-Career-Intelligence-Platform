const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export const skillCatalog = [
  ['React', /\breact(?:\.js)?\b/i], ['TypeScript', /\btypescript\b/i], ['JavaScript', /\bjavascript\b/i], ['Node.js', /\bnode(?:\.js)?\b/i], ['Express.js', /\bexpress(?:\.js)?\b/i], ['MongoDB', /\bmongodb\b/i], ['Python', /\bpython\b/i], ['R', /(?:^|[\s,/])r(?=[\s,/.]|$)/i], ['Flask', /\bflask\b/i], ['SQL', /\bsql\b/i], ['MySQL', /\bmysql\b/i], ['PostgreSQL', /\bpostgres(?:ql)?\b/i], ['Excel', /\bexcel(?:\s+(?:vba|macros?))?\b/i], ['Tableau', /\btableau\b/i], ['Power BI', /\bpower\s?bi\b/i], ['Business Intelligence', /\bbusiness intelligence\b|\bbi tools?\b|\bbi dashboards?\b/i], ['Data Cleaning', /\bdata cleaning\b|\bclean(?:ing)? data\b|\bdata wrangling\b|\bclean up\b.{0,35}\b(?:records|data)\b|\bremove(?:d)? outliers\b/i], ['Data Visualization', /\bdata visuali[sz]ation\b|\bvisuali[sz]ation\b/i], ['Data Analysis', /\bdata analys(?:is|t|ing|ics)\b/i], ['Statistical Analysis', /\bstatistical analysis\b|\bstatistics\b/i], ['ETL', /\betl\b|\bextract,? transform,? (?:and )?load\b/i], ['KPIs', /\bkpis?\b|\bkey performance indicators\b|\bbusiness reports?\b|\bperformance metrics?\b/i], ['Problem Solving', /\bproblem[-\s]?solv(?:ing|e)\b|\bsolve\b.{0,35}\bproblems?\b/i], ['REST APIs', /\brest(?:ful)?\s+apis?\b/i], ['Kubernetes', /\bkubernetes\b/i], ['Docker', /\bdocker\b/i], ['AWS', /\baws\b|amazon web services/i], ['System Design', /\bsystem design\b/i], ['Design Systems', /\bdesign systems?\b/i], ['GraphQL', /\bgraphql\b/i], ['Git', /\bgit\b/i], ['CI/CD', /\bci\/?cd\b|continuous integration/i], ['Java', /\bjava\b/i], ['C#', /\bc#\b|c sharp/i], ['C++', /\bc\+\+\b/], ['Redis', /\bredis\b/i], ['Azure', /\bazure\b/i], ['Figma', /\bfigma\b/i], ['Communication', /\bcommunication\b/i], ['Leadership', /\bleadership\b/i], ['Agile', /\bagile\b|scrum/i]
];

export const resources = {
  Tableau: [{ title: 'Learn Tableau for free', resourceType: 'Free Course', provider: 'Tableau', url: 'https://www.tableau.com/en-gb/learn?locale=en_US', free: true, description: 'Official free training videos and data-visualization tutorials.', estimatedLearningTime: '2–4 hours' }],
  'Power BI': [{ title: 'Model data with Power BI', resourceType: 'Free Course', provider: 'Microsoft Learn', url: 'https://learn.microsoft.com/en-us/training/paths/model-data-power-bi/', free: true, description: 'Intermediate modeling, relationships, DAX, and semantic-model practice.', estimatedLearningTime: '5 hours 50 minutes' }],
  R: [{ title: 'Introduction to R', resourceType: 'Documentation', provider: 'R Project', url: 'https://www.r-project.org/about.html', free: true, description: 'Official introduction to R for statistical computing and graphics.', estimatedLearningTime: '2–3 hours' }],
  'Data Cleaning': [{ title: 'Prepare data for analysis with Power BI', resourceType: 'Free Course', provider: 'Microsoft Learn', url: 'https://learn.microsoft.com/en-us/training/paths/prepare-data-power-bi/', free: true, description: 'Intermediate Power Query practice for profiling, cleaning, and loading data.', estimatedLearningTime: '4 hours 33 minutes' }],
  AWS: [{ title: 'AWS IAM getting started', resourceType: 'Documentation', provider: 'AWS', url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started.html', free: true, description: 'Learn IAM identities, roles, and least-privilege access.', estimatedLearningTime: '1–2 hours' }],
  TypeScript: [{ title: 'The TypeScript Handbook', resourceType: 'Documentation', provider: 'TypeScript', url: 'https://www.typescriptlang.org/docs/handbook/', free: true, description: 'Official guide to everyday TypeScript patterns.', estimatedLearningTime: '3–5 hours' }],
  PostgreSQL: [{ title: 'PostgreSQL Tutorial', resourceType: 'Practice', provider: 'PostgreSQL', url: 'https://www.postgresql.org/docs/current/tutorial.html', free: true, description: 'Hands-on introduction to relational concepts and SQL.', estimatedLearningTime: '2–4 hours' }],
  Docker: [{ title: 'Docker Get Started', resourceType: 'Documentation', provider: 'Docker', url: 'https://docs.docker.com/get-started/', free: true, description: 'Official foundations for containerizing an application.', estimatedLearningTime: '1–2 hours' }],
  Kubernetes: [{ title: 'Kubernetes Basics', resourceType: 'Documentation', provider: 'Kubernetes', url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/', free: true, description: 'Official interactive introduction to deployments, services, and scaling.', estimatedLearningTime: '2–3 hours' }],
  'CI/CD': [{ title: 'Get started with GitHub Actions', resourceType: 'Documentation', provider: 'GitHub', url: 'https://docs.github.com/en/actions/get-started', free: true, description: 'Build a first automated test and deployment workflow.', estimatedLearningTime: '1–2 hours' }],
  React: [{ title: 'React Quick Start', resourceType: 'Documentation', provider: 'React', url: 'https://react.dev/learn', free: true, description: 'Official interactive introduction to core React concepts.', estimatedLearningTime: '2–3 hours' }],
  'Node.js': [{ title: 'Introduction to Node.js', resourceType: 'Documentation', provider: 'Node.js', url: 'https://nodejs.org/learn', free: true, description: 'Official introduction to Node runtime and HTTP services.', estimatedLearningTime: '30–60 minutes' }],
  SQL: [{ title: 'PostgreSQL SQL Tutorial', resourceType: 'Practice', provider: 'PostgreSQL', url: 'https://www.postgresql.org/docs/current/tutorial.html', free: true, description: 'Practice queries, joins, aggregates, and transactions.', estimatedLearningTime: '2–4 hours' }],
  Git: [{ title: 'Pro Git', resourceType: 'Free Course', provider: 'Git SCM', url: 'https://git-scm.com/book/en/v2', free: true, description: 'Free online book covering practical Git workflows.', estimatedLearningTime: '3–5 hours' }],
  'System Design': [{ title: 'System Design Primer', resourceType: 'Practice', provider: 'donnemartin', url: 'https://github.com/donnemartin/system-design-primer', free: true, description: 'Structured study guide with design questions and trade-offs.', estimatedLearningTime: '4–6 hours' }]
};

export const yearsMentioned = (text) => Math.max(0, ...[...text.matchAll(/(\d+)\+?\s+years?/gi)].map((match) => Number(match[1])));
export const jobSkills = (jobDescription) => skillCatalog.filter(([, pattern]) => pattern.test(jobDescription)).map(([name]) => name);
export const patternFor = (skill) => skillCatalog.find(([name]) => name === skill)?.[1];
export const hasSkill = (text, skill) => patternFor(skill)?.test(text) ?? text.toLowerCase().includes(skill.toLowerCase());
export const hasQualificationRequirement = (text) => /\b(bachelor|master|degree|b\.?(?:tech|s|e)|m\.?(?:tech|s|e)|qualification)\b/i.test(text);

function sentenceEvidence(text, skill) {
  const pattern = patternFor(skill);
  if (!pattern) return null;
  const snippets = text.split(/\n+|(?<=[.!?])\s+/).map((snippet) => snippet.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const projectSnippet = snippets.find((snippet) => /\b(project|built|developed|implemented|deployed|internship)\b/i.test(snippet) && pattern.test(snippet));
  const firstSnippet = snippets.find((snippet) => pattern.test(snippet));
  return (projectSnippet || firstSnippet || '').slice(0, 240) || null;
}

export function priorityFor(jobDescription, skill) {
  const position = jobDescription.search(patternFor(skill));
  const context = position < 0 ? '' : jobDescription.slice(Math.max(0, position - 100), position + 180);
  if (/\b(required|must have|minimum|required skills?)\b/i.test(context)) return 'High';
  if (/\b(preferred|nice to have|bonus|plus)\b/i.test(context)) return 'Low';
  return 'Medium';
}

function scoreComponents({ skillCoverage, experienceMatch, projectMatch, educationMatch, educationRequired }) {
  const weights = educationRequired ? { skills: 0.55, experience: 0.2, projects: 0.2, education: 0.05 } : { skills: 0.6, experience: 0.2, projects: 0.2, education: 0 };
  return { skillsMatch: Math.round(skillCoverage * 100), experienceMatch, projectMatch, educationMatch: educationRequired ? educationMatch : null, weights, overall: clamp(Math.round(skillCoverage * 100 * weights.skills + experienceMatch * weights.experience + projectMatch * weights.projects + educationMatch * weights.education)) };
}

function explainScore({ breakdown, requiredSkills, matchingSkills, requestedYears, resumeYears, experienceEvidence, projectEvidence, educationRequired, educationEvidence }) {
  const components = [
    { label: 'Skills', score: breakdown.skillsMatch, weight: breakdown.weights.skills, contribution: Math.round(breakdown.skillsMatch * breakdown.weights.skills) },
    { label: 'Experience', score: breakdown.experienceMatch, weight: breakdown.weights.experience, contribution: Math.round(breakdown.experienceMatch * breakdown.weights.experience) },
    { label: 'Projects', score: breakdown.projectMatch, weight: breakdown.weights.projects, contribution: Math.round(breakdown.projectMatch * breakdown.weights.projects) }
  ];
  if (educationRequired) components.push({ label: 'Education', score: breakdown.educationMatch, weight: breakdown.weights.education, contribution: Math.round(breakdown.educationMatch * breakdown.weights.education) });
  const reasons = [];
  if (breakdown.skillsMatch < 100) reasons.push(`${matchingSkills.length} of ${requiredSkills.length} extracted job requirements are evidenced by the resume.`);
  if (breakdown.experienceMatch < 100) reasons.push(requestedYears ? `The resume explicitly shows approximately ${resumeYears || 0} years against a ${requestedYears}-year requirement.` : 'The JD does not state a years threshold, so experience is scored from explicit internship or work evidence rather than assumed seniority.');
  if (breakdown.projectMatch < 100) reasons.push(projectEvidence ? 'Projects are present, but they do not evidence every extracted job requirement.' : 'No explicit project evidence was found in the parsed resume.');
  if (educationRequired && breakdown.educationMatch < 100) reasons.push(educationEvidence ? 'Education is present but the JD qualification could not be matched more specifically from parsed text.' : 'The JD requests a qualification that is not explicitly evidenced in the parsed resume.');
  return { formula: 'Overall = Skills × weight + Experience × weight + Projects × weight + Education × weight (only when the JD asks for it).', components, reasons: reasons.length ? reasons : ['Every scored component is fully evidenced by the parsed resume for this job description.'] };
}

function strengthenRoadmap(matchingSkills) {
  const analytics = matchingSkills.filter((skill) => ['SQL', 'Python', 'R', 'Data Analysis', 'Statistical Analysis'].includes(skill));
  const dashboards = matchingSkills.filter((skill) => ['Tableau', 'Power BI', 'Data Visualization', 'Business Intelligence', 'KPIs'].includes(skill));
  const dataQuality = matchingSkills.filter((skill) => ['Data Cleaning', 'ETL', 'Excel', 'MySQL', 'PostgreSQL'].includes(skill));
  const topics = [
    { title: 'Advanced role-specific analysis', goal: `Deepen a complete analysis using ${analytics.slice(0, 3).join(', ') || 'your strongest analysis tools'}.`, tasks: ['Choose a public dataset aligned to the target business domain.', 'Write a reproducible analysis that answers three stakeholder questions.', 'Document assumptions, metrics, and limitations in a concise README.'], evidence: 'A reproducible notebook or SQL analysis with a clear executive summary.', interview: 'Explain one analytical decision, its trade-off, and its business impact.', skills: analytics },
    { title: 'Dashboard and data-storytelling proof', goal: `Turn findings into a decision-ready dashboard using ${dashboards.slice(0, 2).join(' or ') || 'a BI tool'}.`, tasks: ['Define KPIs and the audience before selecting visuals.', 'Build a dashboard with filters and annotated business insights.', 'Publish screenshots or a portfolio walkthrough with the decision each visual supports.'], evidence: 'A shareable dashboard and a one-page data story.', interview: 'Walk through how your dashboard moves from KPI to recommended action.', skills: dashboards },
    { title: 'Data quality and reproducibility', goal: `Show a trustworthy workflow for ${dataQuality.slice(0, 3).join(', ') || 'data preparation'}.`, tasks: ['Create a data-quality checklist for missing values, duplicates, and outliers.', 'Implement the cleaning steps in a versioned script or notebook.', 'Add before/after data-quality metrics and a data dictionary.'], evidence: 'A versioned cleaning workflow with validation results.', interview: 'Describe how you protected the analysis from a misleading data-quality issue.', skills: dataQuality },
    { title: 'Impact story and interview practice', goal: 'Package your strongest work into concise, measurable Data Analyst stories.', tasks: ['Select two projects or internship examples with clear business context.', 'Rewrite each as situation, analysis, insight, and measurable outcome.', 'Practice a timed dashboard walkthrough and one SQL/Python explanation.'], evidence: 'Two polished portfolio case studies and interview-ready STAR notes.', interview: 'Deliver a two-minute story connecting your analysis to a business decision.', skills: [] }
  ];
  return topics.map((topic, index) => {
    const resourceKeys = index === 1 ? ['Tableau', 'Power BI'] : index === 2 ? ['Data Cleaning'] : [];
    return { week: index + 1, title: topic.title, goal: topic.goal, tasks: topic.tasks, expectedEvidence: topic.evidence, interviewPreparation: topic.interview, resources: resourceKeys.filter((skill) => matchingSkills.includes(skill)).flatMap((skill) => resources[skill] || []) };
  });
}

function roadmapFor(gaps) {
  const focus = gaps.filter((gap) => gap.priority !== 'Low').concat(gaps.filter((gap) => gap.priority === 'Low'));
  const primary = focus[0];
  const secondary = focus[1] || primary;
  const additional = focus.slice(2);
  const primaryResources = resources[primary.skill] || [];
  const secondaryResources = secondary.skill === primary.skill ? [] : resources[secondary.skill] || [];
  const additionalResources = additional.flatMap((gap) => resources[gap.skill] || []);
  const integrationSkills = [...new Set([primary.skill, secondary.skill, ...additional.map((gap) => gap.skill)])].slice(0, 3);
  const learningTask = (skill) => resources[skill]?.length ? `Complete the selected ${skill} resource and capture implementation notes.` : `Study the role-specific ${skill} requirements and record the implementation decisions you need to make.`;

  return [
    {
      week: 1, title: `${primary.skill}: targeted foundation`, goal: `Build enough ${primary.skill} fluency to create credible role-relevant evidence.`,
      tasks: [learningTask(primary.skill), `Implement a small ${primary.skill} exercise that covers the job requirement.`, 'Document setup choices, constraints, and the result in a README.', `Write one resume-ready accomplishment statement focused on ${primary.skill}.`],
      expectedEvidence: `A focused ${primary.skill} exercise, implementation notes, and a measurable portfolio bullet.`,
      interviewPreparation: `Explain the core ${primary.skill} trade-off you made and why it fits this role.`, resources: primaryResources
    },
    {
      week: 2, title: `${secondary.skill}: working implementation`, goal: `Turn ${secondary.skill} knowledge into a working component of a small project.`,
      tasks: [learningTask(secondary.skill), `Build a working ${secondary.skill} component with one realistic input and output.`, 'Add a simple validation or test case that demonstrates reliability.', `Record the before-and-after behavior in the project README.`],
      expectedEvidence: `A runnable ${secondary.skill} component with a documented validation case.`,
      interviewPreparation: `Walk through how you would debug or improve your ${secondary.skill} implementation.`, resources: secondaryResources
    },
    {
      week: 3, title: `Integrate ${integrationSkills.join(' + ')}`, goal: 'Combine the highest-impact gaps into one coherent, job-relevant portfolio workflow.',
      tasks: [`Connect ${integrationSkills.join(', ')} in a small end-to-end project.`, 'Define one measurable success criterion and capture the result.', 'Add architecture notes that explain boundaries and technical trade-offs.', 'Publish a short demo or annotated walkthrough for the project.'],
      expectedEvidence: 'A documented end-to-end project, measurable result, and concise technical walkthrough.',
      interviewPreparation: 'Practice explaining the architecture, one constraint, and the outcome in two minutes.', resources: additionalResources
    },
    {
      week: 4, title: 'Portfolio proof and interview readiness', goal: `Package your ${integrationSkills.join(', ')} work into concise, credible evidence for this role.`,
      tasks: ['Rewrite the project README around problem, approach, evidence, and outcome.', 'Add two quantified bullets to the resume or portfolio case study.', 'Prepare one technical deep-dive and one collaboration story from the work.', 'Run a timed mock interview explanation and revise unclear sections.'],
      expectedEvidence: 'A polished case study, updated resume bullets, and interview-ready notes.',
      interviewPreparation: 'Deliver a concise story connecting the project evidence to the role requirements.', resources: []
    }
  ];
}

function buildAnalysis(resumeText, jobDescription, addedSkills = [], ai = {}) {
  const resumeSource = `${resumeText}\n${addedSkills.join('\n')}`;
  const requiredSkills = jobSkills(jobDescription);
  const matchingSkills = requiredSkills.filter((skill) => hasSkill(resumeSource, skill));
  const missingSkills = requiredSkills.filter((skill) => !hasSkill(resumeSource, skill));
  const skillCoverage = requiredSkills.length ? matchingSkills.length / requiredSkills.length : 0;
  const requestedYears = yearsMentioned(jobDescription), resumeYears = yearsMentioned(resumeText);
  const experienceEvidence = /\b(experience|internship|intern|worked|employment|engineer|developer)\b/i.test(resumeText);
  const projectEvidence = /\b(projects?|built|developed|implemented|deployed|created)\b/i.test(resumeText);
  const educationRequired = hasQualificationRequirement(jobDescription);
  const educationEvidence = /\b(bachelor|master|b\.?(?:tech|s|e)|m\.?(?:tech|s|e)|university|college|degree)\b/i.test(resumeText);
  const experienceMatch = clamp(Math.round((requestedYears ? Math.min(resumeYears / requestedYears, 1) * 70 : 55) + (experienceEvidence ? 25 : 5)));
  const projectMatch = clamp(Math.round((projectEvidence ? 55 : 20) + skillCoverage * 45));
  const educationMatch = educationEvidence ? 85 : 20;
  const breakdown = scoreComponents({ skillCoverage, experienceMatch, projectMatch, educationMatch, educationRequired });
  const scoreExplanation = explainScore({ breakdown, requiredSkills, matchingSkills, requestedYears, resumeYears, experienceEvidence, projectEvidence, educationRequired, educationEvidence });
  const skillEvidence = matchingSkills.flatMap((skill) => {
    const evidence = sentenceEvidence(resumeText, skill);
    return evidence ? [{ skill, evidence }] : [];
  });
  const prioritizedGaps = missingSkills.map((skill) => ({ skill, priority: priorityFor(jobDescription, skill), reason: `${priorityFor(jobDescription, skill)} impact because the job description names ${skill}${priorityFor(jobDescription, skill) === 'High' ? ' as a required capability' : ''}.` })).sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priority] - ({ High: 0, Medium: 1, Low: 2 }[b.priority])));
  return {
    matchPercentage: breakdown.overall, matchingSkills, missingSkills, experienceMatch, projectMatch,
    scoreBreakdown: { skillsMatch: breakdown.skillsMatch, experienceMatch, projectMatch, educationMatch: breakdown.educationMatch, weights: breakdown.weights },
    scoreExplanation,
    skillEvidence, prioritizedGaps,
    recommendations: Array.isArray(ai.recommendations) && ai.recommendations.length ? ai.recommendations.map(String) : (missingSkills.length ? [`Prioritize ${prioritizedGaps[0].skill}; it has ${prioritizedGaps[0].priority.toLowerCase()} impact for this job.`, 'Quantify outcomes in the experience and project bullets that best match this job.', `Lead with ${matchingSkills.slice(0, 3).join(', ') || 'your strongest relevant work'} in your resume summary.`] : ['Tailor your resume summary to the job requirements.', 'Quantify outcomes in your strongest experience and project bullets.', 'Prepare interview stories that connect your evidence to this role.']),
    plan30Days: prioritizedGaps.length ? roadmapFor(prioritizedGaps) : strengthenRoadmap(matchingSkills)
  };
}

function parseJson(content) { return JSON.parse(content.replace(/^```json\s*|\s*```$/g, '').trim()); }

function geminiResponseText(response) {
  return response?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();
}

// All server-side Gemini calls share this transport. Feature services supply a
// strict prompt and validate the returned JSON before it reaches persistence.
export async function requestGeminiJson(prompt, emptyResponseMessage = 'Gemini API returned no content.') {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('Gemini is not configured.');

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      }),
      signal: AbortSignal.timeout(20_000)
    });
  } catch {
    throw new Error('Gemini request was unavailable or timed out.');
  }

  if (!response.ok) throw new Error(`Gemini API returned ${response.status}.`);
  let responseText;
  try {
    responseText = geminiResponseText(await response.json());
  } catch {
    const error = new Error('Gemini API returned malformed JSON.');
    error.code = 'GEMINI_INVALID_RESPONSE';
    throw error;
  }
  if (!responseText) throw new Error(emptyResponseMessage);
  try {
    return parseJson(responseText);
  } catch {
    const error = new Error('Gemini API returned malformed JSON.');
    error.code = 'GEMINI_INVALID_RESPONSE';
    throw error;
  }
}

async function getGeminiRecommendations(resumeText, jobDescription) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const prompt = `You are a precise career analyst. Compare the resume and job description below. Return JSON only, exactly in this shape: {"recommendations":["recommendation 1","recommendation 2","recommendation 3"]}. Every recommendation must be concise, actionable, and based only on evidence in the resume or a requirement in the job description. Do not invent experience, projects, or qualifications.\n\nRESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`;
  const result = await requestGeminiJson(prompt, 'Gemini API returned no recommendation content.');
  if (!Array.isArray(result?.recommendations)) throw new Error('Gemini API returned an invalid recommendation response.');
  return { recommendations: result.recommendations.filter((item) => typeof item === 'string' && item.trim()).slice(0, 3) };
}

export async function analyzeCareer({ resumeText, jobDescription, addedSkills = [] }) {
  const fallback = buildAnalysis(resumeText, jobDescription, addedSkills);
  if (!process.env.GEMINI_API_KEY?.trim()) return fallback;
  try {
    const gemini = await getGeminiRecommendations(resumeText, jobDescription);
    return buildAnalysis(resumeText, jobDescription, addedSkills, gemini || {});
  } catch (error) {
    console.warn(`Gemini recommendations unavailable; using deterministic recommendations. ${error.message}`);
    return fallback;
  }
}

export async function getGeminiInstantPlan({ missingSkills, prioritizedGaps = [], durationHours = 12, roleContext = '' }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const targetMinutes = durationHours * 60;
  const prompt = `You are a practical, senior engineering career mentor.
Generate an intensive, focused, short-term skill action plan for a student.

CRITICAL CONSTRAINTS:
1. You must ONLY create steps for the student's actual missing skills listed below.
2. DO NOT invent or substitute other technologies or skills.
3. Total duration must be exactly ${durationHours} hours (${targetMinutes} minutes).
4. Organize steps with actionable hands-on sequences: what to learn, how to practice, and expected outcome.

STUDENT'S ACTUAL MISSING SKILLS:
${missingSkills.map((s) => `- ${s}`).join('\n')}

ROLE / GOAL CONTEXT:
${roleContext || 'Technical Role'}

SCHEMA REQUIREMENTS:
Return valid JSON only in this exact shape:
{
  "steps": [
    {
      "order": 1,
      "skill": "Exact skill name from the missing skills above",
      "priority": "High",
      "durationMinutes": 180,
      "title": "Concise focused sprint title",
      "learn": ["3 to 4 specific concepts or topics to understand"],
      "practice": ["2 to 3 specific hands-on exercises to build or execute"],
      "outcome": "Concise statement of what the student will be able to do/build"
    }
  ],
  "finalSkillCheck": {
    "type": "practical_verification",
    "title": "Final Skill Check",
    "description": "Short challenge or verification exercise for the student",
    "tasks": ["2 specific validation tasks to run"],
    "questions": ["2 self-assessment or interview-style questions on what was learned"]
  }
}`;

  const result = await requestGeminiJson(prompt, 'Gemini API returned no plan content.');
  if (!Array.isArray(result?.steps) || result.steps.length === 0) {
    throw new Error('Gemini API returned an invalid plan structure.');
  }
  return result;
}

