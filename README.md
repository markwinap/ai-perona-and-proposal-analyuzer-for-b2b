# Persona Intelligence Portal

An AI-powered B2B intelligence platform that helps IT services teams model stakeholder personas, track proposal win/loss signals, and generate targeted communications for enterprise accounts.

---

## Description

The **Persona Intelligence Portal** centralizes the human and organizational context that sales teams need to win B2B deals. It lets account managers, solution architects, and business development professionals:

- Build a rich profile for each company account — technology intent, development stacks, compliance certifications, standards, partnerships, and engineering guidelines.
- Model the key stakeholders at each account (CTO, PO, Functional Tech Lead, Tech Lead) with personality summaries, preferences, job context, and historical communications.
- Create and track proposals with intent signals, technology-fit assessments, and outcome tracking (won / lost / pending).
- Run AI-powered analyses of both personas and proposals to surface success/failure signals and concrete next actions.
- Generate role-specific, context-aware outreach messages tailored to each stakeholder's persona and the live state of a proposal.
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

### AI-Generated Communications
- Generate targeted outreach messages for a given proposal and stakeholder role.
- Persona context (personality, preferences, job focus) is automatically woven into the prompt.
- View and manage all generated communications with proposal- and role-level attribution.

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
| Auth | [NextAuth.js v5](https://next-auth.js.org) |
| AI Runtime | OpenAI-compatible endpoint + Google Gemini (translation) |
| Package Manager | pnpm |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- A running PostgreSQL instance (see `start-database.sh` for a Docker-based local setup)

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```env
DATABASE_URL=           # PostgreSQL connection string
NEXTAUTH_SECRET=        # Random secret for NextAuth
AUTH_DISCORD_ID=        # Discord OAuth app client ID (optional)
AUTH_DISCORD_SECRET=    # Discord OAuth app client secret (optional)

# Primary AI provider (OpenAI-compatible)
AI_API_KEY=             # API key for the default AI provider
AI_BASE_URL=            # Optional — defaults to OpenAI endpoint
AI_MODEL=               # Optional — defaults to gpt-4o-mini

# Translation (optional)
GOOGLE_GEMINI_API_KEY=  # Enables Spanish (LATAM) translation
GOOGLE_GEMINI_MODEL=    # Optional — defaults to gemini-2.5-flash
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
│   ├── api/routers/        # tRPC routers: company, persona, proposal, ai-provider
│   ├── db/                 # Drizzle schema and database client
│   └── services/           # AI services: persona analysis, proposal analysis, translation
├── trpc/                   # tRPC client setup (React Query integration)
└── styles/                 # Global CSS
```
