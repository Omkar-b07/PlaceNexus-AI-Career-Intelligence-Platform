import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  LogOut,
  Menu,
  Sparkles,
  Target,
  UploadCloud,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import {
  analyzeResume,
  getCareerHistory,
  getCareerHistoryItem,
  getInstantSkillPlan,
  simulateCareer,
  uploadResume,
} from "../services/api";
import PlacementManagement, {
  type PlacementSection,
} from "../components/PlacementManagement";
import TpoDriveManagement from "../components/TpoDriveManagement";
import DsaPreparation from "../components/DsaPreparation";
import TpoWorkspace from "../components/TpoWorkspace";
import type {
  CareerAnalysis,
  CareerHistorySummary,
  InstantPlanDurationHours,
  InstantSkillPlan,
  ResumeData,
} from "../types/career";

type View =
  | "placement"
  | "profile"
  | "jobs"
  | "applications"
  | "notifications"
  | "manageJobs"
  | "analyze"
  | "simulator"
  | "plan"
  | "dsa"
  | "interviewPrep"
  | "aptitudePrep"
  | "history";

const viewPaths: Record<View, string> = {
  placement: "/placement-hub",
  profile: "/profile",
  jobs: "/jobs",
  applications: "/applications",
  notifications: "/notifications",
  manageJobs: "/tpo/jobs",
  analyze: "/analyze-fit",
  simulator: "/what-if-simulator",
  plan: "/quick-roadmap",
  dsa: "/dsa-preparation",
  interviewPrep: "/interview-prep",
  aptitudePrep: "/aptitude-prep",
  history: "/saved-analyses",
};

function viewFromPath(): View {
  if (window.location.pathname === "/30-day-plan") return "plan";
  const match = (Object.entries(viewPaths) as [View, string][]).find(
    ([, path]) => path === window.location.pathname,
  );
  return match?.[0] || "placement";
}

function placementSectionFor(view: View): PlacementSection | null {
  if (view === "placement") return "overview";
  if (
    view === "profile" ||
    view === "jobs" ||
    view === "applications" ||
    view === "notifications"
  )
    return view;
  return null;
}

function viewForPlacementSection(section: PlacementSection): View {
  return section === "overview" ? "placement" : section;
}

function Score({
  value,
  label = "Overall profile match",
}: {
  value: number;
  label?: string;
}) {
  return (
    <div className="score-card">
      <div
        className="score-ring"
        style={{ "--score": `${value * 3.6}deg` } as React.CSSProperties}
      >
        <strong>{value}%</strong>
      </div>
      <div>
        <p className="eyebrow">{label}</p>
        <p className="score-caption">
          {value >= 80
            ? "Strong fit for this role"
            : value >= 60
              ? "Promising, with clear gaps"
              : "Build a stronger match"}
        </p>
      </div>
    </div>
  );
}

function SkillList({
  title,
  skills,
  tone,
}: {
  title: string;
  skills: string[];
  tone: "good" | "gap";
}) {
  return (
    <section className="skill-panel">
      <div className="section-heading">
        <h3>{title}</h3>
        <span className={`count ${tone}`}>{skills.length}</span>
      </div>
      {skills.length ? (
        <div className="skill-list">
          {skills.map((skill) => (
            <span className={`skill-pill ${tone}`} key={skill}>
              {tone === "good" ? <Check size={13} /> : <X size={13} />}
              {skill}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">None identified.</p>
      )}
    </section>
  );
}

function BrandIdentity() {
  return (
    <>
      <span className="brand-mark" aria-label="PlaceX">
        <span className="brand-mark-p">P</span>
        <span className="brand-mark-n">X</span>
      </span>
      <span>
        <span className="brand-name">
          PlaceX
        </span>
        <span className="brand-subtitle">
          Career intelligence, made personal
        </span>
      </span>
    </>
  );
}

function StudentDashboard({
  isAuthenticated = false,
  studentEmail,
  userRole = "STUDENT",
  onOpenLogin,
  onLogout,
}: {
  isAuthenticated?: boolean;
  studentEmail?: string;
  userRole?: "STUDENT" | "TPO" | "ADMIN";
  onOpenLogin?: () => void;
  onLogout?: () => void;
}) {
  const [view, setView] = useState<View>(viewFromPath);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [description, setDescription] = useState("");
  const [analysis, setAnalysis] = useState<CareerAnalysis | null>(null);
  const [history, setHistory] = useState<CareerHistorySummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [simulation, setSimulation] = useState<{
    readinessScore: number;
    scoreChange: number;
    reason: string;
  } | null>(null);
  const [addedSkill, setAddedSkill] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [instantPlan, setInstantPlan] = useState<InstantSkillPlan | null>(null);
  const [instantDuration, setInstantDuration] =
    useState<InstantPlanDurationHours>(12);
  const [instantLoading, setInstantLoading] = useState(false);
  const [selectedPlanSourceId, setSelectedPlanSourceId] =
    useState<string>("auto");
  const inputRef = useRef<HTMLInputElement>(null);
  const previousDescription = useRef(description);

  const navigateTo = (nextView: View, replace = false) => {
    const path = viewPaths[nextView];
    if (window.location.pathname !== path)
      window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    setView(nextView);
  };

  const loadInstantPlan = async (
    duration: InstantPlanDurationHours = instantDuration,
    sourceId: string = selectedPlanSourceId,
  ) => {
    setInstantLoading(true);
    setError("");
    try {
      const activeAnalysisId =
        sourceId === "profile"
          ? undefined
          : sourceId !== "auto"
            ? sourceId
            : analysis?.historyId;
      const plan = await getInstantSkillPlan(duration, activeAnalysisId);
      setInstantPlan(plan);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load quick roadmap.",
      );
    } finally {
      setInstantLoading(false);
    }
  };

  useEffect(() => {
    if (view === "plan") {
      void loadInstantPlan(instantDuration, selectedPlanSourceId);
    }
  }, [view, analysis?.historyId]);


  useEffect(() => {
    const handlePopState = () => setView(viewFromPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (previousDescription.current === description) return;
    previousDescription.current = description;
    setAnalysis(null);
    setSimulation(null);
    setAddedSkill("");
  }, [description]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      setHistory(await getCareerHistory());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load saved analyses.",
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);

  const handleUpload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setResume(null);
    setAnalysis(null);
    setSimulation(null);
    setAddedSkill("");
    try {
      setResume((await uploadResume(file)).resume);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to read that resume.",
      );
    } finally {
      setBusy(false);
    }
  };
  const handleAnalyze = async () => {
    if (!resume) return setError("Upload a resume before analyzing a role.");
    if (description.trim().length < 30)
      return setError("Paste a job description with at least 30 characters.");
    setBusy(true);
    setError("");
    setAnalysis(null);
    setSimulation(null);
    setAddedSkill("");
    try {
      setAnalysis(await analyzeResume(resume, description));
      navigateTo("analyze");
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };
  const handleSimulation = async () => {
    if (!analysis || !resume || !addedSkill.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await simulateCareer(resume.resumeText, description, [
        addedSkill.trim(),
      ]);
      setSimulation({
        readinessScore: result.readinessScore,
        scoreChange: result.scoreChange,
        reason: analysis.missingSkills.includes(addedSkill.trim())
          ? `${addedSkill.trim()} satisfies a currently missing job requirement, so the same scoring model includes its weighted contribution.`
          : `${addedSkill.trim()} is already evidenced by the resume, so strengthening it does not invent a score increase without new resume evidence.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setBusy(false);
    }
  };

  const openHistoryItem = async (historyId: string) => {
    setBusy(true);
    setError("");
    try {
      const saved = await getCareerHistoryItem(historyId);
      previousDescription.current = saved.jobDescription;
      setResume(saved.resume);
      setDescription(saved.jobDescription);
      setAnalysis(saved.analysis);
      setSimulation(null);
      setAddedSkill("");
      navigateTo("analyze");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open that saved analysis.",
      );
    } finally {
      setBusy(false);
    }
  };

  const navItems: [View, string][] = [
    ["placement", "Placement Hub"],
    ["jobs", "Jobs"],
    ["applications", "Applications"],
    ...(userRole === "TPO" || userRole === "ADMIN"
      ? [["manageJobs", "TPO Jobs"] as [View, string]]
      : []),
    ["analyze", "Analyze Fit"],
    ["simulator", "What-if Simulator"],
    ["plan", "Quick Roadmap"],
    ["dsa", "DSA Preparation"],
    ["interviewPrep", "Interview Prep"],
    ["aptitudePrep", "Aptitude Prep"],
    ["history", "Saved Analyses"],
  ];

  const currentPlacementSection = placementSectionFor(view);
  const navigateFromSidebar = (nextView: View) => {
    navigateTo(nextView);
    setSidebarOpen(false);
  };
  const isPrimaryViewActive = (key: View) =>
    view === key || (key === "placement" && view === "notifications");

  return (
    <div className="app-shell">
      <div className="app-frame">
        <aside
          className={`sidebar ${sidebarOpen ? "open" : ""}`}
          id="student-navigation"
        >
          <div className="sidebar-brand">
            <BrandIdentity />
          </div>
          <nav className="sidebar-nav" aria-label="Student workspace">
            {navItems.map(([key, label]) => (
              <button
                className={isPrimaryViewActive(key) ? "active" : ""}
                key={key}
                onClick={() => navigateFromSidebar(key)}
              >
                <span>{label}</span>
                {key === "plan" && (analysis || instantPlan) ? (
                  <span className="tab-dot" aria-label="Quick Roadmap available" />
                ) : null}
              </button>
            ))}
          </nav>
          <div className="sidebar-actions">
            <button
              className={`sidebar-profile ${view === "profile" ? "active" : ""}`}
              type="button"
              onClick={() => navigateFromSidebar("profile")}
            >
              <UserRound size={16} />
              Profile
            </button>
            <p className="sidebar-user">
              <span className="status-dot" />
              {studentEmail || "Student workspace"}
            </p>
            {isAuthenticated && onLogout ? (
              <button
                className="sidebar-logout"
                type="button"
                onClick={onLogout}
              >
                <LogOut size={16} />
                Log out
              </button>
            ) : (
              onOpenLogin && (
                <button
                  className="sidebar-logout"
                  type="button"
                  onClick={onOpenLogin}
                >
                  Log in
                </button>
              )
            )}
          </div>
        </aside>
        <button
          className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
          type="button"
          aria-label="Close navigation menu"
          tabIndex={sidebarOpen ? 0 : -1}
          onClick={() => setSidebarOpen(false)}
        />
        <div className="app-page">
          <header className="mobile-topbar">
            <div className="mobile-brand">
              <BrandIdentity />
            </div>
            <button
              className="mobile-menu-button"
              type="button"
              aria-controls="student-navigation"
              aria-expanded={sidebarOpen}
              aria-label={
                sidebarOpen ? "Close navigation menu" : "Open navigation menu"
              }
              onClick={() => setSidebarOpen((open) => !open)}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </header>
          <main className="workspace main-content">
            {error && (
              <div className="error-banner">
                {error}
                <button onClick={() => setError("")} aria-label="Dismiss error">
                  <X size={16} />
                </button>
              </div>
            )}
            {view === "analyze" && (
              <>
                <section className="feature-intro">
                  <p className="eyebrow">ANALYZE FIT</p>
                  <h1>
                    How well do you fit this <em>particular role?</em>
                  </h1>
                  <p>
                    Upload your resume, add a job description, and get the same
                    evidence-led role analysis.
                  </p>
                </section>
                <div className="analysis-layout">
                  <section className="input-stack">
                    <div className="panel">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">STEP 01</p>
                          <h2>Upload your resume</h2>
                        </div>
                        <FileText size={22} />
                      </div>
                      <input
                        ref={inputRef}
                        hidden
                        type="file"
                        accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                        onChange={(event) =>
                          handleUpload(event.target.files?.[0])
                        }
                      />
                      <button
                        className={`dropzone ${resume ? "uploaded" : ""}`}
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleUpload(event.dataTransfer.files[0]);
                        }}
                      >
                        {busy && !resume ? (
                          <LoaderCircle className="spin" />
                        ) : resume ? (
                          <>
                            <span className="file-icon">
                              <Check size={18} />
                            </span>
                            <span>
                              <b>
                                {resume.originalName}{" "}
                                {resume.fileType ? `(${resume.fileType})` : ""}
                              </b>
                              <small>
                                Resume parsed and ready for analysis
                              </small>
                            </span>
                          </>
                        ) : (
                          <>
                            <UploadCloud size={26} />
                            <span>
                              <b>Upload your resume</b>
                              <small>
                                PDF, DOCX, JPG, PNG, WEBP · up to 10MB
                              </small>
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="panel">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">STEP 02</p>
                          <h2>Choose the opportunity</h2>
                        </div>
                        <WandSparkles size={22} />
                      </div>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Paste the job description here..."
                      />
                      <div className="form-footer">
                        <span>
                          {description.length.toLocaleString()} characters
                        </span>
                        <button
                          className="primary-button"
                          disabled={busy || !resume}
                          onClick={handleAnalyze}
                        >
                          {busy ? (
                            <LoaderCircle className="spin" size={17} />
                          ) : (
                            <Sparkles size={17} />
                          )}
                          Analyze my fit <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  </section>
                  {analysis ? (
                    <section className="results">
                      <div className="result-header">
                        <div>
                          <p className="eyebrow">ROLE ANALYSIS</p>
                          <h2>Your fit, decoded.</h2>
                          <p className="muted">
                            A transparent read on your evidence against this
                            role.
                          </p>
                        </div>
                        <Score value={analysis.matchPercentage} />
                      </div>
                      <div className="metric-row score-breakdown">
                        <Metric
                          name="Skills match"
                          value={analysis.scoreBreakdown.skillsMatch}
                        />
                        <Metric
                          name="Experience match"
                          value={analysis.experienceMatch}
                        />
                        <Metric
                          name="Project match"
                          value={analysis.projectMatch}
                        />
                        {analysis.scoreBreakdown.educationMatch !== null && (
                          <Metric
                            name="Education match"
                            value={analysis.scoreBreakdown.educationMatch}
                          />
                        )}
                      </div>
                      <div className="skills-grid">
                        <SkillList
                          title="Matching skills"
                          skills={analysis.matchingSkills}
                          tone="good"
                        />
                        <SkillList
                          title="Skills to build"
                          skills={analysis.missingSkills}
                          tone="gap"
                        />
                      </div>
                      <section className="insight-section">
                        <p className="eyebrow">RESUME EVIDENCE</p>
                        {analysis.skillEvidence.slice(0, 4).map((item) => (
                          <div className="evidence" key={item.skill}>
                            <b>{item.skill}</b>
                            <span>“{item.evidence}”</span>
                          </div>
                        ))}
                      </section>
                      <section className="insight-section">
                        <p className="eyebrow">PRIORITIZED GAPS</p>
                        {analysis.prioritizedGaps.map((gap) => (
                          <div className="gap-detail" key={gap.skill}>
                            <b
                              className={`priority ${gap.priority.toLowerCase()}`}
                            >
                              {gap.priority}
                            </b>
                            <div>
                              <strong>{gap.skill}</strong>
                              <span>{gap.reason}</span>
                            </div>
                          </div>
                        ))}
                      </section>
                      <div className="recommendations">
                        <p className="eyebrow">RECOMMENDED NEXT MOVES</p>
                        {analysis.recommendations.map((item, index) => (
                          <div className="recommendation" key={item}>
                            <span>0{index + 1}</span>
                            <p>{item}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : (
                    <section className="empty-result">
                      <Sparkles size={28} />
                      <h2>Your analysis will land here.</h2>
                      <p>
                        We’ll compare your experience, skills, and project
                        evidence against the role.
                      </p>
                    </section>
                  )}
                </div>
              </>
            )}
            {view === "simulator" && (
              <section className="single-panel">
                {analysis ? (
                  <>
                    <div className="result-header">
                      <div>
                        <p className="eyebrow">WHAT-IF SIMULATOR</p>
                        <h2>Try on your next skill.</h2>
                        <p className="muted">
                          {analysis.missingSkills.length
                            ? "The projection recomputes the same job-requirement score with a missing skill."
                            : "Strengthen an already evidenced skill without inventing new resume evidence."}
                        </p>
                      </div>
                      <Score
                        value={
                          simulation?.readinessScore ?? analysis.matchPercentage
                        }
                        label="Projected match"
                      />
                    </div>
                    <div className="simulator-form">
                      <label htmlFor="skill">
                        {analysis.missingSkills.length
                          ? "Add a missing skill"
                          : "Strengthen a matching skill"}
                      </label>
                      <div className="skill-input">
                        <input
                          id="skill"
                          list="role-skills"
                          value={addedSkill}
                          onChange={(event) =>
                            setAddedSkill(event.target.value)
                          }
                          placeholder={
                            (analysis.missingSkills.length
                              ? analysis.missingSkills
                              : analysis.matchingSkills)[0] ||
                            "No job skills were extracted"
                          }
                          disabled={
                            !(
                              analysis.missingSkills.length ||
                              analysis.matchingSkills.length
                            )
                          }
                        />
                        <datalist id="role-skills">
                          {(analysis.missingSkills.length
                            ? analysis.missingSkills
                            : analysis.matchingSkills
                          ).map((skill) => (
                            <option key={skill} value={skill} />
                          ))}
                        </datalist>
                        <button
                          className="primary-button"
                          disabled={
                            busy ||
                            !addedSkill.trim() ||
                            !(
                              analysis.missingSkills.length
                                ? analysis.missingSkills
                                : analysis.matchingSkills
                            ).includes(addedSkill.trim())
                          }
                          onClick={handleSimulation}
                        >
                          {busy ? (
                            <LoaderCircle className="spin" size={17} />
                          ) : (
                            <WandSparkles size={17} />
                          )}
                          Run scenario
                        </button>
                      </div>
                      {!analysis.missingSkills.length && (
                        <p className="muted">
                          All extracted job requirements are already evidenced.
                          Strengthening a skill keeps the projection
                          evidence-based.
                        </p>
                      )}
                      {simulation && (
                        <div className="simulation-result">
                          <span>
                            Current match: {analysis.matchPercentage}%
                          </span>
                          <span>
                            Projected match: {simulation.readinessScore}%
                          </span>
                          <strong>
                            {simulation.scoreChange >= 0 ? "+" : ""}
                            {simulation.scoreChange} points
                          </strong>
                          <p>{simulation.reason}</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="Analyze a role first."
                    text="The simulator uses your real resume and role analysis to project a useful change."
                    onClick={() => navigateTo("analyze")}
                  />
                )}
              </section>
            )}
            {view === "plan" && (
              <section className="single-panel">
                <div className="instant-plan-workspace">
                  <div className="result-header">
                    <div>
                      <p className="eyebrow">QUICK ROADMAP</p>
                      <h2>Turn your biggest skill gaps into a focused action plan you can start right now.</h2>
                    </div>
                  </div>

                  {/* Plan Source Bar */}
                  {instantPlan && (
                    <div className="plan-source-bar">
                      <div className="plan-source-info">
                        <span>Based on:</span>
                        <b>{instantPlan.source.label}</b>
                      </div>
                      {history.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "10px", color: "#849087" }}>Source:</span>
                          <select
                            className="plan-source-select"
                            value={selectedPlanSourceId}
                            onChange={(e) => {
                              setSelectedPlanSourceId(e.target.value);
                              void loadInstantPlan(instantDuration, e.target.value);
                            }}
                          >
                            <option value="auto">
                              {analysis ? "Current Active Analysis" : "Latest Saved Analysis"}
                            </option>
                            {history.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.resumeName} ({item.matchPercentage}%)
                              </option>
                            ))}
                            <option value="profile">Your Current Profile</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Loading State */}
                  {instantLoading ? (
                    <div className="instant-loading-card">
                      <LoaderCircle className="spin" size={32} color="#8fae32" />
                      <h3>BUILDING YOUR QUICK ROADMAP...</h3>
                      <div className="loading-progression">
                        <div className="loading-progression-step done">
                          <CheckCircle2 size={15} />
                          <span>Analyzing your skill gaps</span>
                        </div>
                        <div className="loading-progression-step done">
                          <CheckCircle2 size={15} />
                          <span>Prioritizing what matters most</span>
                        </div>
                        <div className="loading-progression-step">
                          <Clock3 size={15} />
                          <span>Building your action steps</span>
                        </div>
                      </div>
                    </div>
                  ) : instantPlan && instantPlan.steps.length === 0 ? (
                    /* Empty / Edge Case */
                    <div className="empty-result">
                      <Sparkles size={32} />
                      <h2>No skill gaps detected</h2>
                      <p>
                        {instantPlan.message ||
                          "Your current profile doesn't have enough detected skill gaps to build a personalized quick roadmap."}
                      </p>
                      <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
                        <button className="primary-button" onClick={() => navigateTo("analyze")}>
                          Analyze a Target Role
                        </button>
                        <button className="secondary-button" onClick={() => navigateTo("profile")}>
                          Update Profile & Target Roles
                        </button>
                      </div>
                    </div>
                  ) : instantPlan ? (
                    <>
                      {/* Top Skill Gaps */}
                      {instantPlan.missingSkills.length > 0 && (
                        <div className="gaps-container">
                          <p className="eyebrow" style={{ margin: 0 }}>YOUR TOP SKILL GAPS</p>
                          <div className="gaps-list">
                            {instantPlan.missingSkills.map((gap) => (
                              <span className="gap-chip" key={gap.name}>
                                <span className={`chip-priority ${gap.priority.toLowerCase()}`}>
                                  {gap.priority}
                                </span>
                                {gap.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Time Options Selector */}
                      <div className="duration-selector-section">
                        <p className="eyebrow" style={{ margin: 0 }}>HOW MUCH TIME DO YOU HAVE?</p>
                        <div className="duration-buttons">
                          {([6, 12, 18] as const).map((hours) => (
                            <button
                              key={hours}
                              type="button"
                              className={`duration-btn ${instantDuration === hours ? "active" : ""}`}
                              onClick={() => {
                                setInstantDuration(hours);
                                void loadInstantPlan(hours, selectedPlanSourceId);
                              }}
                            >
                              <span>{hours} HOURS</span>
                              <span className="duration-tag">
                                {hours === 6
                                  ? "Sprint"
                                  : hours === 12
                                  ? "Recommended"
                                  : "Comprehensive"}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Generated Action Steps */}
                      <div>
                        <div className="section-heading" style={{ marginBottom: "16px" }}>
                          <div>
                            <p className="eyebrow">YOUR {instantPlan.durationHours}-HOUR QUICK ROADMAP</p>
                            <h2>Actionable Steps & Practice</h2>
                          </div>
                          <span className="step-duration-pill">
                            {instantPlan.durationHours} Hours Total
                          </span>
                        </div>

                        <div className="plan-steps-feed">
                          {instantPlan.steps.map((step) => {
                            const hoursDisplay =
                              step.durationMinutes >= 60
                                ? `${(step.durationMinutes / 60).toFixed(step.durationMinutes % 60 === 0 ? 0 : 1)} ${
                                    step.durationMinutes === 60 ? "hour" : "hours"
                                  }`
                                : `${step.durationMinutes} min`;

                            return (
                              <article className="step-card" key={`${step.order}-${step.skill}`}>
                                <div className="step-card-header">
                                  <div className="step-card-title-group">
                                    <span className="step-num-badge">
                                      {step.order < 10 ? `0${step.order}` : step.order}
                                    </span>
                                    <div>
                                      <h3>{step.skill}</h3>
                                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#68766d" }}>
                                        {step.title}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="step-card-meta">
                                    <span className={`priority ${step.priority.toLowerCase()}`}>
                                      {step.priority} Priority
                                    </span>
                                    <span className="step-duration-pill">
                                      <Clock3 size={11} style={{ display: "inline", marginRight: "4px" }} />
                                      {hoursDisplay} ({step.durationMinutes} min)
                                    </span>
                                  </div>
                                </div>

                                <div className="step-sections-grid">
                                  {/* Learn */}
                                  <div className="step-subblock">
                                    <span className="subblock-label">
                                      <BookOpen size={12} />
                                      What to Learn
                                    </span>
                                    <ul className="subblock-list">
                                      {step.learn.map((item, i) => (
                                        <li key={i}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* Practice */}
                                  <div className="step-subblock">
                                    <span className="subblock-label">
                                      <Target size={12} />
                                      How to Practice
                                    </span>
                                    <ul className="subblock-list">
                                      {step.practice.map((item, i) => (
                                        <li key={i}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* Outcome */}
                                  <div className="outcome-box">
                                    <strong>Expected Outcome</strong>
                                    {step.outcome}
                                  </div>

                                  {/* Resources */}
                                  {Array.isArray(step.resources) && step.resources.length > 0 && (
                                    <div className="resources">
                                      <p className="eyebrow">FREE LEARNING RESOURCES</p>
                                      {step.resources.map((resource) => (
                                        <a
                                          href={resource.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          key={resource.url}
                                        >
                                          <b>{resource.title}</b>
                                          <span>
                                            {resource.resourceType} · {resource.provider} ·{" "}
                                            {resource.estimatedLearningTime}
                                          </span>
                                          <small>{resource.description}</small>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </article>
                            );
                          })}

                          {/* Final Skill Check */}
                          {instantPlan.finalSkillCheck && (
                            <section className="skill-check-card">
                              <div className="skill-check-header">
                                <CheckCircle2 size={20} />
                                <h3>{instantPlan.finalSkillCheck.title}</h3>
                              </div>
                              <p>{instantPlan.finalSkillCheck.description}</p>

                              {instantPlan.finalSkillCheck.tasks && instantPlan.finalSkillCheck.tasks.length > 0 && (
                                <div className="skill-check-tasks">
                                  <span>Validation Tasks</span>
                                  <ul>
                                    {instantPlan.finalSkillCheck.tasks.map((task, i) => (
                                      <li key={i}>{task}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {instantPlan.finalSkillCheck.questions && instantPlan.finalSkillCheck.questions.length > 0 && (
                                <div className="skill-check-questions">
                                  <span>Self-Assessment & Interview Questions</span>
                                  <ul>
                                    {instantPlan.finalSkillCheck.questions.map((q, i) => (
                                      <li key={i}>{q}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </section>
                          )}

                          {/* Total Plan Time Summary */}
                          <div className="plan-total-bar">
                            <div>
                              <span>Total Quick Roadmap Duration</span>
                              <small>Exact Allocation Verified</small>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <strong>{instantPlan.durationHours} HOURS</strong>
                              <small>{instantPlan.totalMinutes} MINUTES</small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
            )}
            {view === "history" && (
              <section className="single-panel">
                <div className="result-header">
                  <div>
                    <p className="eyebrow">CAREER HISTORY</p>
                    <h2>Saved role analyses.</h2>
                    <p className="muted">
                      Reopen a previous resume-to-role comparison whenever you
                      need it.
                    </p>
                  </div>
                  <Clock3 size={26} />
                </div>
                {historyLoading ? (
                  <div className="empty-result">
                    <LoaderCircle className="spin" size={28} />
                    <p>Loading your saved analyses…</p>
                  </div>
                ) : history.length ? (
                  <div className="plan-list">
                    {history.map((item) => (
                      <article className="plan-step" key={item.id}>
                        <span className="week-number">
                          {item.matchPercentage}%
                        </span>
                        <div>
                          <p className="eyebrow">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                          <h3>{item.resumeName}</h3>
                          <p>{item.jobPreview}</p>
                          {item.missingSkills.length > 0 && (
                            <div className="skill-list">
                              {item.missingSkills.slice(0, 4).map((skill) => (
                                <span className="skill-pill gap" key={skill}>
                                  <X size={13} />
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => openHistoryItem(item.id)}
                          >
                            Open analysis <ArrowRight size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No saved analyses yet."
                    text="Your next role analysis will be saved here automatically."
                    onClick={() => navigateTo("analyze")}
                  />
                )}
              </section>
            )}
            {view === "dsa" && <DsaPreparation />}
            {view === "interviewPrep" && (
              <section className="single-panel">
                <h1>Interview Prep</h1>
                <p>Coming soon.</p>
              </section>
            )}
            {view === "aptitudePrep" && (
              <section className="single-panel">
                <h1>Aptitude Prep</h1>
                <p>Coming soon.</p>
              </section>
            )}
            {currentPlacementSection && (
              <PlacementManagement
                section={currentPlacementSection}
                onSectionChange={(nextSection) =>
                  navigateTo(viewForPlacementSection(nextSection))
                }
                onNavigate={navigateTo}
              />
            )}
          </main>
          <footer>
            PlaceX <span>•</span> Built for a sharper career move
          </footer>
        </div>
      </div>
    </div>
  );
}

function Metric({ name, value }: { name: string; value: number }) {
  return (
    <div>
      <span>{name}</span>
      <strong>{value}%</strong>
      <div className="bar">
        <i style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
function EmptyState({
  title,
  text,
  onClick,
}: {
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-result">
      <Sparkles size={28} />
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="text-button" onClick={onClick}>
        Go to analysis <ArrowRight size={16} />
      </button>
    </div>
  );
}
export default function Dashboard(props: {
  isAuthenticated?: boolean;
  studentEmail?: string;
  userRole?: "STUDENT" | "TPO" | "ADMIN";
  onOpenLogin?: () => void;
  onLogout?: () => void;
}) {
  if (props.userRole === "TPO" || props.userRole === "ADMIN") {
    return (
      <TpoWorkspace
        user={{ email: props.studentEmail, role: props.userRole }}
        onLogout={props.onLogout || (() => {})}
      />
    );
  }
  return <StudentDashboard {...props} />;
}
