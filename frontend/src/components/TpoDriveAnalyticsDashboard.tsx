import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, CheckCircle2, ClipboardList, GraduationCap, LoaderCircle, UsersRound, XCircle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getCampusDriveAnalytics } from '../services/api'
import type { DriveAnalytics, DriveAnalyticsStudent } from '../types/placement'
import '../placement.css'

type StudentList = 'eligible' | 'training'
type ChartRow = { label: string; value: number; percentage?: number }
type BranchGapRow = { branch: string } & Record<string, string | number>

const chartPalette = ['#5f7d32', '#94ad5c', '#d6a44d', '#b96d53', '#577d86', '#9d7c9b']
const fitColors = { Eligible: '#5f7d32', 'Partial match': '#d6a44d', 'Not eligible': '#b96d53' }

function displayPercent(value: number) { return `${Math.round(value)}%` }
function readableStatus(status: string) { return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) }

function ChartEmpty({ children }: { children: string }) {
  return <div className="analytics-chart-empty"><BarChart3 size={20} /><p>{children}</p></div>
}

function ChartCard({ eyebrow, title, children, className = '' }: { eyebrow: string; title: string; children: React.ReactNode; className?: string }) {
  return <section className={`placement-card analytics-chart ${className}`}><div className="analytics-card-heading"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div></div>{children}</section>
}

function DistributionChart({ data, total }: { data: ChartRow[]; total: number }) {
  if (!total) return <ChartEmpty>No analytics data available yet.</ChartEmpty>
  return <div className="analytics-donut-layout"><div className="analytics-donut" role="img" aria-label="Student eligibility distribution"><ResponsiveContainer width="100%" height={232}><PieChart><Tooltip formatter={(value) => [`${value} students`, 'Count']} /><Pie data={data} dataKey="value" nameKey="label" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none">{data.map((item) => <Cell key={item.label} fill={fitColors[item.label as keyof typeof fitColors]} />)}</Pie></PieChart></ResponsiveContainer><div className="analytics-donut-total"><strong>{total}</strong><span>students</span></div></div><ul className="analytics-chart-legend" aria-label="Eligibility distribution details">{data.map((item) => <li key={item.label}><i style={{ backgroundColor: fitColors[item.label as keyof typeof fitColors] }} /><span>{item.label}</span><b>{item.value}</b><small>{displayPercent(item.percentage || 0)}</small></li>)}</ul></div>
}

function HorizontalSkillChart({ data, emptyMessage, ariaLabel }: { data: ChartRow[]; emptyMessage: string; ariaLabel: string }) {
  if (!data.length) return <ChartEmpty>{emptyMessage}</ChartEmpty>
  return <div className="analytics-chart-scroll" role="img" aria-label={ariaLabel}><div style={{ minWidth: '620px', height: Math.max(248, data.length * 42) }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#e8ede4" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="label" width={172} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [`${value} students`, 'Missing']} /><Bar dataKey="value" fill="#6f8f37" radius={[0, 6, 6, 0]} maxBarSize={24}><LabelList dataKey="value" position="right" fill="#44564b" fontSize={11} /></Bar></BarChart></ResponsiveContainer></div></div>
}

function BranchReadinessChart({ analytics }: { analytics: DriveAnalytics }) {
  if (!analytics.branchAnalysis.length) return <ChartEmpty>No active student profiles are available for branch analysis.</ChartEmpty>
  return <div className="analytics-chart-scroll" role="img" aria-label="Student eligibility composition by branch"><div style={{ width: Math.max(720, analytics.branchAnalysis.length * 154), height: 334 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.branchAnalysis} margin={{ top: 12, right: 22, left: 0, bottom: 74 }} barCategoryGap="25%"><CartesianGrid stroke="#e8ede4" vertical={false} /><XAxis dataKey="branch" interval={0} tickLine={false} axisLine={false} angle={-24} textAnchor="end" height={80} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip /><Legend verticalAlign="top" height={34} /><Bar dataKey="eligibleStudents" name="Fully eligible" stackId="readiness" fill="#5f7d32" radius={[5, 5, 0, 0]} /><Bar dataKey="partialMatchStudents" name="Partial match / trainable" stackId="readiness" fill="#d6a44d" /><Bar dataKey="notEligibleStudents" name="Not eligible" stackId="readiness" fill="#b96d53" radius={[0, 0, 5, 5]} /></BarChart></ResponsiveContainer></div><div className="branch-readiness-details" aria-label="Fully eligible rate by branch">{analytics.branchAnalysis.map((branch) => <span key={branch.branch}><b>{branch.branch}</b>{branch.eligibleStudents}/{branch.totalStudents} fully eligible · {displayPercent(branch.readinessPercentage)}</span>)}</div></div>
}

function BranchGapChart({ data, skills }: { data: BranchGapRow[]; skills: string[] }) {
  if (!data.length || !skills.length) return <ChartEmpty>No branch-level skill gaps are available for this selection.</ChartEmpty>
  return <div className="analytics-chart-scroll" role="img" aria-label="Missing skills by branch"><div style={{ width: Math.max(720, data.length * Math.max(150, skills.length * 46)), height: 350 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 22, left: 0, bottom: 74 }} barGap={4}><CartesianGrid stroke="#e8ede4" vertical={false} /><XAxis dataKey="branch" interval={0} tickLine={false} axisLine={false} angle={-24} textAnchor="end" height={80} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip /><Legend verticalAlign="top" height={34} />{skills.map((skill, index) => <Bar key={skill} dataKey={skill} name={skill} fill={chartPalette[index % chartPalette.length]} radius={[4, 4, 0, 0]} />)}</BarChart></ResponsiveContainer></div></div>
}

function StudentCards({ students, type }: { students: DriveAnalyticsStudent[]; type: StudentList }) {
  if (!students.length) return <p className="muted">No students match the selected filters.</p>
  return <div className="analytics-student-grid" role="list">{students.map((student) => <article className="analytics-student-card" key={student.studentId} role="listitem"><div className="analytics-student-identity"><strong>{student.fullName || student.studentId}</strong><span>{student.branch || 'Branch not provided'} · CGPA {student.cgpa ?? 'Not provided'}</span></div><span className="analytics-application-status">{student.applicationStatus ? readableStatus(student.applicationStatus) : 'No application recorded'}</span><div className="analytics-skill-match"><span>Skill match</span><b>{student.skillMatch.matchedSkills}/{student.skillMatch.requiredSkills}</b></div>{type === 'eligible' ? <div className="analytics-skills">{student.skills.length ? student.skills.map((skill) => <span key={skill}>{skill}</span>) : <small>No profile skills provided</small>}</div> : <div className="analytics-skills gaps">{student.missingSkills.length ? student.missingSkills.map((skill) => <span key={skill}>{skill}</span>) : <small>No skill gaps returned</small>}</div>}</article>)}</div>
}

export default function TpoDriveAnalyticsDashboard({ driveId, onBack }: { driveId: string; onBack: () => void }) {
  const [analytics, setAnalytics] = useState<DriveAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedSkill, setSelectedSkill] = useState('')
  const [selectedGapBranch, setSelectedGapBranch] = useState('')
  const [selectedGapSkill, setSelectedGapSkill] = useState('')
  const [studentList, setStudentList] = useState<StudentList>('eligible')

  useEffect(() => {
    let current = true
    setLoading(true); setError(''); setAnalytics(null); setSelectedBranch(''); setSelectedSkill(''); setSelectedGapBranch(''); setSelectedGapSkill(''); setStudentList('eligible')
    void getCampusDriveAnalytics(driveId).then((result) => { if (current) setAnalytics(result) }).catch((err) => { if (current) setError(err instanceof Error ? err.message : 'Unable to load drive analytics.') }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [driveId])

  const branches = useMemo(() => analytics?.branchAnalysis.map((item) => item.branch) || [], [analytics])
  const gapBranches = useMemo(() => analytics?.branchSkillGaps.map((item) => item.branch) || [], [analytics])
  const gapSkills = useMemo(() => [...new Set([...(analytics?.skillGaps.map((gap) => gap.skill) || []), ...(analytics?.branchSkillGaps.flatMap((branch) => branch.skillGaps.map((gap) => gap.skill)) || [])])], [analytics])
  const visibleEligible = useMemo(() => (analytics?.eligibleStudents || []).filter((student) => !selectedBranch || (student.branch || 'Not provided') === selectedBranch), [analytics, selectedBranch])
  const visibleTraining = useMemo(() => (analytics?.trainingCandidates || []).filter((student) => (!selectedBranch || (student.branch || 'Not provided') === selectedBranch) && (!selectedSkill || student.missingSkills.includes(selectedSkill))), [analytics, selectedBranch, selectedSkill])
  const visibleGapSkills = useMemo(() => selectedGapSkill ? [selectedGapSkill] : gapSkills, [gapSkills, selectedGapSkill])
  const branchGapData = useMemo<BranchGapRow[]>(() => (analytics?.branchSkillGaps || []).filter((branch) => !selectedGapBranch || branch.branch === selectedGapBranch).map((branch) => { const row: BranchGapRow = { branch: branch.branch }; for (const skill of visibleGapSkills) row[skill] = branch.skillGaps.find((gap) => gap.skill === skill)?.studentsMissing || 0; return row }), [analytics, selectedGapBranch, visibleGapSkills])
  const allStudents = useMemo(() => analytics ? [...analytics.eligibleStudents, ...analytics.trainingCandidates, ...analytics.notEligibleStudents] : [], [analytics])
  const applicationStatusData = useMemo<ChartRow[]>(() => { const counts = new Map<string, number>(); for (const student of allStudents) if (student.applicationStatus) counts.set(student.applicationStatus, (counts.get(student.applicationStatus) || 0) + 1); const total = [...counts.values()].reduce((sum, count) => sum + count, 0); return [...counts.entries()].map(([label, value]) => ({ label: readableStatus(label), value, percentage: total ? (value / total) * 100 : 0 })).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label)) }, [allStudents])

  if (loading) return <section className="placement-card placement-loading"><LoaderCircle className="spin" size={24} /><p>Calculating live drive analytics...</p></section>
  if (error || !analytics) return <section className="placement-card analytics-error"><button className="text-button" onClick={onBack}><ArrowLeft size={15} />Back to drives</button><p>{error || 'Drive analytics are unavailable.'}</p></section>

  const { summary } = analytics
  const distribution = [{ label: 'Eligible', value: summary.eligible, percentage: summary.totalStudents ? (summary.eligible / summary.totalStudents) * 100 : 0 }, { label: 'Partial match', value: summary.partialMatch, percentage: summary.totalStudents ? (summary.partialMatch / summary.totalStudents) * 100 : 0 }, { label: 'Not eligible', value: summary.notEligible, percentage: summary.totalStudents ? (summary.notEligible / summary.totalStudents) * 100 : 0 }]
  const totalApplications = applicationStatusData.reduce((sum, item) => sum + item.value, 0)
  const visibleStudents = studentList === 'eligible' ? visibleEligible : visibleTraining

  return <section className="placement-workspace analytics-workspace">
    <section className="placement-header analytics-header"><div><button className="text-button analytics-back" onClick={onBack}><ArrowLeft size={15} />Placement drives</button><p className="eyebrow">DRIVE ANALYTICS</p><h2>{analytics.drive.companyName || 'Campus drive'} · {analytics.drive.role || 'Role not provided'}</h2><p className="muted">Live analysis of active student profiles against this drive’s official eligibility criteria.</p></div><div className="readiness-chip"><span>Drive eligibility readiness</span><strong>{displayPercent(summary.driveEligibilityReadiness)}</strong></div></section>
    <section className="analytics-summary-grid analytics-kpi-grid"><article className="analytics-summary-card"><UsersRound size={18} /><span>Total students</span><strong>{summary.totalStudents}</strong><small>Profiles analyzed for this drive</small></article><article className="analytics-summary-card eligible"><CheckCircle2 size={18} /><span>Eligible</span><strong>{summary.eligible}</strong><small>Meet every required criterion</small></article><article className="analytics-summary-card partial"><GraduationCap size={18} /><span>Training candidates</span><strong>{summary.partialMatch}</strong><small>Fixed criteria met; skills pending</small></article><article className="analytics-summary-card ineligible"><XCircle size={18} /><span>Not eligible</span><strong>{summary.notEligible}</strong><small>Fixed criteria need attention</small></article><article className="analytics-summary-card applications"><ClipboardList size={18} /><span>Total applications</span><strong>{totalApplications}</strong><small>Application records for this drive</small></article></section>
    <section className="analytics-dashboard-grid analytics-overview-grid"><ChartCard eyebrow="STUDENT FIT" title="Eligibility distribution"><DistributionChart data={distribution} total={summary.totalStudents} /></ChartCard><ChartCard eyebrow="BRANCH ANALYSIS" title="Drive readiness by branch"><BranchReadinessChart analytics={analytics} /></ChartCard></section>
    <ChartCard eyebrow="SKILL GAP ANALYSIS" title="Top missing skills"><HorizontalSkillChart data={analytics.skillGaps.map((gap) => ({ label: gap.skill, value: gap.studentsMissing, percentage: gap.percentage }))} emptyMessage="No skill gaps were found for the analyzed student population." ariaLabel="Top missing skills by number of students" /></ChartCard>
    <section className="analytics-dashboard-grid analytics-detail-grid"><ChartCard eyebrow="SKILL GAPS BY BRANCH" title="Where training demand is concentrated"><div className="analytics-filter-row"><label>Branch<select value={selectedGapBranch} onChange={(event) => setSelectedGapBranch(event.target.value)}><option value="">All branches</option>{gapBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label><label>Skill<select value={selectedGapSkill} onChange={(event) => setSelectedGapSkill(event.target.value)}><option value="">All skills</option>{gapSkills.map((skill) => <option key={skill} value={skill}>{skill}</option>)}</select></label></div><BranchGapChart data={branchGapData} skills={visibleGapSkills} />{branchGapData.length && visibleGapSkills.length ? <details className="analytics-data-details"><summary>View data</summary><div className="tpo-table-wrap"><table className="tpo-table"><thead><tr><th>Branch</th>{visibleGapSkills.map((skill) => <th key={skill}>{skill}</th>)}</tr></thead><tbody>{branchGapData.map((branch) => <tr key={branch.branch}><td>{branch.branch}</td>{visibleGapSkills.map((skill) => <td key={skill}>{branch[skill]}</td>)}</tr>)}</tbody></table></div></details> : null}</ChartCard><ChartCard eyebrow="TRAINING PRIORITIES" title="Skills with the highest training demand"><p className="analytics-chart-note">Only students who meet all fixed eligibility criteria are counted as training candidates.</p><HorizontalSkillChart data={analytics.trainingPriorities.map((priority) => ({ label: priority.skill, value: priority.studentsMissing, percentage: priority.percentage }))} emptyMessage="This drive has no required skills, so there are no skill gaps to prioritize." ariaLabel="Training priority skills by number of students" /></ChartCard></section>
    {applicationStatusData.length ? <ChartCard eyebrow="APPLICATION STATUS" title="Applications across this drive"><div className="analytics-application-chart"><div className="analytics-donut" role="img" aria-label="Application status distribution"><ResponsiveContainer width="100%" height={230}><PieChart><Tooltip formatter={(value) => [`${value} applications`, 'Count']} /><Pie data={applicationStatusData} dataKey="value" nameKey="label" innerRadius={58} outerRadius={86} paddingAngle={2} stroke="none">{applicationStatusData.map((item, index) => <Cell key={item.label} fill={chartPalette[index % chartPalette.length]} />)}</Pie></PieChart></ResponsiveContainer><div className="analytics-donut-total"><strong>{totalApplications}</strong><span>applications</span></div></div><ul className="analytics-chart-legend" aria-label="Application status details">{applicationStatusData.map((item, index) => <li key={item.label}><i style={{ backgroundColor: chartPalette[index % chartPalette.length] }} /><span>{item.label}</span><b>{item.value}</b><small>{displayPercent(item.percentage || 0)}</small></li>)}</ul></div></ChartCard> : null}
    <section className="placement-card analytics-students"><div className="result-header"><div><p className="eyebrow">STUDENT LISTS</p><h3>{studentList === 'eligible' ? 'Eligible students' : 'Students needing training'}</h3></div><div className="analytics-list-tabs"><button className={studentList === 'eligible' ? 'active' : ''} onClick={() => setStudentList('eligible')}>View eligible students ({summary.eligible})</button><button className={studentList === 'training' ? 'active' : ''} onClick={() => setStudentList('training')}>Students needing training ({summary.partialMatch})</button></div></div><div className="analytics-filters"><label>Branch<select value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label>{studentList === 'training' && <label>Training gap<select value={selectedSkill} onChange={(event) => setSelectedSkill(event.target.value)}><option value="">All skills</option>{analytics.skillGaps.map((gap) => <option key={gap.skill} value={gap.skill}>{gap.skill}</option>)}</select></label>}</div><StudentCards students={visibleStudents} type={studentList} /></section>
  </section>
}
