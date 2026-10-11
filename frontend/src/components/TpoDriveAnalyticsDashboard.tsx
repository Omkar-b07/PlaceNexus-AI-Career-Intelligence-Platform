// @ts-nocheck -- JSX chart-library callback types are intentionally permissive here.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, BarChart3, CheckCircle2, ClipboardList, GraduationCap, LoaderCircle, UsersRound, XCircle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import profileCatalog from '../../../shared/profileCatalog.json'
import { getCampusDriveAnalytics } from '../services/api'
import type { DriveAnalytics, DriveAnalyticsStudent, StudentAnalysisSource } from '../types/placement'
import '../placement.css'

type StudentList = 'eligible' | 'training' | 'unavailable'
type ChartRow = { label: string; value: number; percentage?: number }
type BranchGapRow = { branch: string; branchLabel: string } & Record<string, string | number>

const chartPalette = ['#5f7d32', '#94ad5c', '#d6a44d', '#b96d53', '#577d86', '#9d7c9b']
const fitColors = { Eligible: '#5f7d32', 'Partial match': '#d6a44d', 'Not eligible': '#b96d53', 'Fixed criteria met': '#5f7d32', 'Fixed criteria need attention': '#b96d53' }
const branchLabels = new Map(profileCatalog.branchOptions.map(({ value, label }) => [value, label]))
const analysisSourceCopy: Record<StudentAnalysisSource, { title: string; shortLabel: string; description: string; selectorDescription: string }> = {
  profile: { title: 'Profile Skill Analysis', shortLabel: 'Profile Skills', description: 'Role fit based on skills listed in student profiles.', selectorDescription: 'Analyze the skills manually added to each student profile.' },
  resume: { title: 'Resume-Based Role Analysis', shortLabel: 'Resume Analysis', description: 'Role fit based on skills and technical evidence extracted from student resumes.', selectorDescription: 'Extract and use only technical evidence from each uploaded resume.' }
}

function displayPercent(value: number) { return `${Math.round(value)}%` }
function readableStatus(status: string) { return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function resumeAvailabilityMessage(availability: DriveAnalytics['sourceAvailability']) {
  if (!availability.uploaded) return 'No students in this analytics population have uploaded a resume.'
  if (availability.analysisPending || availability.parsingPending) return 'Uploaded resumes are being prepared for JD role-fit analysis.'
  if (availability.analysisFailed) return 'Uploaded, parsed resumes are awaiting a safe analysis retry. They are not counted as a 0% role fit.'
  if (availability.parsingFailed) return 'An uploaded resume could not be parsed. The student can upload it again to retry safely.'
  if (availability.legacyMetadata) return 'Resume upload records were found, but their parsed text and file reference are unavailable. Those students need to re-upload their resumes.'
  return 'Uploaded resumes are not yet available for JD role-fit analysis.'
}
function formatBranchDisplayName(branch: string) {
  const value = String(branch || '').trim()
  return branchLabels.get(value) || value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Not provided'
}

function wrapChartLabel(value: string, maxLength = 24) {
  const lines: string[] = []
  let line = ''
  const words = value.split(/\s+/).filter(Boolean).flatMap((word) => {
    if (word.length <= maxLength) return [word]
    return word.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [word]
  })
  for (const word of words) {
    if (line && `${line} ${word}`.length > maxLength) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}

function getColumnLabelLayout(labels: string[]) {
  const maxLength = labels.length > 7 ? 11 : labels.length > 5 ? 14 : labels.length > 3 ? 17 : 22
  const lineCount = Math.max(1, ...labels.map((label) => wrapChartLabel(label, maxLength).length))
  return { maxLength, axisHeight: Math.max(78, Math.min(132, lineCount * 14 + 30)) }
}

function WrappedColumnTick({ x = 0, y = 0, payload, maxLength }: { x?: number; y?: number; payload?: { value?: unknown }; maxLength: number }) {
  const lines = wrapChartLabel(String(payload?.value || ''), maxLength)
  return <g transform={`translate(${x},${y})`}><text x={0} y={0} textAnchor="middle" fill="#53655a" fontSize={11}>{lines.map((line, index) => <tspan key={`${line}-${index}`} x={0} dy={index ? 14 : 16}>{line}</tspan>)}</text></g>
}

function chartBox(viewBox: unknown) {
  return viewBox && typeof viewBox === 'object' ? viewBox as { x?: number; y?: number; width?: number; height?: number } : {}
}

function InsideSegmentLabel({ value, viewBox, fill }: { value?: unknown; viewBox?: unknown; fill: string }) {
  const box = chartBox(viewBox)
  const count = Number(value)
  const x = Number(box.x)
  const y = Number(box.y)
  const width = Number(box.width)
  const height = Number(box.height)
  if (!Number.isFinite(count) || count === 0 || !Number.isFinite(x) || !Number.isFinite(y) || width < 26 || height < 14) return null
  return <text x={x + width / 2} y={y + height / 2 + 4} fill={fill} fontSize={10} fontWeight={800} textAnchor="middle">{count}</text>
}

function EndBarLabel({ value, viewBox }: { value?: unknown; viewBox?: unknown }) {
  const box = chartBox(viewBox)
  const count = Number(value)
  const x = Number(box.x)
  const y = Number(box.y)
  const width = Number(box.width)
  const height = Number(box.height)
  if (!Number.isFinite(count) || count === 0 || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || height < 10) return null
  return <text x={x + width + 7} y={y + height / 2 + 4} fill="#44564b" fontSize={11} fontWeight={800}>{count}</text>
}

function ColumnCountLabel({ value, viewBox }: { value?: unknown; viewBox?: unknown }) {
  const box = chartBox(viewBox)
  const count = Number(value)
  const x = Number(box.x)
  const y = Number(box.y)
  const width = Number(box.width)
  if (!Number.isFinite(count) || count === 0 || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || width < 14) return null
  return <text x={x + width / 2} y={Math.max(13, y - 7)} fill="#44564b" fontSize={11} fontWeight={800} textAnchor="middle">{count}</text>
}

function AnalyticsSeriesLegend({ items }: { items: { label: string; color: string }[] }) {
  return <ul className="analytics-series-legend" aria-label="Chart legend">{items.map((item) => <li key={item.label}><i style={{ backgroundColor: item.color }} /><span>{item.label}</span></li>)}</ul>
}

function ChartEmpty({ children }: { children: string }) {
  return <div className="analytics-chart-empty"><BarChart3 size={20} /><p>{children}</p></div>
}

function isUnavailableStudentList(value: string) { return value === 'unavailable' }

function ChartCard({ eyebrow, title, children, className = '' }: { eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return <section className={`placement-card analytics-chart ${className}`}><div className="analytics-card-heading"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div></div>{children}</section>
}

function DonutTooltip({ active, payload, unit }: { active?: boolean; payload?: readonly { payload?: unknown }[]; unit: string }) {
  const item = payload?.[0]?.payload as ChartRow | undefined
  if (!active || !item) return null
  return <div className="analytics-tooltip"><strong>{item.label}</strong><span>{item.value} {unit}</span><small>{displayPercent(item.percentage || 0)}</small></div>
}

function DistributionChart({ data, total }: { data: ChartRow[]; total: number }) {
  if (!total) return <ChartEmpty>No analytics data available yet.</ChartEmpty>
  return <div className="analytics-donut-layout"><div className="analytics-donut" role="img" aria-label="Student eligibility distribution"><ResponsiveContainer width="100%" height={246}><PieChart><Tooltip content={(props) => <DonutTooltip {...props} unit="students" />} /><Pie data={data} dataKey="value" nameKey="label" innerRadius={64} outerRadius={91} paddingAngle={2} stroke="none">{data.map((item) => <Cell key={item.label} fill={fitColors[item.label as keyof typeof fitColors]} />)}</Pie></PieChart></ResponsiveContainer><div className="analytics-donut-total"><strong>{total}</strong><span>students</span></div></div><ul className="analytics-chart-legend" aria-label="Eligibility distribution details">{data.map((item) => <li key={item.label}><i style={{ backgroundColor: fitColors[item.label as keyof typeof fitColors] }} /><span>{item.label}</span><b>{item.value}</b><small>{displayPercent(item.percentage || 0)}</small></li>)}</ul></div>
}

function RoleFitTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const item = payload?.[0]?.payload as ChartRow | undefined
  if (!active || !item) return null
  return <div className="analytics-tooltip"><strong>{item.label}</strong><span>Students <b>{item.value}</b></span><small>{displayPercent(item.percentage || 0)}</small></div>
}

function RoleFitDistributionChart({ data, total, source, availability }: { data: ChartRow[]; total: number; source: StudentAnalysisSource; availability: DriveAnalytics['sourceAvailability'] }) {
  if (!total) return <ChartEmpty>{source === 'resume' ? resumeAvailabilityMessage(availability) : 'No active student profiles are available for JD role-fit analysis.'}</ChartEmpty>
  const note = source === 'resume' ? 'Resume-extracted technical evidence against the confirmed JD requirements.' : 'Student profile skills against the confirmed JD requirements.'
  return <div className="analytics-role-fit-chart" role="img" aria-label="JD role-fit distribution by student count"><p className="analytics-chart-note">{note}</p><ResponsiveContainer width="100%" height={252}><BarChart data={data} margin={{ top: 22, right: 12, left: 0, bottom: 4 }} barCategoryGap="34%"><CartesianGrid vertical={false} stroke="#e8ede4" /><XAxis type="category" dataKey="label" interval={0} tickLine={false} axisLine={false} tick={{ fill: '#53655a', fontSize: 11 }} /><YAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#63746a', fontSize: 10 }} /><Tooltip cursor={{ fill: 'rgba(87, 125, 134, .07)' }} content={(props) => <RoleFitTooltip {...props} />} /><Bar dataKey="value" name="Students" fill="#577d86" radius={[5, 5, 0, 0]} maxBarSize={54}><LabelList dataKey="value" content={(props) => <ColumnCountLabel {...props} />} /></Bar></BarChart></ResponsiveContainer></div>
}

function JdRequirementSummary({ analytics }: { analytics: DriveAnalytics }) {
  if (!analytics.jdAnalysis.available) return null
  const { requiredCoverage, preferredCoverage, formula } = analytics.jdRoleFit
  return <div className="jd-requirement-summary"><p className="analytics-chart-note">{formula.description}</p><div className="jd-coverage-grid"><div><span>Required coverage</span><strong>{displayPercent(requiredCoverage.percentage)}</strong><small>{requiredCoverage.matched}/{requiredCoverage.possible} skill matches</small></div><div><span>Preferred coverage</span><strong>{displayPercent(preferredCoverage.percentage)}</strong><small>{preferredCoverage.matched}/{preferredCoverage.possible} skill matches</small></div></div><div className="jd-requirement-group"><strong>Required skills</strong><div className="analytics-skills">{analytics.jdAnalysis.requiredSkills.length ? analytics.jdAnalysis.requiredSkills.map((skill) => <span key={skill}>{skill}</span>) : <small>No required technical skills were confirmed.</small>}</div></div><div className="jd-requirement-group"><strong>Preferred skills</strong><div className="analytics-skills">{analytics.jdAnalysis.preferredSkills.length ? analytics.jdAnalysis.preferredSkills.map((skill) => <span key={skill}>{skill}</span>) : <small>No preferred technical skills were confirmed.</small>}</div></div></div>
}

function SkillTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const item = payload?.[0]?.payload as ChartRow | undefined
  if (!active || !item) return null
  return <div className="analytics-tooltip"><strong>{item.label}</strong><span>{item.value} students missing</span>{item.percentage !== undefined && <small>{displayPercent(item.percentage)}</small>}</div>
}

function HorizontalSkillChart({ data, emptyMessage, ariaLabel }: { data: ChartRow[]; emptyMessage: string; ariaLabel: string }) {
  if (!data.length) return <ChartEmpty>{emptyMessage}</ChartEmpty>
  const height = Math.max(228, data.length * 42 + 22)
  return <div className="analytics-chart-frame analytics-skill-chart" role="img" aria-label={ariaLabel}><ResponsiveContainer width="100%" height={height}><BarChart data={data} layout="vertical" margin={{ top: 5, right: 42, left: 0, bottom: 4 }} barCategoryGap="30%"><CartesianGrid horizontal={false} stroke="#e8ede4" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="label" width={148} tickLine={false} axisLine={false} tick={{ fill: '#53655a', fontSize: 11 }} /><Tooltip cursor={{ fill: 'rgba(111, 143, 55, .07)' }} content={(props) => <SkillTooltip {...props} />} /><Bar dataKey="value" name="Students missing" fill="#6f8f37" radius={[0, 6, 6, 0]} maxBarSize={25}><LabelList dataKey="value" content={(props) => <EndBarLabel {...props} />} /></Bar></BarChart></ResponsiveContainer></div>
}

function BranchReadinessTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const branch = payload?.[0]?.payload as (DriveAnalytics['branchAnalysis'][number] & { branchLabel: string }) | undefined
  if (!active || !branch) return null
  return <div className="analytics-tooltip analytics-branch-tooltip"><strong>{branch.branchLabel}</strong><span>Fully eligible <b>{branch.eligibleStudents}</b></span><span>Partial match / trainable <b>{branch.partialMatchStudents}</b></span><span>Not eligible <b>{branch.notEligibleStudents}</b></span><small>Average JD role fit: {displayPercent(branch.averageJdMatchPercentage)} · Total: {branch.totalStudents}</small></div>
}

function BranchReadinessChart({ analytics }: { analytics: DriveAnalytics }) {
  if (!analytics.branchAnalysis.length) return <ChartEmpty>No active student profiles are available for branch analysis.</ChartEmpty>
  if (analytics.analysisSource === 'resume' && !analytics.sourceAvailability.available) return <ChartEmpty>{resumeAvailabilityMessage(analytics.sourceAvailability)}</ChartEmpty>
  const data = analytics.branchAnalysis.map((branch) => ({ ...branch, branchLabel: formatBranchDisplayName(branch.branch) }))
  const labelLayout = getColumnLabelLayout(data.map((branch) => branch.branchLabel))
  const height = Math.max(402, 316 + labelLayout.axisHeight)
  return <div className="analytics-branch-chart"><AnalyticsSeriesLegend items={[{ label: 'Fully eligible', color: '#5f7d32' }, { label: 'Partial match / trainable', color: '#d6a44d' }, { label: 'Not eligible', color: '#b96d53' }]} /><div className="analytics-chart-frame analytics-column-chart" role="img" aria-label="Stacked column chart of student eligibility by branch"><ResponsiveContainer width="100%" height={height}><BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="38%" barGap={0}><CartesianGrid vertical={false} stroke="#e8ede4" /><XAxis type="category" dataKey="branchLabel" interval={0} height={labelLayout.axisHeight} tickLine={false} axisLine={false} tick={<WrappedColumnTick maxLength={labelLayout.maxLength} />} /><YAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: 'rgba(95, 125, 50, .07)' }} content={(props) => <BranchReadinessTooltip {...props} />} /><Bar dataKey="eligibleStudents" name="Fully eligible" stackId="readiness" fill="#5f7d32" radius={[0, 0, 5, 5]}><LabelList dataKey="eligibleStudents" content={(props) => <InsideSegmentLabel {...props} fill="#fff" />} /></Bar><Bar dataKey="partialMatchStudents" name="Partial match / trainable" stackId="readiness" fill="#d6a44d"><LabelList dataKey="partialMatchStudents" content={(props) => <InsideSegmentLabel {...props} fill="#4c3a10" />} /></Bar><Bar dataKey="notEligibleStudents" name="Not eligible" stackId="readiness" fill="#b96d53" radius={[5, 5, 0, 0]}><LabelList dataKey="notEligibleStudents" content={(props) => <InsideSegmentLabel {...props} fill="#fff" />} /></Bar></BarChart></ResponsiveContainer></div></div>
}

function BranchGapTooltip({ active, payload, skills }: { active?: boolean; payload?: readonly { payload?: unknown }[]; skills: string[] }) {
  const branch = payload?.[0]?.payload as BranchGapRow | undefined
  if (!active || !branch) return null
  return <div className="analytics-tooltip analytics-branch-tooltip"><strong>{branch.branchLabel}</strong>{skills.map((skill) => <span key={skill}>{skill} <b>{Number(branch[skill] || 0)}</b></span>)}</div>
}

function BranchGapChart({ data, skills }: { data: BranchGapRow[]; skills: string[] }) {
  if (!data.length || !skills.length) return <ChartEmpty>No branch-level skill gaps are available for this selection.</ChartEmpty>
  const labelLayout = getColumnLabelLayout(data.map((branch) => branch.branchLabel))
  const height = Math.max(390, 300 + labelLayout.axisHeight)
  return <div className="analytics-branch-chart"><AnalyticsSeriesLegend items={skills.map((skill, index) => ({ label: skill, color: chartPalette[index % chartPalette.length] }))} /><div className="analytics-chart-frame analytics-column-chart" role="img" aria-label="Grouped column chart of missing skills by branch"><ResponsiveContainer width="100%" height={height}><BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={3} barCategoryGap="34%"><CartesianGrid vertical={false} stroke="#e8ede4" /><XAxis type="category" dataKey="branchLabel" interval={0} height={labelLayout.axisHeight} tickLine={false} axisLine={false} tick={<WrappedColumnTick maxLength={labelLayout.maxLength} />} /><YAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: 'rgba(87, 125, 134, .07)' }} content={(props) => <BranchGapTooltip {...props} skills={skills} />} />{skills.map((skill, index) => <Bar key={skill} dataKey={skill} name={skill} fill={chartPalette[index % chartPalette.length]} radius={[4, 4, 0, 0]} />)}</BarChart></ResponsiveContainer></div></div>
}

function resumeStudentState(status: string) {
  switch (status) {
    case 'NO_UPLOAD': return { label: 'No resume uploaded', message: 'No resume has been uploaded for this student, so resume-based JD matching cannot run.' }
    case 'PARSING_PENDING': return { label: 'Resume uploaded — parsing pending', message: 'The uploaded resume is awaiting text extraction. It is not assigned a 0% role-fit score.' }
    case 'PARSING_FAILED': return { label: 'Resume uploaded — parsing failed', message: 'The uploaded resume could not be parsed. The student can replace the file to retry safely.' }
    case 'ANALYSIS_PENDING':
    case 'STALE': return { label: 'Resume uploaded — analysis pending', message: 'Resume text is available and its JD evidence is being prepared. It is not assigned a 0% role-fit score.' }
    case 'ANALYSIS_FAILED': return { label: 'Resume uploaded — analysis retry needed', message: 'Resume text is available, but structured evidence could not be generated yet. A safe retry is scheduled.' }
    case 'LEGACY_METADATA': return { label: 'Legacy resume record needs reattachment', message: 'An older upload record has no saved file reference or parsed text, so it cannot be safely matched to an arbitrary stored file.' }
    default: return { label: 'Resume analysis unavailable', message: 'Resume-based JD matching is not available for this student yet.' }
  }
}

function StudentCards({ students, type }: { students: DriveAnalyticsStudent[]; type: StudentList | string }) {
  if (type === 'unavailable' && students.length) return <div className="analytics-student-grid" role="list">{students.map((student) => {
    const state = resumeStudentState(student.analysisStatus)
    return <article className="analytics-student-card" key={student.studentId} role="listitem"><div className="analytics-student-identity"><strong>{student.fullName || student.studentId}</strong><span>{formatBranchDisplayName(student.branch)} · CGPA {student.cgpa ?? 'Not provided'}</span></div><span className="analytics-application-status">{state.label}</span><div className="analytics-jd-student-skills"><small>Resume Analysis</small><p className="muted">{state.message}</p></div></article>
  })}</div>
  if (!students.length) return <p className="muted">No students match the selected filters.</p>
  type = String(type)
  if (!isUnavailableStudentList(type)) return <div className="analytics-student-grid" role="list">{students.map((student) => <article className="analytics-student-card" key={student.studentId} role="listitem"><div className="analytics-student-identity"><strong>{student.fullName || student.studentId}</strong><span>{formatBranchDisplayName(student.branch)} · CGPA {student.cgpa ?? 'Not provided'}</span></div><span className="analytics-application-status">{student.evidenceLabel}</span><div className="analytics-skill-match"><span>JD role fit</span><b>{displayPercent(student.jdMatch.matchPercentage)}</b></div><div className="analytics-jd-student-skills"><small>{student.analysisSource === 'resume' ? 'Resume extracted skills' : 'Student profile skills'}{student.resumeAnalyzedAt ? ` · analyzed ${new Date(student.resumeAnalyzedAt).toLocaleDateString('en-IN')}` : ''}</small><div className="analytics-skills">{student.evidenceSkills.length ? student.evidenceSkills.map((skill) => <span key={skill}>{skill}</span>) : <small>No skills recorded for this source.</small>}</div><small>JD requirements — required: {student.jdMatch.requiredMatched.length}/{student.jdMatch.requiredTotal}</small><div className="analytics-skills">{student.jdMatch.requiredMatched.map((skill) => <span key={skill}>✓ {skill}</span>)}{student.jdMatch.requiredMissing.map((skill) => <span className="missing" key={skill}>× {skill}</span>)}</div><small>Preferred: {student.jdMatch.preferredMatched.length}/{student.jdMatch.preferredTotal}</small><div className="analytics-skills">{student.jdMatch.preferredMatched.map((skill) => <span key={skill}>✓ {skill}</span>)}{student.jdMatch.preferredMissing.map((skill) => <span className="missing" key={skill}>× {skill}</span>)}</div></div>{type === 'training' && <div className="analytics-skills gaps">{student.missingSkills.length ? student.missingSkills.map((skill) => <span key={skill}>{skill}</span>) : <small>No required JD skill gaps returned</small>}</div>}</article>)}</div>
  return <div className="analytics-student-grid" role="list">{students.map((student) => <article className="analytics-student-card" key={student.studentId} role="listitem"><div className="analytics-student-identity"><strong>{student.fullName || student.studentId}</strong><span>{formatBranchDisplayName(student.branch)} · CGPA {student.cgpa ?? 'Not provided'}</span></div><span className="analytics-application-status">{student.applicationStatus ? readableStatus(student.applicationStatus) : 'No application recorded'}</span><div className="analytics-skill-match"><span>JD role fit</span><b>{displayPercent(student.jdMatch.matchPercentage)}</b></div><div className="analytics-jd-student-skills"><small>Required: {student.jdMatch.requiredMatched.length}/{student.jdMatch.requiredTotal}</small><div className="analytics-skills">{student.jdMatch.requiredMatched.map((skill) => <span key={skill}>✓ {skill}</span>)}{student.jdMatch.requiredMissing.map((skill) => <span className="missing" key={skill}>× {skill}</span>)}</div><small>Preferred: {student.jdMatch.preferredMatched.length}/{student.jdMatch.preferredTotal}</small><div className="analytics-skills">{student.jdMatch.preferredMatched.map((skill) => <span key={skill}>✓ {skill}</span>)}{student.jdMatch.preferredMissing.map((skill) => <span className="missing" key={skill}>× {skill}</span>)}</div></div>{type === 'training' && <div className="analytics-skills gaps">{student.missingSkills.length ? student.missingSkills.map((skill) => <span key={skill}>{skill}</span>) : <small>No required JD skill gaps returned</small>}</div>}</article>)}</div>
}

export default function TpoDriveAnalyticsDashboard({ driveId, onBack, onEditDrive }: { driveId: string; onBack: () => void; onEditDrive?: () => void }) {
  const [analytics, setAnalytics] = useState<DriveAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedSkill, setSelectedSkill] = useState('')
  const [selectedGapBranch, setSelectedGapBranch] = useState('')
  const [selectedGapSkill, setSelectedGapSkill] = useState('')
  const [studentList, setStudentList] = useState<StudentList>('eligible')
  const [analysisSource, setAnalysisSource] = useState<StudentAnalysisSource>('profile')

  useEffect(() => {
    let current = true
    setLoading(true); setError(''); setAnalytics(null); setSelectedBranch(''); setSelectedSkill(''); setSelectedGapBranch(''); setSelectedGapSkill(''); setStudentList('eligible')
    void getCampusDriveAnalytics(driveId, analysisSource).then((result) => { if (current) setAnalytics(result) }).catch((err) => { if (current) setError(err instanceof Error ? err.message : 'Unable to load drive analytics.') }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [driveId, analysisSource])

  const branches = useMemo(() => analytics?.branchAnalysis.map((item) => item.branch) || [], [analytics])
  const gapBranches = useMemo(() => analytics?.branchSkillGaps.map((item) => item.branch) || [], [analytics])
  const gapSkills = useMemo(() => [...new Set([...(analytics?.skillGaps.map((gap) => gap.skill) || []), ...(analytics?.branchSkillGaps.flatMap((branch) => branch.skillGaps.map((gap) => gap.skill)) || [])])], [analytics])
  const visibleEligible = useMemo(() => (analytics?.eligibleStudents || []).filter((student) => !selectedBranch || (student.branch || 'Not provided') === selectedBranch), [analytics, selectedBranch])
  const visibleTraining = useMemo(() => (analytics?.trainingCandidates || []).filter((student) => (!selectedBranch || (student.branch || 'Not provided') === selectedBranch) && (!selectedSkill || student.missingSkills.includes(selectedSkill))), [analytics, selectedBranch, selectedSkill])
  const visibleUnavailable = useMemo(() => (analytics?.resumeUnavailableStudents || []).filter((student) => !selectedBranch || (student.branch || 'Not provided') === selectedBranch), [analytics, selectedBranch])
  const visibleGapSkills = useMemo(() => selectedGapSkill ? [selectedGapSkill] : gapSkills, [gapSkills, selectedGapSkill])
  const branchGapData = useMemo<BranchGapRow[]>(() => (analytics?.branchSkillGaps || []).filter((branch) => !selectedGapBranch || branch.branch === selectedGapBranch).map((branch) => {
    const row: BranchGapRow = { branch: branch.branch, branchLabel: formatBranchDisplayName(branch.branch) }
    for (const skill of visibleGapSkills) row[skill] = branch.skillGaps.find((gap) => gap.skill === skill)?.studentsMissing || 0
    return row
  }), [analytics, selectedGapBranch, visibleGapSkills])
  const allStudents = useMemo(() => analytics ? [...analytics.eligibleStudents, ...analytics.trainingCandidates, ...analytics.notEligibleStudents] : [], [analytics])
  const applicationStatusData = useMemo<ChartRow[]>(() => {
    const counts = new Map<string, number>()
    for (const student of allStudents) if (student.applicationStatus) counts.set(student.applicationStatus, (counts.get(student.applicationStatus) || 0) + 1)
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
    return [...counts.entries()].map(([label, value]) => ({ label: readableStatus(label), value, percentage: total ? (value / total) * 100 : 0 })).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
  }, [allStudents])

  if (loading) return <section className="placement-card placement-loading"><LoaderCircle className="spin" size={24} /><p>Calculating live drive analytics...</p></section>
  if (error || !analytics) return <section className="placement-card analytics-error"><button className="text-button" onClick={onBack}><ArrowLeft size={15} />Back to drives</button><p>{error || 'Drive analytics are unavailable.'}</p></section>
  if (!analytics.jdAnalysis.available) return <section className="placement-workspace analytics-workspace"><section className="placement-header analytics-header"><div><button className="text-button analytics-back" onClick={onBack}><ArrowLeft size={15} />Placement drives</button><p className="eyebrow">DRIVE ANALYTICS</p><h2>{analytics.drive.companyName || 'Campus drive'} · {analytics.drive.role || 'Role not provided'}</h2></div></section><section className="placement-card jd-analytics-unavailable"><BarChart3 size={24} /><div><p className="eyebrow">JD ROLE FIT UNAVAILABLE</p><h3>{analytics.jdAnalysis.message}</h3><p>Open this drive, select <b>Analyze job description</b>, review the extracted requirements, and save them before viewing JD-based skill gaps or training priorities.</p></div><button className="secondary-button" onClick={onEditDrive || onBack}>{onEditDrive ? 'Analyze job description' : 'Back to drives'}</button></section></section>

  const { summary } = analytics
  const source = analysisSourceCopy[analytics.analysisSource]
  const distribution = [{ label: 'Fixed criteria met', value: analytics.officialEligibility.eligible, percentage: analytics.officialEligibility.readinessPercentage }, { label: 'Fixed criteria need attention', value: analytics.officialEligibility.notEligible, percentage: summary.totalStudents ? (analytics.officialEligibility.notEligible / summary.totalStudents) * 100 : 0 }]
  const roleFitDistribution = analytics.jdRoleFit.distribution.map((bucket) => ({ label: bucket.label, value: bucket.students, percentage: bucket.percentage }))
  const totalApplications = applicationStatusData.reduce((sum, item) => sum + item.value, 0)
  const visibleStudents = studentList === 'eligible' ? visibleEligible : studentList === 'training' ? visibleTraining : visibleUnavailable

  return <section className="placement-workspace analytics-workspace">
    <section className="placement-card analytics-source-selector" aria-labelledby="student-analysis-source-title">
      <p className="eyebrow">STUDENT ANALYSIS SOURCE</p>
      <h3 id="student-analysis-source-title">{source.title}</h3>
      <p className="muted">{source.description}</p>
      <div className="analytics-source-options" role="tablist" aria-label="Student analysis source">
        <button type="button" role="tab" aria-selected={analysisSource === 'profile'} className={analysisSource === 'profile' ? 'active' : ''} onClick={() => setAnalysisSource('profile')}><strong>Profile Skills</strong><span>{analysisSourceCopy.profile.selectorDescription}</span></button>
        <button type="button" role="tab" aria-selected={analysisSource === 'resume'} className={analysisSource === 'resume' ? 'active' : ''} onClick={() => setAnalysisSource('resume')}><strong>Resume Analysis</strong><span>{analysisSourceCopy.resume.selectorDescription}</span></button>
      </div>
      {analysisSource === 'resume' && <p className="analytics-source-availability">
        <b>Resumes uploaded: {analytics.sourceAvailability.studentsWithResume}</b>
        <span>Parsed: {analytics.sourceAvailability.studentsWithParsedResume}</span>
        <span>Analysis ready: {analytics.sourceAvailability.studentsWithResumeAnalysis}</span>
        <span>Analysis pending: {analytics.sourceAvailability.analysisPending + analytics.sourceAvailability.studentsPendingParsing}</span>
        <span>No resume: {analytics.sourceAvailability.studentsWithoutResume}</span>
        {analytics.sourceAvailability.parsingFailed > 0 && <span>Parsing failed: {analytics.sourceAvailability.parsingFailed}</span>}
        {analytics.sourceAvailability.analysisFailed > 0 && <span>Analysis retry: {analytics.sourceAvailability.analysisFailed}</span>}
        {analytics.sourceAvailability.legacyMetadata > 0 && <span>Legacy record needs reattachment: {analytics.sourceAvailability.legacyMetadata}</span>}
      </p>}
    </section>
    <section className="placement-header analytics-header"><div><button className="text-button analytics-back" onClick={onBack}><ArrowLeft size={15} />Placement drives</button><p className="eyebrow">DRIVE ANALYTICS</p><h2>{analytics.drive.companyName || 'Campus drive'} · {analytics.drive.role || 'Role not provided'}</h2><p className="muted">JD-derived role fit is matched deterministically against active student profiles; official fixed criteria remain separate.</p></div><div className="readiness-chip"><span>Drive eligibility readiness</span><strong>{displayPercent(summary.driveEligibilityReadiness)}</strong></div></section>
    <section className="analytics-summary-grid analytics-kpi-grid"><article className="analytics-summary-card"><UsersRound size={18} /><span>Total students</span><strong>{summary.totalStudents}</strong><small>Profiles analyzed for this drive</small></article><article className="analytics-summary-card eligible"><CheckCircle2 size={18} /><span>Eligible</span><strong>{summary.eligible}</strong><small>Fixed criteria met; all JD-required skills matched</small></article><article className="analytics-summary-card partial"><GraduationCap size={18} /><span>Training candidates</span><strong>{summary.partialMatch}</strong><small>Fixed criteria met; JD-required skills pending</small></article><article className="analytics-summary-card ineligible"><XCircle size={18} /><span>Not eligible</span><strong>{summary.notEligible}</strong><small>Fixed drive criteria need attention</small></article><article className="analytics-summary-card applications"><ClipboardList size={18} /><span>Total applications</span><strong>{totalApplications}</strong><small>Application records for this drive</small></article></section>
    <section className="analytics-dashboard-grid analytics-overview-grid"><ChartCard eyebrow={`JD ROLE FIT · ${source.shortLabel.toUpperCase()}`} title={`JD role-fit — ${source.shortLabel}`}><RoleFitDistributionChart data={roleFitDistribution} total={summary.analyzedStudents} source={analytics.analysisSource} availability={analytics.sourceAvailability} /></ChartCard><ChartCard eyebrow="OFFICIAL ELIGIBILITY" title="Fixed drive criteria"><DistributionChart data={distribution} total={summary.totalStudents} /></ChartCard></section>
    <ChartCard className="analytics-branch-readiness-card" eyebrow={`BRANCH ANALYSIS · ${source.shortLabel.toUpperCase()}`} title={`Drive readiness by branch — ${source.shortLabel}`}><BranchReadinessChart analytics={analytics} /></ChartCard>
    <ChartCard eyebrow="JD REQUIREMENT SUMMARY" title="Confirmed JD requirements and coverage"><JdRequirementSummary analytics={analytics} /></ChartCard>
    <section className="analytics-dashboard-grid analytics-detail-grid"><ChartCard eyebrow={`JD SKILL GAP ANALYSIS · ${source.shortLabel.toUpperCase()}`} title={`Top missing JD-required skills — ${source.shortLabel}`}><HorizontalSkillChart data={analytics.skillGaps.map((gap) => ({ label: gap.skill, value: gap.studentsMissing, percentage: gap.percentage }))} emptyMessage={`No missing JD-required skills were found from ${source.shortLabel.toLowerCase()}.`} ariaLabel="Top missing JD-required skills by number of students" /></ChartCard><ChartCard eyebrow={`PREFERRED JD SKILLS · ${source.shortLabel.toUpperCase()}`} title={`Top missing preferred skills — ${source.shortLabel}`}><HorizontalSkillChart data={analytics.preferredSkillGaps.map((gap) => ({ label: gap.skill, value: gap.studentsMissing, percentage: gap.percentage }))} emptyMessage={`No preferred JD skill gaps were found from ${source.shortLabel.toLowerCase()}.`} ariaLabel="Top missing preferred JD skills by number of students" /></ChartCard></section>
    <section className="analytics-dashboard-grid analytics-detail-grid"><ChartCard eyebrow={`JD SKILL GAPS BY BRANCH · ${source.shortLabel.toUpperCase()}`} title={`Where JD training demand is concentrated — ${source.shortLabel}`}><div className="analytics-filter-row"><label>Branch<select value={selectedGapBranch} onChange={(event) => setSelectedGapBranch(event.target.value)}><option value="">All branches</option>{gapBranches.map((branch) => <option key={branch} value={branch}>{formatBranchDisplayName(branch)}</option>)}</select></label><label>Skill<select value={selectedGapSkill} onChange={(event) => setSelectedGapSkill(event.target.value)}><option value="">All skills</option>{gapSkills.map((skill) => <option key={skill} value={skill}>{skill}</option>)}</select></label></div><BranchGapChart data={branchGapData} skills={visibleGapSkills} />{branchGapData.length && visibleGapSkills.length ? <details className="analytics-data-details"><summary>View data</summary><div className="tpo-table-wrap"><table className="tpo-table"><thead><tr><th>Branch</th>{visibleGapSkills.map((skill) => <th key={skill}>{skill}</th>)}</tr></thead><tbody>{branchGapData.map((branch) => <tr key={branch.branch}><td>{branch.branchLabel}</td>{visibleGapSkills.map((skill) => <td key={skill}>{branch[skill]}</td>)}</tr>)}</tbody></table></div></details> : null}</ChartCard><ChartCard eyebrow={`TRAINING PRIORITIES · ${source.shortLabel.toUpperCase()}`} title={`Skills with the highest JD training demand — ${source.shortLabel}`}><p className="analytics-chart-note">Based on {source.shortLabel.toLowerCase()}. Only students who meet all fixed eligibility criteria and have missing JD-required skills are counted as training candidates.</p><HorizontalSkillChart data={analytics.trainingPriorities.map((priority) => ({ label: priority.skill, value: priority.studentsMissing, percentage: priority.percentage }))} emptyMessage="This JD has no required skills, so there are no training gaps to prioritize." ariaLabel="JD training priority skills by number of students" /></ChartCard></section>
    {applicationStatusData.length ? <ChartCard eyebrow="APPLICATION STATUS" title="Applications across this drive"><div className="analytics-application-chart"><div className="analytics-donut" role="img" aria-label="Application status distribution"><ResponsiveContainer width="100%" height={230}><PieChart><Tooltip content={(props) => <DonutTooltip {...props} unit="applications" />} /><Pie data={applicationStatusData} dataKey="value" nameKey="label" innerRadius={58} outerRadius={86} paddingAngle={2} stroke="none">{applicationStatusData.map((item, index) => <Cell key={item.label} fill={chartPalette[index % chartPalette.length]} />)}</Pie></PieChart></ResponsiveContainer><div className="analytics-donut-total"><strong>{totalApplications}</strong><span>applications</span></div></div><ul className="analytics-chart-legend" aria-label="Application status details">{applicationStatusData.map((item, index) => <li key={item.label}><i style={{ backgroundColor: chartPalette[index % chartPalette.length] }} /><span>{item.label}</span><b>{item.value}</b><small>{displayPercent(item.percentage || 0)}</small></li>)}</ul></div></ChartCard> : null}
    <section className="placement-card analytics-students">
      <div className="result-header">
        <div><p className="eyebrow">STUDENT LISTS · {source.shortLabel.toUpperCase()}</p><h3>{studentList === 'eligible' ? 'Eligible students' : studentList === 'training' ? 'Students needing training' : 'Resume analysis status'}</h3></div>
        <div className="analytics-list-tabs">
          <button className={studentList === 'eligible' ? 'active' : ''} onClick={() => setStudentList('eligible')}>View eligible students ({summary.eligible})</button>
          <button className={studentList === 'training' ? 'active' : ''} onClick={() => setStudentList('training')}>Students needing training ({summary.partialMatch})</button>
          {analytics.analysisSource === 'resume' && <button className={studentList === 'unavailable' ? 'active' : ''} onClick={() => setStudentList('unavailable')}>Resume status ({analytics.sourceAvailability.unavailable})</button>}
        </div>
      </div>
      <div className="analytics-filters">
        <label>Branch<select value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch} value={branch}>{formatBranchDisplayName(branch)}</option>)}</select></label>
        {studentList === 'training' && <label>Training gap<select value={selectedSkill} onChange={(event) => setSelectedSkill(event.target.value)}><option value="">All skills</option>{analytics.skillGaps.map((gap) => <option key={gap.skill} value={gap.skill}>{gap.skill}</option>)}</select></label>}
      </div>
      <StudentCards students={visibleStudents} type={studentList} />
    </section>
  </section>
}
