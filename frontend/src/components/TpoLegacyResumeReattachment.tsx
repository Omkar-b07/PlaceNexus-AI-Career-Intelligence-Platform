import { useEffect, useMemo, useState } from 'react'
import { Eye, FileCheck2, LoaderCircle, Search, X } from 'lucide-react'
import { ApiRequestError, assignLegacyResume, getLegacyResumeInventory, getLegacyResumePreviewBlob, getTpoStudents } from '../services/api'
import type { LegacyResumeItem, TpoStudent } from '../types/placement'
import '../placement.css'

function formatDate(value: string) { return new Date(value).toLocaleDateString('en-IN') }
function formatFileSize(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export default function TpoLegacyResumeReattachment() {
  const [items, setItems] = useState<LegacyResumeItem[]>([])
  const [students, setStudents] = useState<TpoStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<{ item: LegacyResumeItem; url: string; contentType: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState('')
  const [assigning, setAssigning] = useState<LegacyResumeItem | null>(null)
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [assigningNow, setAssigningNow] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [legacyItems, tpoStudents] = await Promise.all([getLegacyResumeInventory(), getTpoStudents()])
      setItems(legacyItems); setStudents(tpoStudents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load legacy resume records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])

  const selectedStudent = students.find((student) => student.studentId === selectedStudentId) || null
  const visibleStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase()
    if (!query) return students
    return students.filter((student) => `${student.fullName} ${student.branch} ${student.cgpa ?? ''}`.toLowerCase().includes(query))
  }, [studentSearch, students])

  const closeAssignment = () => {
    setAssigning(null); setStudentSearch(''); setSelectedStudentId(''); setReplaceExisting(false)
  }

  const openPreview = async (item: LegacyResumeItem) => {
    setPreviewLoading(item.legacyResumeId); setError('')
    try {
      const { blob, contentType } = await getLegacyResumePreviewBlob(item.legacyResumeId)
      setPreview({ item, url: URL.createObjectURL(blob), contentType })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the secure resume preview.')
    } finally {
      setPreviewLoading('')
    }
  }

  const beginAssignment = (item: LegacyResumeItem) => {
    setError(''); setNotice(''); setAssigning(item); setSelectedStudentId(''); setStudentSearch(''); setReplaceExisting(false)
  }

  const confirmAssignment = async () => {
    if (!assigning || !selectedStudent) return
    if (selectedStudent.resume && !replaceExisting) {
      setError('This student already has a resume. Select “Replace existing resume” to continue.')
      return
    }
    setAssigningNow(true); setError('')
    try {
      const result = await assignLegacyResume(assigning.legacyResumeId, {
        studentId: selectedStudent.studentId,
        replaceExisting: Boolean(selectedStudent.resume && replaceExisting),
        confirmed: true
      })
      setNotice(`Resume assigned to ${selectedStudent.fullName || selectedStudent.studentId}. Analysis status: ${result.analysisStatus.toLowerCase()}.`)
      closeAssignment()
      await load()
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'STUDENT_RESUME_EXISTS') setReplaceExisting(true)
      setError(err instanceof Error ? err.message : 'Unable to assign this legacy resume.')
    } finally {
      setAssigningNow(false)
    }
  }

  return <section className="placement-workspace tpo-workspace legacy-resume-workspace">
    <section className="placement-header">
      <div><p className="eyebrow">LEGACY RESUME REATTACHMENT</p><h2>Manual resume recovery</h2><p className="muted">Preview each secured stored file, verify it manually, then explicitly assign it to the correct student. Nothing is matched automatically.</p></div>
      <div className="legacy-resume-count"><FileCheck2 size={18} /><strong>{items.length}</strong><span>unlinked resumes</span></div>
    </section>
    {error && <div className="error-banner">{error}</div>}
    {notice && <div className="placement-notice"><span>{notice}</span><button type="button" aria-label="Dismiss confirmation" onClick={() => setNotice('')}><X size={14} /></button></div>}
    <section className="placement-card legacy-resume-card">
      <div className="result-header"><div><p className="eyebrow">SECURED INVENTORY</p><h3>Unlinked stored resumes</h3></div><button type="button" className="text-button" onClick={() => void load()}>Refresh</button></div>
      <p className="tpo-data-note">The inventory provides file metadata only. A resume is never linked until a TPO/admin previews it and confirms the target student.</p>
      {loading ? <div className="placement-loading"><LoaderCircle className="spin" size={22} /><p>Loading legacy files…</p></div> : items.length ? <div className="tpo-table-wrap"><table className="tpo-table legacy-resume-table"><thead><tr><th>File reference</th><th>Type</th><th>Size</th><th>Stored date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.legacyResumeId}><td><strong>{item.originalName || item.legacyResumeId}</strong><small>{item.originalName ? item.legacyResumeId : 'Generated storage reference'}</small></td><td>{item.fileType}</td><td>{formatFileSize(item.size)}</td><td>{formatDate(item.modifiedAt)}</td><td><span className="status-badge active">{item.status}</span></td><td><div className="legacy-resume-actions"><button type="button" className="secondary-button" disabled={previewLoading === item.legacyResumeId} onClick={() => void openPreview(item)}><Eye size={14} />{previewLoading === item.legacyResumeId ? 'Opening…' : 'Preview'}</button><button type="button" className="primary-button" onClick={() => beginAssignment(item)}>Assign to student</button></div></td></tr>)}</tbody></table></div> : <p className="muted">No unlinked legacy resumes are available.</p>}
    </section>

    {preview && <div className="legacy-resume-modal-backdrop" role="presentation"><section className="legacy-resume-modal preview-modal" role="dialog" aria-modal="true" aria-labelledby="legacy-preview-title"><div className="result-header"><div><p className="eyebrow">AUTHORIZED PREVIEW</p><h3 id="legacy-preview-title">{preview.item.originalName || preview.item.legacyResumeId}</h3></div><button type="button" className="text-button" onClick={() => setPreview(null)}><X size={16} />Close</button></div>{preview.contentType === 'application/pdf' || preview.contentType.startsWith('image/') ? <iframe className="legacy-resume-preview" title="Authorized legacy resume preview" src={preview.url} /> : <div className="legacy-resume-download"><p>This format is available through the authenticated preview only.</p><a className="secondary-button" href={preview.url} download={preview.item.legacyResumeId}>Download for review</a></div>}</section></div>}

    {assigning && <div className="legacy-resume-modal-backdrop" role="presentation"><section className="legacy-resume-modal" role="dialog" aria-modal="true" aria-labelledby="legacy-assignment-title"><div className="result-header"><div><p className="eyebrow">MANUAL ASSIGNMENT</p><h3 id="legacy-assignment-title">Assign selected resume</h3></div><button type="button" className="text-button" onClick={closeAssignment} disabled={assigningNow}><X size={16} />Cancel</button></div><p className="muted">Selected file: <b>{assigning.originalName || assigning.legacyResumeId}</b>. Verify the preview before selecting a student.</p><label className="legacy-student-search"><span><Search size={14} />Search student</span><input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Name, branch, or CGPA" autoFocus /></label><div className="legacy-student-results" role="listbox" aria-label="Students available for resume assignment">{visibleStudents.map((student) => <button type="button" role="option" aria-selected={student.studentId === selectedStudentId} className={student.studentId === selectedStudentId ? 'selected' : ''} key={student.studentId} onClick={() => { setSelectedStudentId(student.studentId); setReplaceExisting(false) }}><strong>{student.fullName || student.studentId}</strong><span>{student.branch || 'Branch not provided'} · CGPA {student.cgpa ?? 'Not provided'}</span>{student.resume && <small>Existing resume on profile</small>}</button>)}{!visibleStudents.length && <p className="muted">No students match this search.</p>}</div>{selectedStudent && <div className="legacy-assignment-confirmation"><strong>Assign this resume to {selectedStudent.fullName || selectedStudent.studentId}?</strong>{selectedStudent.resume ? <label><input type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} />Replace existing resume</label> : <p className="muted">This student has no current resume record.</p>}<small>This creates the normal student profile resume record and starts secure parsing/analysis. It does not use profile skills.</small></div>}<div className="legacy-modal-actions"><button type="button" className="secondary-button" onClick={closeAssignment} disabled={assigningNow}>Cancel</button><button type="button" className="primary-button" disabled={!selectedStudent || assigningNow || Boolean(selectedStudent?.resume && !replaceExisting)} onClick={() => void confirmAssignment()}>{assigningNow ? 'Assigning…' : selectedStudent?.resume ? 'Replace existing resume' : 'Confirm assignment'}</button></div></section></div>}
  </section>
}
