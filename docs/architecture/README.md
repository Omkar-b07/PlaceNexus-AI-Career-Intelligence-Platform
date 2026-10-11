# PlaceX architecture diagrams

This set documents the implementation found in the repository on 2026-10-03. The diagrams use Mermaid `flowchart` syntax and are intended to render in Mermaid-enabled Markdown viewers, the Mermaid Live Editor, or a Mermaid CLI without requiring any application changes.

| Diagram | Purpose |
| --- | --- |
| `system-architecture.mmd` | Layered overview of the web client, API, storage, data stores, and active integrations. |
| `data-flow-level-0.mmd` | Context-level data flow between people, PlaceX, persistent stores, and external services. |
| `data-flow-level-1.mmd` | Major backend processes and their data stores, including campus, off-campus, and DSA flows. |
| `jd-resume-analysis-dfd.mmd` | TPO JD analysis and the separate profile-skills and resume-evidence analytics paths. |
| `eligibility-dfd.mmd` | Official drive eligibility evaluation. |
| `application-flow-dfd.mmd` | Campus applications, TPO status updates, and off-campus tracking. |
| `legacy-resume-flow.mmd` | Explicit, TPO-confirmed reattachment of unlinked legacy resume files. |

## Scope notes

- Database names shown are the implementation defaults: `placenexus` and `PlaceNexusPreparation`. Environment configuration can override either name at runtime.
- The repository establishes no hosting, reverse-proxy, CI/CD, monitoring, email, queue, or object-storage topology. Those components are deliberately not depicted.
- Resume files are stored on the backend file system. Profile photos are the only uploads served through a public static route; resume downloads and legacy previews remain authenticated routes.
- Google Identity, Google Gemini, and Adzuna are included because the code contains active integrations for them. Gemini-dependent paths provide the fallbacks and availability states represented in the detailed diagrams.
