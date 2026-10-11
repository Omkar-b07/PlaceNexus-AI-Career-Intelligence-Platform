import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { FormEvent, useId, useRef, useState } from 'react'
import GoogleSignInButton from '../components/GoogleSignInButton'
import '../landing.css'
import { validateLogin, validateRegistration, type LoginFieldErrors } from '../utils/validation'

type LoginPageProps = {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string) => Promise<void>
  onGoogleLogin: (credential: string) => Promise<void>
  tpoOnly?: boolean
  onOpenTpoLogin?: () => void
  onOpenStudentLogin?: () => void
}

type Mode = 'login' | 'register'

const placementFeatures = [
  ['ON-CAMPUS HIRING', 'Discover opportunities published by your college TPO.'],
  ['OFF-CAMPUS HIRING', 'Explore external opportunities from live job sources.'],
  ['SMART ELIGIBILITY', 'Check your branch, CGPA, backlogs, graduation year, and skills.'],
  ['APPLICATION TRACKING', 'Track each placement application from application to outcome.'],
  ['CAREER INTELLIGENCE', 'Analyze role fit and identify the skills you need next.'],
  ['PERSONALIZED PREPARATION', 'Build a focused Quick Roadmap for your skill gaps.']
] as const

const placementFlow = ['Profile', 'Discover', 'Check eligibility', 'Apply', 'Track', 'Prepare']

export default function Login({ onLogin, onRegister, onGoogleLogin, tpoOnly = false, onOpenTpoLogin, onOpenStudentLogin }: LoginPageProps) {
  const emailId = useId()
  const passwordId = useId()
  const confirmPasswordId = useId()
  const formRef = useRef<HTMLElement>(null)
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<LoginFieldErrors>({})
  const [state, setState] = useState<'idle' | 'loading'>('idle')
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')

  const isRegistration = !tpoOnly && mode === 'register'
  const chooseMode = (nextMode: Mode, focusForm = true) => {
    if (tpoOnly && nextMode === 'register') return
    setMode(nextMode)
    setErrors({})
    setFormError('')
    setNotice('')
    if (focusForm) window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')
    setFormError('')
    const nextErrors = isRegistration
      ? validateRegistration(email, password, confirmPassword)
      : validateLogin(email, password)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setState('loading')
    try {
      if (isRegistration) await onRegister(email.trim(), password)
      else await onLogin(email.trim(), password)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to complete that request.')
    } finally {
      setState('idle')
    }
  }

  return <main className="login-shell">
    <div className="login-grid placement-landing-grid">
      <section className="login-intro placement-landing" aria-labelledby="login-product-heading">
        <header className="landing-header">
          <div className="login-brand">
            <span className="brand-mark" aria-label="PlaceX"><span className="brand-mark-p">P</span><span className="brand-mark-n">X</span></span>
            <span>PlaceX</span>
          </div>
          <div className="landing-header-actions"><button type="button" className="landing-login-link" onClick={tpoOnly ? onOpenStudentLogin : () => chooseMode('login')}>{tpoOnly ? 'Student login' : 'Log in'}</button>{!tpoOnly && <button type="button" className="landing-header-cta" onClick={() => chooseMode('register')}>Get started</button>}</div>
        </header>

        <div className="login-intro-copy placement-landing-copy">
          <p className="eyebrow">CAREER INTELLIGENCE, MADE PERSONAL</p>
          <h1 id="login-product-heading">Your placement journey, <em>organized.</em></h1>
          <p>Discover on-campus and off-campus opportunities, check your eligibility, track applications, and prepare for your next career move.</p>
          <div className="landing-hero-actions">{tpoOnly ? <button type="button" className="landing-primary-cta" onClick={onOpenStudentLogin}>Student login <ArrowRight size={16} /></button> : <button type="button" className="landing-primary-cta" onClick={() => chooseMode('register')}>Get started <ArrowRight size={16} /></button>}<button type="button" className="landing-secondary-cta" onClick={() => document.getElementById('platform-overview')?.scrollIntoView({ behavior: 'smooth' })}>Explore platform</button></div>

          <section className="landing-section landing-overview" id="platform-overview" aria-labelledby="platform-overview-heading">
            <p className="eyebrow">PLACEMENT PLATFORM OVERVIEW</p>
            <h2 id="platform-overview-heading">Everything around the opportunity—not just the resume.</h2>
            <div className="landing-feature-grid">{placementFeatures.map(([title, description]) => <article key={title}><span>{title}</span><p>{description}</p></article>)}</div>
          </section>

          <section className="landing-section landing-flow" aria-labelledby="placement-flow-heading">
            <p className="eyebrow">HOW IT WORKS</p>
            <h2 id="placement-flow-heading">A clearer route from profile to preparation.</h2>
            <ol>{placementFlow.map((step, index) => <li key={step}><b>0{index + 1}</b><span>{step}</span></li>)}</ol>
          </section>

          <section className="landing-section hiring-channels" aria-labelledby="hiring-channels-heading">
            <p className="eyebrow">TWO HIRING CHANNELS</p>
            <h2 id="hiring-channels-heading">One placement workspace, distinct workflows.</h2>
            <div className="landing-channel-grid"><article><span>ON-CAMPUS</span><h3>TPO-published opportunities from your college.</h3><p>TPO → Publish drive → Student eligibility → Apply → Application tracking</p></article><article><span>OFF-CAMPUS</span><h3>External opportunities from job sources.</h3><p>Job source → Opportunity → Skill and eligibility match → Apply on company site → Tracking</p></article></div>
          </section>

          <section className="landing-section landing-audience" aria-label="PlaceX audiences">
            <article><p className="eyebrow">FOR STUDENTS</p><h2>Stay on top of every placement opportunity.</h2><ul><li>Complete a placement profile</li><li>Discover eligible campus and external jobs</li><li>Track applications and prepare for interviews</li></ul></article><article><p className="eyebrow">FOR TPOs</p><h2>Manage campus hiring from one place.</h2><ul><li>Publish placement drives</li><li>Define official eligibility criteria</li><li>View applications and manage their stages</li></ul></article></section>

          <section className="landing-section landing-intelligence" aria-labelledby="career-intelligence-heading">
            <p className="eyebrow">CAREER INTELLIGENCE</p>
            <h2 id="career-intelligence-heading">Analyze your fit when you are ready to go deeper.</h2>
            <p>Resume analysis, what-if simulations, a Quick Roadmap, and saved analyses help you prepare around a target role.</p>
          </section>

          <section className="landing-final-cta"><p>Build a more organized placement journey.</p>{tpoOnly ? <button type="button" className="landing-primary-cta" onClick={onOpenStudentLogin}>Student login <ArrowRight size={16} /></button> : <button type="button" className="landing-primary-cta" onClick={() => chooseMode('register')}>Get started <ArrowRight size={16} /></button>}</section>
        </div>
      </section>

      <section className="login-form-area" ref={formRef} aria-labelledby="login-heading">
        <div className="login-card">
          <p className="eyebrow">{tpoOnly ? 'TPO / ADMIN ACCESS' : 'PLACEX ACCOUNT'}</p>
          <h2 id="login-heading">{tpoOnly ? 'TPO / Admin sign in' : isRegistration ? 'Start your placement journey' : 'Welcome back'}</h2>
          <p className="login-lede">{tpoOnly ? 'Use your existing PlaceX account. Access is confirmed from your server-managed role after authentication.' : isRegistration ? 'Create an account to organize opportunities, eligibility, applications, and preparation in one place.' : 'Sign in to return to your placement workspace.'}</p>

          <form noValidate onSubmit={handleSubmit}>
            <div className="login-field"><label htmlFor={emailId}>Email</label><input id={emailId} name="email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined })) }} autoComplete="email" inputMode="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${emailId}-error` : undefined} />{errors.email && <p id={`${emailId}-error`} className="field-error" role="alert">{errors.email}</p>}</div>
            <div className="login-field"><div className="label-row"><label htmlFor={passwordId}>Password</label>{!isRegistration && <button type="button" className="forgot-link" onClick={() => setNotice('Password recovery will be available soon.')}>Forgot password?</button>}</div><div className="password-input"><input id={passwordId} name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })) }} autoComplete={isRegistration ? 'new-password' : 'current-password'} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? `${passwordId}-error` : undefined} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <p id={`${passwordId}-error`} className="field-error" role="alert">{errors.password}</p>}</div>
            {isRegistration && <div className="login-field"><label htmlFor={confirmPasswordId}>Confirm password</label><input id={confirmPasswordId} name="confirmPassword" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setErrors((current) => ({ ...current, confirmPassword: undefined })) }} autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? `${confirmPasswordId}-error` : undefined} />{errors.confirmPassword && <p id={`${confirmPasswordId}-error`} className="field-error" role="alert">{errors.confirmPassword}</p>}</div>}
            {formError && <p className="field-error" role="alert">{formError}</p>}
            <button className="login-submit" type="submit" disabled={state === 'loading'}>{state === 'loading' ? <><LoaderCircle className="spin" size={17} /> {isRegistration ? 'Creating account…' : 'Signing in…'}</> : <>{isRegistration ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></>}</button>
          </form>

          <div className="login-divider"><span>or</span></div>
          <GoogleSignInButton disabled={state === 'loading'} onCredential={onGoogleLogin} />
          {notice && <p id="login-notice" className="login-notice" role="status">{notice}</p>}
          {tpoOnly
            ? <p className="signup-copy">Need the student workspace? <button type="button" onClick={onOpenStudentLogin}>Student login</button></p>
            : <><p className="signup-copy">{isRegistration ? 'Already have an account?' : 'New to PlaceX?'} <button type="button" onClick={() => chooseMode(isRegistration ? 'login' : 'register', false)}>{isRegistration ? 'Sign in' : 'Create account'}</button></p><button type="button" className="tpo-login-link" onClick={onOpenTpoLogin}>TPO / Admin Login</button></>}
        </div>
      </section>
    </div>
  </main>
}
