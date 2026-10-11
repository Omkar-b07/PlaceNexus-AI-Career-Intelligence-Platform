import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Check, Edit3, LoaderCircle, Plus, Send, Sparkles, Trash2, X } from 'lucide-react'
import profileCatalog from '../../../shared/profileCatalog.json'
import { ApiRequestError, analyzeCampusJobDescription, archiveCampusJob, createCampusJob, getManagedCampusJobs, setCampusJobStatus, updateCampusJob, type CampusJobInput } from '../services/api'
import type { PlacementJob } from '../types/placement'
import ProfileMultiSelect from './ProfileMultiSelect'
import '../placement.css'

type DrivePage = 'list' | 'new' | 'detail'
type Props = { page?: DrivePage; driveId?: string | null; onNavigate: (path: string) => void; onOpenAnalytics: (jobId: string) => void }

const emptyJob = (): CampusJobInput => ({ companyName: '', role: '', jobDescription: '', ctc: '', ctcLpa: null, location: '', deadline: '', jdAnalysis: null, eligibleBranches: [], minimumCgpa: null, maximumBacklogs: null, graduationYears: [], employmentType: '', additionalCriteria: '' })

function driveSaveError(error: unknown) {
  if (!(error instanceof ApiRequestError)) return 'Unable to save the drive. Please try again.'
  if (error.status === 400) return 'Please check the drive details.'
  if (error.status === 401) return 'Your session has expired. Please sign in again.'
  if (error.status === 403) return 'You are not authorized to edit this drive.'
  if (error.status === 404) return 'Drive not found.'
  return 'Unable to save the drive. Please try again.'
}

export default function TpoDriveManagement({ page = 'list', driveId, onNavigate, onOpenAnalytics }: Props) {
  const [jobs, setJobs] = useState<PlacementJob[]>([])
  const [form, setForm] = useState<CampusJobInput>(emptyJob)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analyzingJd, setAnalyzingJd] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const skills = useMemo(() => profileCatalog.skillCategories.map((category) => ({ name: category.name, options: category.skills })), [])
  const branches = useMemo(() => [{ name: 'Student profile branches', options: profileCatalog.branchOptions }], [])
  const graduationYears = useMemo(() => [{ name: 'Graduation years', options: Array.from({ length: 26 }, (_, index) => String(2020 + index)) }], [])
  const isEditor = page !== 'list'

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        setJobs(await getManagedCampusJobs())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load campus drives.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (page !== 'detail' || !driveId || editingId === driveId) return
    const job = jobs.find((item) => item.id === driveId)
    if (!job) {
      if (!loading) setError('That campus drive was not found.')
      return
    }
    setEditingId(job.id)
    setForm({
      companyName: job.companyName || '', role: job.role || '', jobDescription: job.jobDescription || '', ctc: job.ctc || '', ctcLpa: job.ctcLpa,
      location: job.location || '', deadline: job.deadline ? job.deadline.slice(0, 10) : '', jdAnalysis: job.jdAnalysis,
      eligibleBranches: job.eligibleBranches, minimumCgpa: job.minimumCgpa, maximumBacklogs: job.maximumBacklogs,
      graduationYears: job.graduationYears, employmentType: job.employmentType || '', additionalCriteria: job.additionalCriteria || ''
    })
  }, [page, driveId, jobs, loading, editingId])

  const save = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const job = editingId ? await updateCampusJob(editingId, form) : await createCampusJob(form)
      setJobs((items) => editingId ? items.map((item) => item.id === job.id ? job : item) : [job, ...items])
      setNotice(editingId ? 'Campus drive updated.' : 'Campus drive saved as a draft.')
      window.setTimeout(() => onNavigate('/tpo/drives'), 350)
    } catch (err) {
      setError(driveSaveError(err))
    } finally {
      setSaving(false)
    }
  }

  const analyzeJd = async () => {
    setAnalyzingJd(true)
    setError('')
    setNotice('')
    try {
      const jdAnalysis = await analyzeCampusJobDescription(form.jobDescription)
      setForm((current) => ({ ...current, jdAnalysis }))
      setNotice('JD requirements extracted. Review and confirm them before saving the drive.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze the job description. Please try again.')
    } finally {
      setAnalyzingJd(false)
    }
  }

  const updateJdSkills = (field: 'requiredSkills' | 'preferredSkills', values: string[]) => {
    setForm((current) => {
      if (!current.jdAnalysis) return current
      const requiredSkills = field === 'requiredSkills' ? values : current.jdAnalysis.requiredSkills.filter((skill) => !values.includes(skill))
      const preferredSkills = field === 'preferredSkills' ? values.filter((skill) => !requiredSkills.includes(skill)) : current.jdAnalysis.preferredSkills.filter((skill) => !requiredSkills.includes(skill))
      return { ...current, jdAnalysis: { ...current.jdAnalysis, requiredSkills, preferredSkills } }
    })
  }

  const changeStatus = async (jobId: string, action: 'publish' | 'unpublish' | 'close') => {
    try {
      const job = await setCampusJobStatus(jobId, action)
      setJobs((items) => items.map((item) => item.id === job.id ? job : item))
      setNotice('Campus-drive status updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the campus drive.')
    }
  }

  const archive = async (jobId: string) => {
    try {
      const job = await archiveCampusJob(jobId)
      setJobs((items) => items.map((item) => item.id === job.id ? job : item))
      setNotice('Campus drive archived.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive the campus drive.')
    }
  }

  const visibleJobs = filter === 'ALL' ? jobs : jobs.filter((job) => job.jobStatus === filter)

  return <section className="placement-workspace tpo-workspace">
    {error && <div className="error-banner">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
    {notice && <div className="placement-notice"><Check size={16} />{notice}</div>}
    <section className="placement-header">
      <div>
        <p className="eyebrow">{isEditor ? 'MANAGE DRIVES' : 'PLACEMENT DRIVES'}</p>
        <h2>{page === 'new' ? 'Create campus drive' : page === 'detail' ? 'Drive details' : 'Manage drives'}</h2>
        <p className="muted">{isEditor ? 'Define official eligibility criteria for this on-campus opportunity.' : 'Create, publish, close, archive, and analyze on-campus placement drives.'}</p>
      </div>
      {!isEditor && <button className="primary-button" onClick={() => onNavigate('/tpo/drives/new')}><Plus size={16} />Create drive</button>}
    </section>
    {isEditor ? <section className="placement-card tpo-job-form">
      <div className="result-header">
        <div><p className="eyebrow">{editingId ? 'EDIT CAMPUS DRIVE' : 'NEW CAMPUS DRIVE'}</p><h3>{editingId ? 'Update drive criteria' : 'Save a draft'}</h3></div>
        <button className="text-button" onClick={() => onNavigate('/tpo/drives')}>Back to drives</button>
      </div>
      {loading && page === 'detail' ? <div className="placement-loading"><LoaderCircle className="spin" size={22} /></div> : <>
        <div className="profile-form-grid">
          <label>Company<input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></label>
          <label>Role<input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label>
          <label>CTC<input value={form.ctc} onChange={(event) => setForm({ ...form, ctc: event.target.value })} /></label>
          <label>CTC in LPA<input type="number" min="0" value={form.ctcLpa ?? ''} onChange={(event) => setForm({ ...form, ctcLpa: event.target.value === '' ? null : Number(event.target.value) })} /></label>
          <label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
          <label>Application deadline<input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label>
          <label>Minimum CGPA<input type="number" min="0" max="10" step="0.01" value={form.minimumCgpa ?? ''} onChange={(event) => setForm({ ...form, minimumCgpa: event.target.value === '' ? null : Number(event.target.value) })} /></label>
          <label>Maximum backlogs<input type="number" min="0" value={form.maximumBacklogs ?? ''} onChange={(event) => setForm({ ...form, maximumBacklogs: event.target.value === '' ? null : Number(event.target.value) })} /></label>
          <label>Employment type<input value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value })} /></label>
          <div><ProfileMultiSelect label="Eligible graduation years" placeholder="Select graduation years" groups={graduationYears} selected={form.graduationYears.map(String)} onChange={(years) => setForm({ ...form, graduationYears: years.map(Number).filter(Number.isInteger) })} selectionLabel="graduation years selected" /></div>
          <div className="profile-full"><ProfileMultiSelect label="Eligible branches" hint="Uses the student profile branch catalog" placeholder="Select branches" groups={branches} selected={form.eligibleBranches} onChange={(eligibleBranches) => setForm({ ...form, eligibleBranches })} selectionLabel="branches selected" /></div>
          <label className="profile-full">Job description<textarea value={form.jobDescription} onChange={(event) => setForm({ ...form, jobDescription: event.target.value, jdAnalysis: form.jdAnalysis && form.jobDescription !== event.target.value ? null : form.jdAnalysis })} /></label>
          <section className="profile-full jd-analysis-panel" aria-live="polite">
            <div className="profile-section-title"><div><p className="eyebrow">JD REQUIREMENT ANALYSIS</p><p className="muted">The job description is the source of role requirements. Review the extracted catalog skills before saving.</p></div><button className="secondary-button" type="button" disabled={analyzingJd || !form.jobDescription.trim()} onClick={() => void analyzeJd()}>{analyzingJd ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{analyzingJd ? 'Analyzing JD…' : form.jdAnalysis ? 'Re-analyze job description' : 'Analyze job description'}</button></div>
            {form.jdAnalysis ? <div className="jd-analysis-content"><ProfileMultiSelect label="JD-derived required skills" hint="Required skills are used for deterministic role fit" placeholder="Select required skills" groups={skills} selected={form.jdAnalysis.requiredSkills} onChange={(values) => updateJdSkills('requiredSkills', values)} /><ProfileMultiSelect label="JD-derived preferred skills" hint="Preferred skills contribute secondary role-fit coverage" placeholder="Select preferred skills" groups={skills} selected={form.jdAnalysis.preferredSkills} onChange={(values) => updateJdSkills('preferredSkills', values)} /><div className="jd-analysis-facts"><div><strong>Tools, technologies & frameworks</strong><div className="analytics-skills">{(() => { const items = [...new Set([...form.jdAnalysis.tools, ...form.jdAnalysis.technologies, ...form.jdAnalysis.frameworks])]; return items.length ? items.map((item) => <span key={item}>{item}</span>) : <small>No additional technical classifications extracted.</small> })()}</div></div><div><strong>Responsibilities</strong>{form.jdAnalysis.responsibilities.length ? <ul>{form.jdAnalysis.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul> : <small>No responsibilities extracted.</small>}</div></div></div> : <p className="jd-analysis-empty">Analyze the job description to create the reviewable requirements used by JD role-fit analytics. Editing the description clears any prior analysis.</p>}
          </section>
          <label className="profile-full">Additional criteria<textarea value={form.additionalCriteria} onChange={(event) => setForm({ ...form, additionalCriteria: event.target.value })} /></label>
        </div>
        <button className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{editingId ? 'Save changes' : 'Save draft'}</button>
      </>}
    </section> : <section className="placement-section">
      <div className="drive-status-tabs">{['ALL', 'DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'].map((status) => <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'ALL' ? 'All drives' : status[0] + status.slice(1).toLowerCase()}</button>)}</div>
      {loading ? <section className="placement-card placement-loading"><LoaderCircle className="spin" size={24} /><p>Loading campus drives...</p></section> : <div className="job-grid">{visibleJobs.length ? visibleJobs.map((job) => <article className="placement-card job-card" key={job.id}>
        <div className="job-card-top"><div><p className="eyebrow">{job.companyName || 'Company not provided'}</p><h3>{job.role || 'Role not provided'}</h3></div><span className="status-badge active">{job.jobStatus}</span></div>
        <div className="job-facts"><span>{job.location || 'Location not provided'}</span><span>{job.ctc || 'Salary not provided'}</span><span>{job.deadline ? new Date(job.deadline).toLocaleDateString('en-IN') : 'Deadline not provided'}</span></div>
        <div className="tpo-job-actions">
          <button className="secondary-button" onClick={() => onNavigate(`/tpo/drives/${job.id}`)}><Edit3 size={15} />View / edit</button>
          <button className="secondary-button" onClick={() => onOpenAnalytics(job.id)}><BarChart3 size={15} />Analytics</button>
          {job.jobStatus !== 'PUBLISHED' && job.jobStatus !== 'ARCHIVED' && <button className="primary-button" onClick={() => void changeStatus(job.id, 'publish')}><Send size={15} />Publish</button>}
          {job.jobStatus === 'PUBLISHED' && <button className="secondary-button" onClick={() => void changeStatus(job.id, 'unpublish')}>Unpublish</button>}
          {job.jobStatus !== 'CLOSED' && job.jobStatus !== 'ARCHIVED' && <button className="secondary-button" onClick={() => void changeStatus(job.id, 'close')}>Close</button>}
          <button className="text-button" onClick={() => void archive(job.id)}><Trash2 size={15} />Archive</button>
        </div>
      </article>) : <section className="placement-card empty-placement"><Plus size={26} /><h3>No drives in this view.</h3><p>Create a campus drive when the TPO receives an opportunity.</p></section>}</div>}
    </section>}
  </section>
}
