import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Bell, Briefcase, Check, ClipboardList, Clock3, ExternalLink, LoaderCircle, MapPin, User, X } from 'lucide-react'
import applicationStatuses from '../../../shared/applicationStatuses.json'
import profileCatalog from '../../../shared/profileCatalog.json'
import '../placement.css'
import { applyToPlacementJob, getApplications, getNotifications, getOffCampusJobs, getOnCampusJobs, getStudentProfile, markAllNotificationsRead, markNotificationRead, removeProfilePhoto, updateStudentProfile, uploadProfilePhoto, uploadResume } from '../services/api'
import type { ApplicationStatus, InAppNotification, PlacementApplication, PlacementJob, ProfileCompletion, StudentProfile } from '../types/placement'
import ProfileEditor from './ProfileEditor'

export type PlacementSection = 'overview' | 'profile' | 'jobs' | 'applications' | 'notifications'
type PlacementDestination = 'analyze' | 'simulator' | 'plan' | 'history'
type Channel = 'ON_CAMPUS' | 'OFF_CAMPUS'
type Props = { section?: PlacementSection; onSectionChange?: (section: PlacementSection) => void; onNavigate?: (destination: PlacementDestination) => void }
const profilePhotoTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxProfilePhotoSize = 3 * 1024 * 1024

function formatDate(value: string | null | undefined) { const date = value ? new Date(value) : null; return !date || Number.isNaN(date.getTime()) ? 'Deadline not provided' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
function deadlineLabel(value: string | null) { if (!value) return 'Deadline not provided'; const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000); return !Number.isFinite(days) ? 'Deadline not provided' : days < 0 ? 'Closed' : days === 0 ? 'Closes today' : String(days) + ' days left' }
function safeUrl(value: string | null | undefined) { try { const parsed = new URL(value || ''); return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname ? parsed.toString() : null } catch { return null } }

function JobCard({ job, applied, applying, onApply, onProfile, onApplications }: { job: PlacementJob; applied: boolean; applying: boolean; onApply: (job: PlacementJob) => void; onProfile: () => void; onApplications: () => void }) {
  const campus = job.sourceType === 'ON_CAMPUS'
  const url = safeUrl(job.applicationUrl)
  const canApply = job.eligibility.eligible && job.status === 'active' && (campus || Boolean(url))
  const skills = job.eligibility.checks.skills
  const matched = new Set(skills.matched)
  return <article className="placement-card job-card">
    <div className="job-card-top"><div><p className="eyebrow">{job.companyName || 'Company not provided'}</p><h3>{job.role || 'Role not provided'}</h3></div><span className={'status-badge ' + job.status}>{job.status === 'active' ? 'Active' : 'Closed'}</span></div>
    <div className="job-facts"><span><Briefcase size={14} />{job.ctc || 'Salary not provided'}</span><span><MapPin size={14} />{job.location || 'Location not provided'}</span><span><Clock3 size={14} />{deadlineLabel(job.deadline)}</span></div>
    {job.jobDescription && <p className="job-description">{job.jobDescription}</p>}
    {campus ? null : <p className="job-source-note">{job.requirementsSource === 'INFERRED_FROM_DESCRIPTION' ? 'Skills are inferred from the listing description.' : 'External job listing requirements.'}</p>}
    <section className="job-skill-section"><span className="job-skill-heading">Required skills</span><div className="skill-list">{skills.required.length ? skills.required.map((skill) => <span className="skill-pill required" key={skill}>{skill}</span>) : <span className="muted">Requirements not provided.</span>}</div></section>
    {skills.required.length > 0 && <section className="job-skill-section"><span className="job-skill-heading">Your skill match</span><div className="skill-list">{skills.required.map((skill) => matched.has(skill) ? <span className="skill-pill matched" key={skill}><Check size={12} />{skill}</span> : <span className="skill-pill missing" key={skill}><X size={12} />{skill}</span>)}</div></section>}
    <div className={'eligibility-box ' + (job.eligibility.eligible ? 'eligible' : 'ineligible')}><strong>{job.eligibility.eligible ? campus ? 'Eligible for this campus drive' : 'Suitable based on available requirements' : 'Not eligible yet'}</strong>{job.eligibility.eligible ? <span>{campus ? 'You meet the official TPO criteria for this drive.' : 'This assessment only uses requirements available from the external listing.'}</span> : <>{skills.studentSkillCount === 0 && <button className="text-button eligibility-profile-link" type="button" onClick={onProfile}>Complete Profile <ArrowRight size={14} /></button>}<ul>{job.eligibility.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></>}</div>
    {applied && <p className="application-tracked"><Check size={14} />Application tracked</p>}
    {!campus && job.eligibility.eligible && job.status === 'active' && !url && <p className="application-link-unavailable">Company application link unavailable</p>}
    {applied && campus
      ? <button className="secondary-button job-action" type="button" onClick={onApplications}><ClipboardList size={16} />View application</button>
      : <button className="primary-button" disabled={!canApply || applying} onClick={() => onApply(job)}>{applying ? <LoaderCircle className="spin" size={16} /> : applied ? <ExternalLink size={16} /> : <Briefcase size={16} />}{applying ? campus ? 'Tracking application...' : 'Opening company job...' : applied ? 'Open Company Job' : !campus && !url ? 'Company application link unavailable' : campus ? 'Apply for Campus Drive' : 'Apply on Company Site'}</button>}
  </article>
}

export default function PlacementManagement({ section, onSectionChange, onNavigate }: Props) {
  const [localSection, setLocalSection] = useState<PlacementSection>('overview')
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null)
  const [jobs, setJobs] = useState<PlacementJob[]>([])
  const [onCampusCount, setOnCampusCount] = useState(0)
  const [applications, setApplications] = useState<PlacementApplication[]>([])
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [channel, setChannel] = useState<Channel>('ON_CAMPUS')
  const [applicationFilter, setApplicationFilter] = useState<'ALL' | Channel>('ALL')
  const [jobsMessage, setJobsMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [applyingJobId, setApplyingJobId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [eligibleOnly, setEligibleOnly] = useState(false)
  const activeSection = section || localSection
  const selectSection = (next: PlacementSection) => { if (onSectionChange) onSectionChange(next); else setLocalSection(next) }

  useEffect(() => { void (async () => {
    setLoading(true)
    try {
      const results = await Promise.all([getStudentProfile(), getApplications(), getNotifications()])
      setProfile(results[0].profile); setCompletion(results[0].completion); setApplications(results[1]); setNotifications(results[2].items)
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load placement data.') } finally { setLoading(false) }
  })() }, [])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    void (async () => {
      setJobsLoading(true); setJobsMessage('')
      try {
        if (channel === 'ON_CAMPUS') {
          const items = await getOnCampusJobs()
          if (!cancelled) { setJobs(items); setOnCampusCount(items.filter((job) => job.status === 'active').length) }
        } else {
          const result = await getOffCampusJobs()
          if (!cancelled) { setJobs(result.items); setJobsMessage(result.message || (result.availability === 'not_configured' ? 'Off-campus jobs are not configured yet.' : '')) }
        }
      } catch (err) { if (!cancelled) { setJobs([]); setJobsMessage(err instanceof Error ? err.message : 'Off-campus jobs are temporarily unavailable.') } } finally { if (!cancelled) setJobsLoading(false) }
    })()
    return () => { cancelled = true }
  }, [channel, profile?.email])

  const locations = useMemo(() => [...new Set(jobs.map((job) => job.location).filter((value): value is string => Boolean(value)))], [jobs])
  const roles = useMemo(() => [...new Set(jobs.map((job) => job.role).filter((value): value is string => Boolean(value)))], [jobs])
  const visibleJobs = useMemo(() => jobs.filter((job) => {
    const term = search.trim().toLowerCase()
    return (!term || ((job.companyName || '') + ' ' + (job.role || '')).toLowerCase().includes(term)) && (!locationFilter || job.location === locationFilter) && (!roleFilter || job.role === roleFilter) && (!eligibleOnly || job.eligibility.eligible)
  }), [jobs, search, locationFilter, roleFilter, eligibleOnly])
  const appliedIds = useMemo(() => new Set(applications.map((application) => application.jobId)), [applications])
  const filteredApplications = applicationFilter === 'ALL' ? applications : applications.filter((application) => application.hiringType === applicationFilter)
  const statuses = [...new Set([...applicationStatuses, ...filteredApplications.map((application) => application.status)])] as ApplicationStatus[]

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true); setError('')
    try {
      const result = await updateStudentProfile({ fullName: profile.fullName, phone: profile.phone, branch: profileCatalog.branchOptions.some(({ value }) => value === profile.branch) ? profile.branch : undefined, college: profile.college, cgpa: profile.cgpa, backlogs: profile.backlogs, graduationYear: profile.graduationYear, skills: profile.skills, projects: profile.projects, preferredRoles: profile.preferredRoles, preferredLocations: profile.preferredLocations, socialLinks: profile.socialLinks })
      setProfile(result.profile); setCompletion(result.completion); setNotice('Profile saved. Eligibility checks have been updated.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save your profile.') } finally { setSaving(false) }
  }
  const uploadProfileResume = async (file?: File) => {
    if (!file) return
    setUploadingResume(true); setError('')
    try { await uploadResume(file); const result = await getStudentProfile(); setProfile(result.profile); setCompletion(result.completion); setNotice('Resume uploaded and attached to your placement profile.') } catch (err) { setError(err instanceof Error ? err.message : 'Unable to upload your resume.') } finally { setUploadingResume(false) }
  }
  const uploadStudentPhoto = async (file?: File) => {
    if (!file) return
    if (!profilePhotoTypes.has(file.type)) { setError('Profile photos must be JPG, PNG, or WEBP files.'); return }
    if (!file.size) { setError('Choose a non-empty profile photo.'); return }
    if (file.size > maxProfilePhotoSize) { setError('Profile photos must be 3MB or smaller.'); return }
    setUploadingPhoto(true); setError('')
    try {
      const result = await uploadProfilePhoto(file)
      setProfile(result.profile); setCompletion(result.completion); setNotice('Profile photo updated.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to upload your profile photo.') } finally { setUploadingPhoto(false) }
  }
  const removeStudentPhoto = async () => {
    setUploadingPhoto(true); setError('')
    try {
      const result = await removeProfilePhoto()
      setProfile(result.profile); setCompletion(result.completion); setNotice('Profile photo removed.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to remove your profile photo.') } finally { setUploadingPhoto(false) }
  }
  const apply = async (job: PlacementJob) => {
    const url = safeUrl(job.applicationUrl)
    if (job.sourceType === 'OFF_CAMPUS' && !url) { setError('Company application link unavailable for this listing.'); return }
    setApplyingJobId(job.id); setError('')
    try {
      const result = await applyToPlacementJob(job.id)
      setApplications((current) => result.alreadyApplied || current.some((application) => application.id === result.application.id) ? current : [result.application, ...current])
      if (job.sourceType === 'OFF_CAMPUS' && url) window.open(url, '_blank', 'noopener,noreferrer')
      setNotice(job.sourceType === 'ON_CAMPUS' ? 'Campus-drive application submitted and added to your tracker.' : 'Application tracked. Complete your application on the company website.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to track this application.') } finally { setApplyingJobId('') }
  }
  const markRead = async (id: string) => { try { const updated = await markNotificationRead(id); setNotifications((items) => items.map((item) => item.id === updated.id ? updated : item)) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to mark notification as read.') } }
  const markAll = async () => { try { await markAllNotificationsRead(); setNotifications((items) => items.map((item) => ({ ...item, read: true }))) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update notifications.') } }

  if (loading || !profile || !completion) return <section className="single-panel placement-loading"><LoaderCircle className="spin" size={28} /><p>Loading your placement hub...</p></section>
  const campusCount = onCampusCount
  const unreadCount = notifications.filter((item) => !item.read).length

  return <section className="placement-workspace">
    {error && <div className="error-banner">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
    {notice && <div className="placement-notice"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss confirmation"><X size={16} /></button></div>}
    {activeSection === 'overview' && <><section className="placement-home-hero"><div><p className="eyebrow">PLACEMENT HUB</p><h1>Welcome, <em>{profile.fullName.split(' ')[0] || 'there'}</em></h1><p>Your profile is {completion.percentage}% complete. Keep it current for accurate matching.</p></div><div className="hub-completion"><span>PROFILE COMPLETION</span><strong>{completion.percentage}%</strong><div className="completion-track"><i style={{ width: String(completion.percentage) + '%' }} /></div><button className="primary-button" onClick={() => selectSection('profile')}><User size={16} />Edit profile</button></div></section><div className="placement-metric-grid"><section className="placement-card profile-snapshot"><p className="eyebrow">STUDENT PROFILE</p><h3>{profile.fullName || 'Your profile is ready for details'}</h3><p>{profile.branch || 'Branch not added'}</p></section><section className="placement-card stat-card"><Briefcase size={21} /><strong>{campusCount}</strong><span>On-campus drives</span><button className="text-button" onClick={() => { setChannel('ON_CAMPUS'); selectSection('jobs') }}>View drives</button></section><section className="placement-card stat-card"><ClipboardList size={21} /><strong>{applications.length}</strong><span>Applications</span><button className="text-button" onClick={() => selectSection('applications')}>Open tracker</button></section></div><div className="placement-two-column hub-detail-grid"><section className="placement-card channel-summary"><p className="eyebrow">ON-CAMPUS HIRING</p><h3>TPO-published campus drives</h3><p>Eligibility uses official criteria entered by your placement team.</p><button className="primary-button" onClick={() => { setChannel('ON_CAMPUS'); selectSection('jobs') }}>View On-Campus Jobs <ArrowRight size={16} /></button></section><section className="placement-card channel-summary"><p className="eyebrow">OFF-CAMPUS HIRING</p><h3>External opportunities</h3><p>Listings come from the configured job provider and link to the company application page.</p><button className="secondary-button" onClick={() => { setChannel('OFF_CAMPUS'); selectSection('jobs') }}>Explore Off-Campus Jobs <ExternalLink size={16} /></button></section></div></>}
    {activeSection === 'profile' && <ProfileEditor profile={profile} completion={completion} saving={saving} uploadingResume={uploadingResume} uploadingPhoto={uploadingPhoto} onChange={setProfile} onSave={() => void saveProfile()} onUploadResume={uploadProfileResume} onUploadPhoto={uploadStudentPhoto} onRemovePhoto={removeStudentPhoto} onNavigate={(destination) => onNavigate?.(destination)} />}
    {activeSection === 'jobs' && <><section className="placement-card job-filter-panel"><div><p className="eyebrow">JOB BOARD</p><h2>{channel === 'ON_CAMPUS' ? 'On-Campus Hiring' : 'Off-Campus Hiring'}</h2><p className="muted">{channel === 'ON_CAMPUS' ? 'TPO-published placement opportunities.' : 'External jobs from the configured provider.'}</p></div><div className="channel-tabs"><button className={channel === 'ON_CAMPUS' ? 'active' : ''} onClick={() => setChannel('ON_CAMPUS')}>On-Campus</button><button className={channel === 'OFF_CAMPUS' ? 'active' : ''} onClick={() => setChannel('OFF_CAMPUS')}>Off-Campus</button></div><div className="job-filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company or role" /><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">All roles</option>{roles.map((role) => <option key={role}>{role}</option>)}</select><select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="">All locations</option>{locations.map((location) => <option key={location}>{location}</option>)}</select><label className="filter-checkbox"><input type="checkbox" checked={eligibleOnly} onChange={(event) => setEligibleOnly(event.target.checked)} />Eligible only</label></div></section>{jobsMessage && <div className="placement-warning">{jobsMessage}</div>}{jobsLoading ? <section className="placement-card placement-loading"><LoaderCircle className="spin" size={24} /><p>Loading opportunities...</p></section> : <div className="job-grid">{visibleJobs.length ? visibleJobs.map((job) => <JobCard key={job.id} job={job} applied={appliedIds.has(job.id)} applying={applyingJobId === job.id} onApply={apply} onProfile={() => selectSection('profile')} onApplications={() => selectSection('applications')} />) : <section className="placement-card empty-placement"><Briefcase size={26} /><h3>No opportunities available.</h3><p>{channel === 'ON_CAMPUS' ? 'Your TPO can publish a drive when one is available.' : 'Check the provider configuration or try again later.'}</p></section>}</div>}</>}
    {activeSection === 'applications' && <section className="placement-card tracker-panel"><div className="result-header"><div><p className="eyebrow">APPLICATION TRACKER</p><h2>Every opportunity, in one place.</h2><p className="muted">Campus applications are managed in PlaceX; off-campus applications link to company sites.</p></div></div><div className="channel-tabs application-tabs"><button className={applicationFilter === 'ALL' ? 'active' : ''} onClick={() => setApplicationFilter('ALL')}>All</button><button className={applicationFilter === 'ON_CAMPUS' ? 'active' : ''} onClick={() => setApplicationFilter('ON_CAMPUS')}>On-Campus</button><button className={applicationFilter === 'OFF_CAMPUS' ? 'active' : ''} onClick={() => setApplicationFilter('OFF_CAMPUS')}>Off-Campus</button></div><div className="tracker-grid">{statuses.map((status) => <div className="tracker-column" key={status}><h4>{status}<span>{filteredApplications.filter((item) => item.status === status).length}</span></h4>{filteredApplications.filter((item) => item.status === status).map((application) => { const url = safeUrl(application.externalApplicationUrl); return <article className="application-card" key={application.id}><strong>{application.job?.companyName || 'Company not provided'}</strong><span>{application.job?.role || 'Role not provided'}</span><small>{application.hiringType === 'ON_CAMPUS' ? 'On-campus' : 'Off-campus'} · Applied {formatDate(application.appliedAt)}</small>{application.hiringType === 'OFF_CAMPUS' && url && <a className="text-button application-external-link" href={url} target="_blank" rel="noopener noreferrer">Open Company Job <ExternalLink size={13} /></a>}</article> })}</div>)}</div></section>}
    {activeSection === 'notifications' && <section className="placement-card notification-panel"><div className="result-header"><div><p className="eyebrow">IN-APP NOTIFICATIONS</p><h2>Deadlines and profile reminders</h2></div>{unreadCount > 0 && <button className="text-button" onClick={() => void markAll()}>Mark all as read</button>}</div>{notifications.length ? <div className="notification-list">{notifications.map((item) => <article className={'notification-item ' + (item.read ? 'read' : '')} key={item.id}><Bell size={17} /><div><strong>{item.title}</strong><p>{item.message}</p><small>{formatDate(item.createdAt)}</small></div>{!item.read && <button className="text-button" onClick={() => void markRead(item.id)}>Mark read</button>}</article>)}</div> : <div className="empty-placement"><Bell size={26} /><h3>You are all caught up.</h3><p>Placement reminders will appear here.</p></div>}</section>}
  </section>
}
