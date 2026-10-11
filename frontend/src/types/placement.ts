import type { ResumeData } from './career'

export type StudentProject = { title: string; description: string; technologies: string[]; githubUrl: string; liveUrl: string; startDate: string; endDate: string }
export type StudentSocialLinks = { github: string; linkedin: string; portfolio: string; leetcode: string }

export type StudentProfile = {
  fullName: string
  email: string
  phone: string
  branch: string
  college: string
  cgpa: number | null
  backlogs: number | null
  graduationYear: number | null
  skills: string[]
  legacySkills: string[]
  projects: StudentProject[]
  preferredRoles: string[]
  preferredLocations: string[]
  socialLinks: StudentSocialLinks
  profilePhotoUrl: string | null
  resume: Pick<ResumeData, 'originalName' | 'fileType' | 'size'> & { updatedAt: string } | null
}

export type ProfileCompletion = {
  percentage: number
  fields: { key: string; label: string; mandatory: boolean; completed: boolean }[]
  missingFields: string[]
  missingMandatory: string[]
}

export type EligibilityResult = {
  eligible: boolean
  profileComplete: boolean
  branchEligible: boolean
  cgpaEligible: boolean
  backlogEligible: boolean
  graduationYearEligible: boolean
  matchedSkills: string[]
  missingSkills: string[]
  criteriaSource: 'OFFICIAL_TPO_ELIGIBILITY' | 'EXTERNAL_REQUIREMENTS'
  reasons: string[]
  checks: {
    cgpa: { passed: boolean; studentValue: number | null; requiredValue: number | null }
    backlogs: { passed: boolean; studentValue: number | null; maximumAllowed: number | null }
    branch: { passed: boolean; studentValue: string; eligibleBranches: string[] }
    graduationYear: { passed: boolean; studentValue: number | null; eligibleYears: number[] }
    skills: { passed: boolean; matched: string[]; missing: string[]; required: string[]; studentSkillCount: number }
  }
}

export type JdAnalysisStatus = 'NOT_ANALYZED' | 'READY' | 'STALE' | 'FAILED'
export type JdAnalysis = {
  requiredSkills: string[]
  preferredSkills: string[]
  tools: string[]
  technologies: string[]
  frameworks: string[]
  responsibilities: string[]
  roleKeywords: string[]
  sourceHash: string
  analyzedAt?: string | null
}

export type PlacementJob = {
  id: string
  sourceType: 'ON_CAMPUS' | 'OFF_CAMPUS'
  jobStatus: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'CLOSED' | 'ARCHIVED'
  source?: string | null
  requirementsSource?: 'PROVIDER' | 'INFERRED_FROM_DESCRIPTION' | 'NOT_PROVIDED'
  companyName: string | null
  role: string | null
  jobDescription: string | null
  ctc: string | null
  ctcLpa: number | null
  salaryMin?: number | null
  salaryMax?: number | null
  location: string | null
  deadline: string | null
  postedAt: string | null
  minimumCgpa: number | null
  maximumBacklogs: number | null
  eligibleBranches: string[]
  graduationYears: number[]
  requiredSkills: string[]
  jdAnalysisStatus: JdAnalysisStatus
  jdAnalysis: JdAnalysis | null
  additionalCriteria?: string | null
  employmentType: string | null
  applicationUrl: string | null
  status: 'active' | 'expired'
  eligibility: EligibilityResult
}

export type ApplicationStatus = string

export type PlacementApplication = {
  id: string
  jobId: string
  appliedAt: string
  status: ApplicationStatus
  notes: string
  updatedAt: string
  hiringType: 'ON_CAMPUS' | 'OFF_CAMPUS'
  externalApplicationUrl: string | null
  source: string | null
  studentId?: string
  job: PlacementJob | null
}

export type ApplicationTrackingResult = {
  application: PlacementApplication
  alreadyApplied: boolean
}

export type DriveAnalyticsStudent = {
  studentId: string
  fullName: string
  branch: string
  cgpa: number | null
  skills: string[]
  evidenceSkills: string[]
  analysisSource: 'profile' | 'resume'
  evidenceLabel: 'Profile Skills' | 'Resume Analysis'
  analysisStatus: string
  sourceAvailable: boolean
  resumeAnalyzedAt: string | null
  matchedSkills: string[]
  missingSkills: string[]
  skillMatch: { matchedSkills: number; requiredSkills: number; percentage: number }
  jdMatch: {
    requiredMatched: string[]
    requiredMissing: string[]
    requiredTotal: number
    requiredPercentage: number | null
    preferredMatched: string[]
    preferredMissing: string[]
    preferredTotal: number
    preferredPercentage: number | null
    matchPercentage: number
  }
  applicationStatus: string | null
}

export type DriveSkillGap = { skill: string; studentsMissing: number; percentage: number }

export type StudentAnalysisSource = 'profile' | 'resume'

export type DriveAnalytics = {
  analysisSource: StudentAnalysisSource
  sourceAvailability: {
    totalStudents: number
    studentsWithResume: number
    studentsWithoutResume: number
    studentsPendingParsing: number
    studentsWithParsedResume: number
    studentsWithResumeAnalysis: number
    uploaded: number
    available: number
    unavailable: number
    noUpload: number
    legacyMetadata: number
    parsingPending: number
    parsingFailed: number
    analysisPending: number
    analysisFailed: number
  }
  drive: { id: string; companyName: string | null; role: string | null; requiredSkills: string[]; jdAnalysisStatus: JdAnalysisStatus; jdAnalysis: JdAnalysis | null }
  jdAnalysis: ({ available: true; status: 'READY' } & JdAnalysis) | { available: false; status: Exclude<JdAnalysisStatus, 'READY'>; message: string }
  summary: { totalStudents: number; analyzedStudents: number; resumeUnavailable: number; eligible: number; partialMatch: number; notEligible: number; driveEligibilityReadiness: number }
  officialEligibility: { eligible: number; notEligible: number; readinessPercentage: number }
  jdRoleFit: {
    formula: { requiredWeight: number; preferredWeight: number; description: string }
    distribution: { key: string; label: string; minimum: number; students: number; percentage: number }[]
    requiredCoverage: { matched: number; possible: number; percentage: number }
    preferredCoverage: { matched: number; possible: number; percentage: number }
  }
  skillGaps: DriveSkillGap[]
  preferredSkillGaps: DriveSkillGap[]
  branchAnalysis: {
    branch: string
    totalStudents: number
    analyzedStudents: number
    resumeUnavailableStudents: number
    eligibleStudents: number
    partialMatchStudents: number
    notEligibleStudents: number
    trainingCandidates: number
    readinessPercentage: number
    averageJdMatchPercentage: number
  }[]
  branchSkillGaps: { branch: string; totalStudents: number; analyzedStudents: number; resumeUnavailableStudents: number; skillGaps: { skill: string; studentsMissing: number }[] }[]
  trainingPriorities: (DriveSkillGap & { rank: number })[]
  eligibleStudents: DriveAnalyticsStudent[]
  trainingCandidates: DriveAnalyticsStudent[]
  notEligibleStudents: DriveAnalyticsStudent[]
  resumeUnavailableStudents: DriveAnalyticsStudent[]
  students: DriveAnalyticsStudent[]
}

export type InAppNotification = {
  id: string
  type: 'profile' | 'deadline'
  title: string
  message: string
  relatedJobId: string | null
  read: boolean
  createdAt: string
}

export type TpoStudent = {
  studentId: string
  fullName: string
  profilePhotoUrl: string | null
  branch: string
  cgpa: number | null
  backlogs: number | null
  graduationYear: number | null
  skills: string[]
  projects: StudentProject[]
  resume: { originalName: string; fileType: string; updatedAt: string } | null
  socialLinks: StudentSocialLinks
  profileComplete: boolean
  placementStatus: 'Placed' | 'Seeking placement'
  applicationCount: number
  applications: TpoApplication[]
}

export type TpoApplication = {
  id: string
  studentId: string
  jobId: string
  status: ApplicationStatus
  appliedAt: string
  updatedAt: string
  job: PlacementJob | null
  student: Pick<TpoStudent, 'studentId' | 'fullName' | 'branch' | 'cgpa' | 'graduationYear' | 'placementStatus'> | null
}

export type TpoDashboard = {
  summary: { totalStudents: number; completeProfiles: number; activeDrives: number; totalApplications: number; shortlistedStudents: number; studentsPlaced: number; studentsSeekingPlacement: number }
  upcomingDrives: PlacementJob[]
  recentApplications: TpoApplication[]
  recentPlacementActivity: TpoApplication[]
  branchPlacement: { branch: string; totalStudents: number; placedStudents: number; placementPercentage: number }[]
  applicationStatusDistribution: { status: string; applications: number }[]
  placementDataModelNote: string
}

export type TpoNotification = { id: string; type: string; title: string; message: string; createdAt: string | null; relatedJobId: string | null }

export type LegacyResumeItem = {
  legacyResumeId: string
  originalName: string | null
  fileType: string
  mimeType: string
  size: number
  modifiedAt: string
  status: 'UNLINKED' | 'ASSIGNED'
}
