import type { CareerAnalysis, CareerHistoryDetail, CareerHistorySummary, LearningResource, ResumeData } from '../types/career'
import type { ApplicationTrackingResult, DriveAnalytics, InAppNotification, PlacementApplication, PlacementJob, ProfileCompletion, StudentProfile, TpoApplication, TpoDashboard, TpoNotification, TpoStudent } from '../types/placement'
import { clearAuthSession, getAuthToken } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

type AnalysisPayload = Partial<CareerAnalysis>

type PlanStep = CareerAnalysis['plan30Days'][number]

const defaultBreakdown: CareerAnalysis['scoreBreakdown'] = {
  skillsMatch: 0, experienceMatch: 0, projectMatch: 0, educationMatch: null,
  weights: { skills: 0.6, experience: 0.2, projects: 0.2, education: 0 }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function normalizePlan(value: unknown): PlanStep[] {
  if (!Array.isArray(value)) return []
  return value.map((step, index) => {
    const item = step && typeof step === 'object' ? step as Record<string, unknown> : {}
    const resourceList = Array.isArray(item.resources) ? item.resources : []
    return {
      week: Number(item.week) || index + 1,
      title: String(item.title || `Week ${index + 1}`),
      goal: String(item.goal || ''),
      tasks: stringArray(item.tasks),
      expectedEvidence: String(item.expectedEvidence || ''),
      interviewPreparation: String(item.interviewPreparation || ''),
      resources: resourceList.filter((resource) => resource && typeof resource === 'object').map((resource) => resource as LearningResource)
    }
  })
}

function normalizeAnalysis(payload: AnalysisPayload): CareerAnalysis {
  const breakdown = payload.scoreBreakdown
    ? {
        skillsMatch: Number(payload.scoreBreakdown.skillsMatch ?? 0),
        experienceMatch: Number(payload.scoreBreakdown.experienceMatch ?? 0),
        projectMatch: Number(payload.scoreBreakdown.projectMatch ?? 0),
        educationMatch: payload.scoreBreakdown.educationMatch === null ? null : Number(payload.scoreBreakdown.educationMatch ?? 0),
        weights: {
          skills: Number(payload.scoreBreakdown.weights?.skills ?? 0.6),
          experience: Number(payload.scoreBreakdown.weights?.experience ?? 0.2),
          projects: Number(payload.scoreBreakdown.weights?.projects ?? 0.2),
          education: Number(payload.scoreBreakdown.weights?.education ?? 0)
        }
      }
    : defaultBreakdown

  return {
    historyId: typeof payload.historyId === 'string' ? payload.historyId : undefined,
    matchPercentage: Number(payload.matchPercentage ?? 0),
    matchingSkills: stringArray(payload.matchingSkills),
    missingSkills: stringArray(payload.missingSkills),
    experienceMatch: Number(payload.experienceMatch ?? 0),
    projectMatch: Number(payload.projectMatch ?? 0),
    scoreBreakdown: breakdown,
    scoreExplanation: payload.scoreExplanation ?? { formula: '', components: [], reasons: [] },
    skillEvidence: Array.isArray(payload.skillEvidence) ? payload.skillEvidence : [],
    prioritizedGaps: Array.isArray(payload.prioritizedGaps) ? payload.prioritizedGaps : [],
    recommendations: stringArray(payload.recommendations),
    plan30Days: normalizePlan(payload.plan30Days)
  }
}

function normalizeHistorySummary(value: unknown): CareerHistorySummary {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    id: String(item.id || ''),
    resumeName: String(item.resumeName || 'Uploaded resume'),
    jobPreview: String(item.jobPreview || ''),
    matchPercentage: Number(item.matchPercentage || 0),
    missingSkills: stringArray(item.missingSkills),
    createdAt: String(item.createdAt || '')
  }
}

function normalizeHistoryDetail(value: unknown): CareerHistoryDetail {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const resume = item.resume && typeof item.resume === 'object' ? item.resume as Partial<ResumeData> : {}
  return {
    ...normalizeHistorySummary(item),
    resume: {
      originalName: String(resume.originalName || 'Uploaded resume'),
      fileType: typeof resume.fileType === 'string' ? resume.fileType : undefined,
      size: Number(resume.size || 0),
      resumeText: String(resume.resumeText || '')
    },
    jobDescription: String(item.jobDescription || ''),
    analysis: normalizeAnalysis((item.analysis || {}) as AnalysisPayload)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  const headers = new Headers(init?.headers)
  const token = getAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers })
  } catch {
    throw new Error('Unable to connect to the analysis service. Please make sure the backend is running.')
  }

  let payload: { data?: T; error?: { message?: string } } | null = null
  try {
    payload = await response.json()
  } catch {
    throw new Error('The analysis service returned an invalid response.')
  }
  if (!response.ok) {
    if (response.status === 401) clearAuthSession()
    throw new Error(payload?.error?.message || 'Something went wrong.')
  }
  if (!payload || !('data' in payload)) throw new Error('The analysis service returned an incomplete response.')
  return payload.data as T
}

export function uploadResume(file: File) {
  const body = new FormData()
  body.append('resume', file)
  return request<{ resume: ResumeData }>('/resume/upload', { method: 'POST', body })
}

export function analyzeResume(resume: ResumeData, jobDescription: string, addedSkills: string[] = []) {
  return request<AnalysisPayload>('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resumeText: resume.resumeText,
      resumeName: resume.originalName,
      resumeFileType: resume.fileType,
      resumeSize: resume.size,
      jobDescription,
      addedSkills
    })
  }).then(normalizeAnalysis)
}

export function simulateCareer(resumeText: string, description: string, addedSkills: string[]) {
  return request<{ readinessScore: number; scoreChange: number; analysis?: AnalysisPayload }>('/career/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeText, jobDescription: description, addedSkills }) }).then((result) => ({ ...result, analysis: normalizeAnalysis(result.analysis || {}) }))
}

export function getCareerHistory() {
  return request<{ items?: unknown[] }>('/career/history').then((result) => Array.isArray(result.items) ? result.items.map(normalizeHistorySummary).filter((item) => item.id) : [])
}

export function getCareerHistoryItem(historyId: string) {
  return request<unknown>(`/career/history/${encodeURIComponent(historyId)}`).then(normalizeHistoryDetail)
}

export function getStudentProfile() {
  return request<{ profile: StudentProfile; completion: ProfileCompletion }>('/profile')
}

export function updateStudentProfile(profile: Partial<StudentProfile>) {
  return request<{ profile: StudentProfile; completion: ProfileCompletion }>('/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
}

export function profilePhotoUrl(value: string | null | undefined) {
  if (typeof value !== 'string' || !value.trim()) return null
  const relativeUrl = value.startsWith('/')
  if (relativeUrl && !value.startsWith('/profile-photos/')) return null
  try {
    const resolved = new URL(value, API_URL)
    return ['http:', 'https:'].includes(resolved.protocol) ? resolved.toString() : null
  } catch { return null }
}

export function uploadProfilePhoto(file: File) {
  const body = new FormData()
  body.append('photo', file)
  return request<{ profile: StudentProfile; completion: ProfileCompletion }>('/profile/photo', { method: 'POST', body })
}

export function removeProfilePhoto() {
  return request<{ profile: StudentProfile; completion: ProfileCompletion }>('/profile/photo', { method: 'DELETE' })
}

export function getOnCampusJobs() {
  return request<{ items: PlacementJob[] }>('/jobs/on-campus').then((result) => result.items || [])
}

export function getOffCampusJobs() {
  return request<{ items: PlacementJob[]; availability: 'refreshed' | 'cached' | 'not_configured' | 'unavailable'; message: string | null; updatedAt: string | null }>('/jobs/off-campus')
}

export type CampusJobInput = {
  companyName: string; role: string; jobDescription: string; ctc: string; ctcLpa: number | null; location: string; deadline: string
  requiredSkills: string[]; eligibleBranches: string[]; minimumCgpa: number | null; maximumBacklogs: number | null; graduationYears: number[]; employmentType: string; additionalCriteria: string
}

export function getManagedCampusJobs() {
  return request<{ items: PlacementJob[] }>('/jobs/manage/on-campus').then((result) => result.items || [])
}

export function createCampusJob(input: CampusJobInput) {
  return request<PlacementJob>('/jobs/on-campus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
}

export function updateCampusJob(jobId: string, input: Partial<CampusJobInput>) {
  return request<PlacementJob>(`/jobs/on-campus/${encodeURIComponent(jobId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
}

export function setCampusJobStatus(jobId: string, action: 'publish' | 'unpublish' | 'close') {
  return request<PlacementJob>(`/jobs/on-campus/${encodeURIComponent(jobId)}/${action}`, { method: 'POST' })
}

export function archiveCampusJob(jobId: string) {
  return request<PlacementJob>(`/jobs/on-campus/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
}

export function getCampusJobApplications(jobId: string) {
  return request<{ items: PlacementApplication[] }>(`/jobs/on-campus/${encodeURIComponent(jobId)}/applications`).then((result) => result.items || [])
}

export function getEligibleCampusStudents(jobId: string) {
  return request<{ items: { studentId: string; profile: Pick<StudentProfile, 'fullName' | 'branch' | 'cgpa' | 'graduationYear'> }[] }>(`/jobs/on-campus/${encodeURIComponent(jobId)}/eligible-students`).then((result) => result.items || [])
}

export function getCampusDriveAnalytics(jobId: string) {
  return request<DriveAnalytics>(`/jobs/on-campus/${encodeURIComponent(jobId)}/analytics`)
}

export function getTpoDashboard() {
  return request<TpoDashboard>('/tpo/dashboard')
}

export function getTpoStudents() {
  return request<{ items: TpoStudent[] }>('/tpo/students').then((result) => result.items || [])
}

export function getTpoStudent(studentId: string) {
  return request<TpoStudent>(`/tpo/students/${encodeURIComponent(studentId)}`)
}

export function getTpoApplications() {
  return request<{ items: TpoApplication[] }>('/tpo/applications').then((result) => result.items || [])
}

export function getTpoNotifications() {
  return request<{ items: TpoNotification[] }>('/tpo/notifications').then((result) => result.items || [])
}

export function updateCampusApplicationStatus(applicationId: string, status: string) {
  return request<PlacementApplication>(`/jobs/manage/applications/${encodeURIComponent(applicationId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
}

export function getApplications() {
  return request<{ items: PlacementApplication[] }>('/applications').then((result) => result.items || [])
}

export function applyToPlacementJob(jobId: string) {
  return request<ApplicationTrackingResult>('/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId }) })
}

export function getNotifications() {
  return request<{ items: InAppNotification[]; unreadCount: number }>('/notifications')
}

export function markNotificationRead(notificationId: string) {
  return request<InAppNotification>(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PUT' })
}

export function markAllNotificationsRead() {
  return request<{ updated: number }>('/notifications/read-all', { method: 'PUT' })
}

export type DsaProblem = { id: string; title: string; difficulty: string; topics: string[]; url: string | null; status: 'solved' | 'unsolved' }
type DsaProblemResponse = { problems: DsaProblem[]; pagination: { page: number; limit: number; total: number } }
export type DsaDashboard = { totalQuestions: number; solved: number; completionPercentage: number; currentStreak: number; longestStreak: number; activity: { date: string; solvedCount: number }[]; difficultyCounts: Record<string, number> }
export function getDsaProblems(filters: { search?: string; difficulty?: string; topic?: string; status?: 'all' | 'solved' | 'unsolved'; page?: number; limit?: number }) { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) }); return request<DsaProblemResponse>(`/api/dsa/problems?${params.toString()}`) }
export function getDsaTopics() { return request<{ items: string[] }>('/api/dsa/topics').then((result) => result.items || []) }
export function getDsaDifficulties() { return request<{ items: string[] }>('/api/dsa/difficulties').then((result) => result.items || []) }
export function getDsaDashboard() { return request<DsaDashboard>('/api/dsa/dashboard') }
export function updateDsaProblemStatus(problemId: string, status: 'solved' | 'unsolved') { return request<{ dashboard: DsaDashboard }>(`/api/dsa/problems/${encodeURIComponent(problemId)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }) }
