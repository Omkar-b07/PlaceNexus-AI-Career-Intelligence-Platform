import { ArrowRight, Camera, Check, Code2, ExternalLink, FileText, Globe2, LoaderCircle, Trash2, UploadCloud, UserRound, X } from 'lucide-react'
import { useRef } from 'react'
import profileCatalog from '../../../shared/profileCatalog.json'
import { profilePhotoUrl } from '../services/api'
import ProfileMultiSelect, { type MultiSelectGroup } from './ProfileMultiSelect'
import type { ProfileCompletion, StudentProfile, StudentProject, StudentSocialLinks } from '../types/placement'

type ProfileEditorProps = {
  profile: StudentProfile
  completion: ProfileCompletion
  saving: boolean
  uploadingResume: boolean
  uploadingPhoto: boolean
  onChange: (profile: StudentProfile) => void
  onSave: () => void
  onUploadResume: (file?: File) => Promise<void>
  onUploadPhoto: (file?: File) => Promise<void>
  onRemovePhoto: () => Promise<void>
  onNavigate: (destination: 'analyze' | 'simulator' | 'plan' | 'history') => void
}

const skillGroups: MultiSelectGroup[] = profileCatalog.skillCategories.map((category) => ({ name: category.name, options: category.skills }))
const branchValues = new Set(profileCatalog.branchOptions.map(({ value }) => value))
const roleGroups: MultiSelectGroup[] = [{ name: 'Placement roles', options: profileCatalog.roleOptions }]
const locationGroups: MultiSelectGroup[] = [{ name: 'Popular locations', options: profileCatalog.locationOptions }]
const emptyProject = (): StudentProject => ({ title: '', description: '', technologies: [], githubUrl: '', liveUrl: '', startDate: '', endDate: '' })
const emptySocialLinks: StudentSocialLinks = { github: '', linkedin: '', portfolio: '', leetcode: '' }

const socialFields = [
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/...', Icon: Code2 },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/...', Icon: ExternalLink },
  { key: 'portfolio', label: 'Portfolio', placeholder: 'https://...', Icon: Globe2 },
  { key: 'leetcode', label: 'LeetCode', placeholder: 'https://leetcode.com/u/...', Icon: Code2 }
] as const

function initials(name: string) {
  const value = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return value || null
}

function safeExternalUrl(value: string) {
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname ? parsed.toString() : null
  } catch { return null }
}

function linkLabel(value: string) {
  try {
    const parsed = new URL(value)
    return `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`
  } catch { return value }
}

export default function ProfileEditor({ profile, completion, saving, uploadingResume, uploadingPhoto, onChange, onSave, onUploadResume, onUploadPhoto, onRemovePhoto, onNavigate }: ProfileEditorProps) {
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const legacySkills = profile.legacySkills || []
  const missingFields = completion.missingFields || []
  const socialLinks = profile.socialLinks || emptySocialLinks
  const branchGroups: MultiSelectGroup[] = [{ name: 'Branches', options: profile.branch && !branchValues.has(profile.branch) ? [...profileCatalog.branchOptions, { label: profile.branch, value: profile.branch }] : profileCatalog.branchOptions }]
  const photoSource = profilePhotoUrl(profile.profilePhotoUrl)
  const savedSocialLinks = socialFields.flatMap((field) => {
    const url = safeExternalUrl(socialLinks[field.key])
    return url ? [{ ...field, url }] : []
  })
  const updateProject = (index: number, changes: Partial<StudentProject>) => onChange({ ...profile, projects: profile.projects.map((project, projectIndex) => projectIndex === index ? { ...project, ...changes } : project) })
  const updateSocialLink = (key: keyof StudentSocialLinks, value: string) => onChange({ ...profile, socialLinks: { ...socialLinks, [key]: value } })

  return <section className="placement-card profile-editor">
    <div className="profile-header-row">
      <div className="profile-photo-panel">
        <div className="profile-avatar">{photoSource ? <img src={photoSource} alt={profile.fullName ? `${profile.fullName}'s profile` : 'Profile'} /> : initials(profile.fullName) ? <span>{initials(profile.fullName)}</span> : <UserRound size={30} />}</div>
        <input ref={photoInputRef} hidden type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => { void onUploadPhoto(event.target.files?.[0]); event.currentTarget.value = '' }} />
        <div className="profile-photo-actions"><button className="secondary-button" type="button" disabled={uploadingPhoto} onClick={() => photoInputRef.current?.click()}>{uploadingPhoto ? <LoaderCircle className="spin" size={15} /> : <Camera size={15} />}{photoSource ? 'Replace photo' : 'Upload photo'}</button>{photoSource && <button className="text-button remove-photo" type="button" disabled={uploadingPhoto} onClick={() => void onRemovePhoto()}><Trash2 size={14} />Remove photo</button>}</div>
      </div>
      <div className="profile-header-copy"><p className="eyebrow">STUDENT PROFILE</p><h2>Placement profile</h2><p className="muted">Your saved profile is the source of truth for placement eligibility and recommendations.</p></div>
      <div className="completion-number">{completion.percentage}%</div>
    </div>
    <div className="completion-track"><i style={{ width: `${completion.percentage}%` }} /></div>
    {completion.missingMandatory.length > 0 ? <p className="placement-warning">Still needed for placement: {completion.missingMandatory.join(', ')}.</p> : missingFields.length > 0 && <p className="profile-completion-note">To reach 100%, add: {missingFields.join(', ')}.</p>}
    {legacySkills.length > 0 && <div className="profile-migration-warning"><X size={16} /><span>These legacy skill values could not be safely split: <b>{legacySkills.join(', ')}</b>. Select the correct skills below, then save your profile.</span></div>}

    <div className="profile-form-section"><p className="eyebrow">PERSONAL INFORMATION</p><div className="profile-form-grid"><label>Full name<input value={profile.fullName} onChange={(event) => onChange({ ...profile, fullName: event.target.value })} /></label><label>Email<input value={profile.email} readOnly /></label><label className="profile-full">Phone number<input value={profile.phone} onChange={(event) => onChange({ ...profile, phone: event.target.value })} placeholder="+91 9876543210" /></label></div></div>
    <div className="profile-form-section"><p className="eyebrow">ACADEMIC INFORMATION</p><div className="profile-form-grid"><ProfileMultiSelect label="Branch / department" placeholder="Search branches..." groups={branchGroups} selected={profile.branch ? [profile.branch] : []} onChange={([branch]) => onChange({ ...profile, branch: branch || '' })} singleSelect /><label>College<input value={profile.college} onChange={(event) => onChange({ ...profile, college: event.target.value })} /></label><label>CGPA<input type="number" min="0" max="10" step="0.01" value={profile.cgpa ?? ''} onChange={(event) => onChange({ ...profile, cgpa: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Backlogs<input type="number" min="0" max="50" value={profile.backlogs ?? ''} onChange={(event) => onChange({ ...profile, backlogs: event.target.value === '' ? null : Number(event.target.value) })} /></label><label className="profile-full">Graduation year<input type="number" min="2020" max="2045" value={profile.graduationYear ?? ''} onChange={(event) => onChange({ ...profile, graduationYear: event.target.value === '' ? null : Number(event.target.value) })} /></label></div></div>
    <div className="profile-form-section"><p className="eyebrow">TECHNICAL SKILLS</p><ProfileMultiSelect label="Select the skills you can demonstrate" hint="Search the categorized catalog and select multiple skills" placeholder="Search technical skills" groups={skillGroups} selected={profile.skills} onChange={(skills) => onChange({ ...profile, skills })} /></div>
    <div className="profile-form-section"><div className="profile-section-title"><div><p className="eyebrow">PROJECTS</p><p className="muted">Add structured projects to strengthen your placement profile.</p></div>{profile.projects.length < 10 && <button className="text-button" type="button" onClick={() => onChange({ ...profile, projects: [...profile.projects, emptyProject()] })}>Add project</button>}</div>{profile.projects.length ? <div className="project-editor-list">{profile.projects.map((project, index) => <article className="project-editor" key={`${project.title}-${index}`}><div className="project-editor-heading"><strong>Project {index + 1}</strong><button className="text-button remove-project" type="button" onClick={() => onChange({ ...profile, projects: profile.projects.filter((_, projectIndex) => projectIndex !== index) })}>Remove</button></div><div className="project-editor-grid"><label>Project name<input value={project.title || ''} onChange={(event) => updateProject(index, { title: event.target.value })} placeholder="PublicEye" /></label><label>GitHub URL<input value={project.githubUrl || ''} onChange={(event) => updateProject(index, { githubUrl: event.target.value })} placeholder="https://github.com/..." /></label><label>Live URL<input value={project.liveUrl || ''} onChange={(event) => updateProject(index, { liveUrl: event.target.value })} placeholder="https://..." /></label><label>Start date<input type="month" value={project.startDate || ''} onChange={(event) => updateProject(index, { startDate: event.target.value })} /></label><label>End date<input type="month" value={project.endDate || ''} onChange={(event) => updateProject(index, { endDate: event.target.value })} /></label><label className="profile-full">Description<textarea value={project.description || ''} onChange={(event) => updateProject(index, { description: event.target.value })} placeholder="What did you build and what problem did it solve?" /></label><div className="profile-full"><ProfileMultiSelect label="Technologies used" placeholder="Search project technologies" groups={skillGroups} selected={project.technologies || []} onChange={(technologies) => updateProject(index, { technologies })} /></div></div></article>)}</div> : <p className="muted">Add at least one project to show practical experience.</p>}</div>
    <div className="profile-form-section"><p className="eyebrow">CAREER PREFERENCES</p><div className="profile-preference-grid"><ProfileMultiSelect label="Preferred job roles" placeholder="Search placement roles" groups={roleGroups} selected={profile.preferredRoles} onChange={(preferredRoles) => onChange({ ...profile, preferredRoles })} /><ProfileMultiSelect label="Preferred locations" placeholder="Search locations" groups={locationGroups} selected={profile.preferredLocations} onChange={(preferredLocations) => onChange({ ...profile, preferredLocations })} allowCustom /></div></div>
    <div className="profile-form-section social-links-section"><div className="profile-section-title"><div><p className="eyebrow">SOCIAL LINKS</p><p className="muted">Add professional links you want employers to see.</p></div></div><div className="profile-form-grid social-link-grid">{socialFields.map(({ key, label, placeholder, Icon }) => <label key={key}><span className="social-link-label"><Icon size={14} />{label}</span><input type="url" value={socialLinks[key]} onChange={(event) => updateSocialLink(key, event.target.value)} placeholder={placeholder} inputMode="url" /></label>)}</div>{savedSocialLinks.length ? <div className="saved-social-links">{savedSocialLinks.map(({ key, label, Icon, url }) => <a href={url} target="_blank" rel="noopener noreferrer" key={key}><Icon size={15} /><span><b>{label}</b><small>{linkLabel(url)}</small></span><ExternalLink size={14} /></a>)}</div> : <p className="muted social-links-empty">No social links added yet.</p>}</div>
    <div className="resume-save-row"><div className="profile-form-section resume-section"><p className="eyebrow">RESUME</p><div className="resume-profile-row"><FileText size={18} /><span>{profile.resume?.originalName ? `Current resume: ${profile.resume.originalName}` : 'No resume attached to your placement profile.'}</span></div><input ref={resumeInputRef} hidden type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => { void onUploadResume(event.target.files?.[0]); event.currentTarget.value = '' }} /><div className="profile-actions"><button className="secondary-button" type="button" disabled={uploadingResume} onClick={() => resumeInputRef.current?.click()}>{uploadingResume ? <LoaderCircle className="spin" size={16} /> : <UploadCloud size={16} />}{profile.resume ? 'Replace resume' : 'Upload resume'}</button><button className="text-button" type="button" onClick={() => onNavigate('analyze')}>Analyze this resume <ArrowRight size={14} /></button></div></div>
      <button className="primary-button" disabled={saving} onClick={onSave}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? 'Saving profile...' : 'Save profile'}</button>
    </div>
  </section>
}
