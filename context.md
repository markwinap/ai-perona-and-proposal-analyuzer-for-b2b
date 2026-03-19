# Persona Intelligence Portal Context

## Objective
Build a portal that helps an IT services company analyze personas by company and improve proposal targeting using:
- chat conversations
- email communications
- meeting transcripts
- personality and personal preferences
- job descriptions and past experiences
- historical proposal outcomes (success/failure)
- company technology intent, development stack, standards, and partnerships

The result is a targeted communication workflow for stakeholders such as CTO, PO, Functional Tech Lead, and Tech Lead.

## C4 Model

### Level 1 - System Context
```mermaid
C4Context
    title Persona Intelligence Portal - System Context
    Person(accountManager, "Account Manager", "Creates and tracks proposals")
    Person(solutionArchitect, "Solution Architect", "Analyzes technical fit and delivery strategy")
    Person(businessDev, "Business Development", "Drives relationship and opportunity growth")

    System(portal, "Persona Intelligence Portal", "Captures persona + company + proposal intelligence and generates targeted stakeholder communication")

    System_Ext(aiProviders, "AI Providers", "openai | azure_openai | ollama | copilot")
    System_Ext(emailChatSources, "Email/Chat/Meeting Sources", "Imported notes, transcripts, communication content")

    Rel(accountManager, portal, "Manages companies, personas, proposals")
    Rel(solutionArchitect, portal, "Adds technical fit and recommendation")
    Rel(businessDev, portal, "Uses generated communication targets")
    Rel(portal, aiProviders, "Uses selected provider for communication generation")
    Rel(emailChatSources, portal, "Feeds communication intelligence")
```

### Level 2 - Container Diagram
```mermaid
C4Container
    title Persona Intelligence Portal - Containers
    Person(user, "Portal User")

    Container(web, "Next.js Web App", "TypeScript + App Router + Ant Design", "UI for company/persona/proposal workflows")
    Container(api, "tRPC API", "TypeScript", "Domain operations and orchestration")
    ContainerDb(db, "PostgreSQL", "Drizzle ORM", "Persists company, persona, proposal, evaluation, and communication data")
    Container_Ext(ai, "AI Runtime", "OpenAI-compatible endpoint", "Used for persona analysis and communication generation")

    Rel(user, web, "Uses")
    Rel(web, api, "Calls")
    Rel(api, db, "Reads/Writes")
    Rel(api, ai, "Sends generation prompts (provider-selected)")
```

### Level 3 - Component Diagram (API)
```mermaid
flowchart LR
    A[companyRouter] --> DB[(PostgreSQL)]
    B[personaRouter] --> DB
    C[proposalRouter] --> DB
    D[aiProviderRouter] --> DB

    C --> E[Message Composer]
    D --> P[Provider Resolver]
    P --> X[openai]
    P --> Y[azure_openai]
    P --> Z[ollama]
    P --> W[copilot]
```

## Domain Model

```mermaid
erDiagram
    COMPANY ||--o{ PERSONA : has
    COMPANY ||--o{ PROPOSAL : owns
    COMPANY ||--o{ AI_PROVIDER_CONFIG : configures
    COMPANY ||--o{ PERSONA_COMMUNICATION : stores

    PERSONA ||--o{ PERSONA_COMMUNICATION : contributes
    PERSONA ||--o{ PROPOSAL_STAKEHOLDER : linked_to

    PROPOSAL ||--o{ PROPOSAL_STAKEHOLDER : has
    PROPOSAL ||--o{ PROPOSAL_EVALUATION : evaluated_by
    PROPOSAL ||--o{ GENERATED_COMMUNICATION : produces

    PERSONA ||--o{ GENERATED_COMMUNICATION : receives

    COMPANY {
      int id PK
      string name
      string industry
      text businessIntent
      text technologyIntent
      string[] developmentStacks
      string[] certifications
      string[] standards
      string[] partnerships
      string[] referenceArchitectures
      string[] engineeringGuidelines
      timestamp createdAt
      timestamp updatedAt
    }

    PERSONA {
      int id PK
      int companyId FK
      string fullName
      string email
      text jobDescription
      text personalitySummary
      text personalPreferences
      text pastExperiences
      timestamp createdAt
      timestamp updatedAt
    }

    PERSONA_COMMUNICATION {
      int id PK
      int companyId FK
      int personaId FK
      enum type
      string subject
      text content
      json metadata
      timestamp occurredAt
      timestamp createdAt
    }

    PROPOSAL {
      int id PK
      int companyId FK
      string title
      text summary
      text intentSignals
      text technologyFit
      enum status
      enum outcome
      text outcomeReason
      timestamp createdAt
      timestamp updatedAt
    }

    PROPOSAL_STAKEHOLDER {
      int proposalId PK,FK
      int personaId PK,FK
      enum role PK
      int influenceLevel
      text notes
      timestamp createdAt
    }

    PROPOSAL_EVALUATION {
      int id PK
      int proposalId FK
      text successSignals
      text failureSignals
      int successScore
      int failureRiskScore
      text recommendation
      timestamp createdAt
    }

    AI_PROVIDER_CONFIG {
      int id PK
      int companyId FK nullable
      enum provider
      string modelName
      string endpoint
      string apiVersion
      json options
      bool isDefault
      timestamp createdAt
      timestamp updatedAt
    }

    GENERATED_COMMUNICATION {
      int id PK
      int proposalId FK
      int personaId FK nullable
      enum stakeholderRole
      enum aiProvider
      text promptContext
      text generatedMessage
      timestamp createdAt
    }
```

## Core Data Flows

### 1) Persona Intelligence Ingestion
```mermaid
sequenceDiagram
    participant U as User
    participant UI as Portal UI
    participant API as personaRouter
    participant DB as PostgreSQL

    U->>UI: Add persona + preferences + experiences
    UI->>API: createPersona
    API->>DB: insert persona

    U->>UI: Add email/chat/meeting transcript
    UI->>API: addCommunication
    API->>DB: insert persona_communication
```

### 2) Proposal Evaluation with Success/Failure Signals
```mermaid
sequenceDiagram
    participant U as User
    participant UI as Portal UI
    participant API as proposalRouter
    participant DB as PostgreSQL

    U->>UI: Create proposal for company
    UI->>API: createProposal
    API->>DB: insert proposal

    U->>UI: Record success/failure indicators
    UI->>API: evaluateProposal
    API->>DB: insert proposal_evaluation
```

### 3) Stakeholder Communication Generation
```mermaid
sequenceDiagram
    participant U as User
    participant UI as Portal UI
    participant API as proposalRouter
    participant DB as PostgreSQL
    participant AI as AI Runtime

    U->>UI: Select proposal + stakeholder role + provider
    UI->>API: generateCommunicationTarget
    API->>DB: read proposal + latest evaluation
    API->>AI: send prompt context
    AI-->>API: generated text
    API->>DB: persist generated_communication
    API-->>UI: return communication target
```

## AI Runtime
The portal uses a single AI runtime configuration via environment variables:
- AI_API_KEY
- AI_BASE_URL (optional, defaults to OpenAI endpoint)
- AI_MODEL (optional, defaults to gpt-4o-mini)

This keeps the user workflow focused on persona analysis and proposal targeting rather than provider administration.

## Key Aggregation Rules
- Personas are grouped by company via companyId.
- Proposal outcomes are tracked as success/failure/pending and can be correlated with stakeholder role and technical-fit signals.
- Proposal evaluations persist both success and failure signals to improve future targeting.
- Communication targets are generated for explicit stakeholder roles (CTO, PO, Functional Tech Lead, Tech Lead, Other).

## Extension Hooks
- Add ingestion adapters for Outlook, Teams, Slack, and transcript files.
- Add scoring jobs that summarize communication sentiment and influence trends.
- Add semantic retrieval for proposal history before generation.
- Add confidence scoring per generated message and A/B test tracking.
