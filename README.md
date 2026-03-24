# Persona Intelligence Portal

An AI-powered B2B intelligence platform that helps IT services teams model stakeholder personas, run live meeting transcription, track proposal win/loss signals, and generate targeted communications for enterprise accounts.

---

## Description

The **Persona Intelligence Portal** centralizes the human and organizational context that sales and solutioning teams need to win B2B deals. It lets account managers, solution architects, and business development professionals:

- Build a rich profile for each company account — technology intent, development stacks, compliance certifications, standards, partnerships, and engineering guidelines.
- Model the key stakeholders at each account (CTO, PO, Functional Tech Lead, Tech Lead) with personality summaries, preferences, job context, and historical communications.
- Create and track proposals with intent signals, technology-fit assessments, and outcome tracking (won / lost / pending).
- Run AI-powered analyses of both personas and proposals to surface success/failure signals and concrete next actions.
- Capture live meeting notes with **real-time audio transcription** (AssemblyAI streaming), speaker assignment, and AI-generated summaries, analysis, and recommended next steps.
- Conduct **AI-powered chat** conversations scoped to each proposal for real-time solutioning guidance.
- Generate role-specific, context-aware outreach messages tailored to each stakeholder's persona and the live state of a proposal — then view, edit, duplicate, and delete them per proposal.
- Translate analysis output to Latin American Spanish using Google Gemini for bilingual teams.

---

## Product Features

### Company Intelligence
- Create and manage company accounts with industry, business intent, and technology intent fields.
- Record development stacks, certifications, compliance standards, technology partnerships, reference architectures, and engineering guidelines.
- Edit existing company records in-line from the portal dashboard.

### Persona Management
- Create stakeholder personas scoped to a company.
- Capture full name, email, job description, personality summary, personal preferences, and past experiences.
- Log and review communication history per persona: chat, email, meeting transcripts, and personality notes.
- Run an **AI Persona Analysis** that cross-references persona data, company signals, and proposal history to produce:
  - Persona insights
  - Proposal targeting strategy
  - Relationship-strengthening tactics
  - Stakeholder communication guidance
  - Watch-outs and failure risks
  - Recommended next 3 actions

### Proposal Tracking
- Create proposals linked to a company with title, summary, intent signals, technology fit, status (draft → in_review → submitted → won/lost), and outcome tracking.
- Link stakeholders to proposals with a specific role and influence level.
- Add manual evaluations recording success signals, failure signals, success score (0–100), failure risk score (0–100), and a recommendation narrative.
- Run an **AI Proposal (RFP) Analysis** to generate success/failure signals and a structured recommendation informed by company context and stakeholder profiles.
- Generate draft proposals for similar opportunities using AI, pre-populated with title, summary, intent signals, technology fit, and rationale.
- Delete proposals with a confirmation dialog.

### Meeting Notes
- Create meeting notes per proposal to record context from customer meetings.
- **Live streaming transcription** via AssemblyAI WebSocket — start recording directly from the browser to capture real-time audio as timestamped transcript segments.
- Assign transcript speakers to named participants; rename speakers for clarity.
- Run **AI Meeting Summary** (Google Gemini) to produce a concise summary of the meeting.
- Run **AI Meeting Analysis** (Google Gemini) to extract key insights, signals, and observations.
- Run **AI Recommended Next Steps** (Google Gemini) to get a concrete action plan from the meeting content.
- Summary and Next Steps sections are collapsible to keep the notes view manageable.

### Proposal AI Chat
- Open a **conversational AI chat** scoped to any proposal.
- The AI has full context of the proposal, linked stakeholders, evaluations, and company profile.
- Session history is persisted per proposal so context is never lost between visits.

### Communications Workspace
- Open a per-proposal **Communications** panel to manage all generated outreach for that opportunity.
- Generate new messages by selecting a target stakeholder role: the prompt is automatically enriched with persona, proposal, and company context.
- View all previously generated messages with role and creation-date attribution.
- Inline-edit any message and save changes back to the database.
- Duplicate a message as a starting point for a new variant.
- Delete messages that are no longer needed.

### Translation
- Translate persona analyses and proposal evaluation outputs to **Latin American Spanish** using Google Gemini.
- Toggle between original and translated views within the portal without leaving context.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org) (App Router, Turbopack) |
| Language | TypeScript 5 |
| API | [tRPC v11](https://trpc.io) |
| Database | PostgreSQL via [Drizzle ORM](https://orm.drizzle.team) |
| UI | [Ant Design 6](https://ant.design) |
| Auth | [NextAuth.js v5](https://next-auth.js.org) (GitHub OAuth) |
| AI — Persona & Proposal | OpenAI-compatible endpoint (configurable) |
| AI — Meeting & Comms | [Google Gemini](https://ai.google.dev) (summary, analysis, generation, translation) |
| AI — Transcription | [AssemblyAI](https://www.assemblyai.com) (real-time WebSocket streaming) |
| Package Manager | pnpm 10 |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- A running PostgreSQL instance (see `start-database.sh` for a Docker-based local setup)

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```env
# Required
DATABASE_URL=               # PostgreSQL connection string

# Auth (required in production)
AUTH_SECRET=                # Random secret for NextAuth session encryption

# GitHub OAuth (optional — enables login)
GITHUB_CLIENT_ID=           # GitHub OAuth app client ID
GITHUB_CLIENT_SECRET=       # GitHub OAuth app client secret

# OpenAI-compatible AI provider (persona analysis, proposal analysis, chat)
AI_API_KEY=                 # API key for the AI provider
AI_BASE_URL=                # Optional — defaults to OpenAI endpoint
AI_MODEL=                   # Optional — defaults to gpt-4o-mini

# Google Gemini (meeting notes AI, communications generation, translation)
GOOGLE_GEMINI_API_KEY=      # Required to enable Gemini-powered features
GOOGLE_GEMINI_PROJECT_ID=   # Optional — GCP project ID if using Vertex AI
GOOGLE_GEMINI_MODEL=        # Optional — defaults to gemini-2.5-flash

# AssemblyAI (live meeting transcription)
ASSEMBLY_AI_API_KEY=        # Required to enable real-time audio transcription
```

### Install and Run

```bash
pnpm install
pnpm db:migrate        # Apply database migrations
pnpm dev               # Start the development server (Turbopack)
```

### Database Management

```bash
pnpm db:generate       # Generate a new migration from schema changes
pnpm db:migrate        # Apply pending migrations
pnpm db:push           # Push schema directly (dev only)
pnpm db:studio         # Open Drizzle Studio to browse the database
```

---

## Project Structure

```
src/
├── app/
│   ├── _components/        # Persona Intelligence Portal UI (single-page app shell)
│   └── api/                # Next.js route handlers (tRPC, NextAuth)
├── server/
│   ├── api/routers/        # tRPC routers: company, persona, proposal, ai-provider, prompt
│   ├── db/                 # Drizzle schema and database client
│   └── services/           # AI services: persona analysis, proposal analysis,
│                           #   meeting notes, proposal chat, translation
├── trpc/                   # tRPC client setup (React Query integration)
└── styles/                 # Global CSS
```
