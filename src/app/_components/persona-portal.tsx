"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  Card,
  Col,
  Divider,
  Grid,
  Row,
  Statistic,
  Tabs,
  Tour,
  type TourProps,
  Typography,
} from "antd";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { AuthIconButton } from "~/app/_components/shared/auth-icon-button";
import { PageHeader } from "~/app/_components/shared/page-header";
import { CompaniesTab } from "~/app/_components/companies/companies-tab";
import { PersonasTab } from "~/app/_components/personas/personas-tab";
import { ProposalsTab } from "~/app/_components/proposals/proposals-tab";
import { ThemeToggle } from "~/app/theme-toggle";
import { api } from "~/trpc/react";

const { useBreakpoint } = Grid;
const TOUR_STORAGE_PREFIX = "persona-portal-tour-completed:v3";

const refTarget = (ref: React.RefObject<HTMLElement | null>) =>
  ref.current ? () => ref.current! : null;

export function PersonaPortal() {
  const screens = useBreakpoint();
  const { data: session, status } = useSession();

  // Tour anchor refs
  const authButtonRef = useRef<HTMLSpanElement | null>(null);
  const themeToggleRef = useRef<HTMLSpanElement | null>(null);
  const promptAdminActionRef = useRef<HTMLSpanElement | null>(null);
  const metricGridRef = useRef<HTMLDivElement | null>(null);
  const workspaceTabsRef = useRef<HTMLElement | null>(null);
  const companiesTabLabelRef = useRef<HTMLSpanElement | null>(null);
  const personasTabLabelRef = useRef<HTMLSpanElement | null>(null);
  const proposalsTabLabelRef = useRef<HTMLSpanElement | null>(null);

  const [tourOpen, setTourOpen] = useState(false);

  const companiesQuery = api.company.list.useQuery();
  const personasQuery = api.persona.list.useQuery();
  const proposalsQuery = api.proposal.list.useQuery();

  const companies = companiesQuery.data ?? [];
  const personas = personasQuery.data ?? [];
  const proposals = proposalsQuery.data ?? [];

  const userTourStorageKey = useMemo(() => {
    if (!session?.user?.id) return null;
    return `${TOUR_STORAGE_PREFIX}:${session.user.id}`;
  }, [session?.user?.id]);

  const completeTour = useCallback(() => {
    if (typeof window === "undefined") return;
    if (userTourStorageKey) {
      window.localStorage.setItem(userTourStorageKey, "true");
    }
    setTourOpen(false);
  }, [userTourStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status !== "authenticated") return;
    if (!userTourStorageKey) return;

    const isTourCompleted = window.localStorage.getItem(userTourStorageKey) === "true";
    setTourOpen(!isTourCompleted);
  }, [status, userTourStorageKey]);

  const tourSteps: TourProps["steps"] = [
    // ── Welcome ──
    {
      title: "Welcome to Persona Intelligence Portal",
      description:
        "This walkthrough covers every major feature: authentication, company profiles, stakeholder modeling, proposal intelligence, AI analysis, live transcription, chat, communications, translation, and text-to-speech.",
      target: null,
    },
    {
      title: "Theme Toggle",
      description:
        "Switch between light and dark mode. Your preference is applied instantly across the entire portal.",
      target: refTarget(themeToggleRef),
    },
    {
      title: "Prompt Administration",
      description:
        "Open the admin screen to customize AI prompt templates for Persona Analysis, RFP Analysis, and Proposal Draft generation. Changes are saved to the database and used on the next AI request. You can reset any prompt to its built-in default.",
      target: refTarget(promptAdminActionRef),
    },
    // ── Dashboard metrics ──
    {
      title: "Dashboard Metrics",
      description:
        "A real-time snapshot of your account data: total companies, stakeholder personas, and tracked proposals. Use it to gauge portfolio coverage at a glance.",
      target: refTarget(metricGridRef),
    },
    // ── Companies ──
    {
      title: "Companies",
      description:
        "Create and manage company accounts. Each profile captures industry, business intent, technology intent, development stacks, certifications, compliance standards, technology partnerships, reference architectures, and engineering guidelines — all of which feed into AI analysis quality.",
      target: refTarget(companiesTabLabelRef),
    },
    // ── Personas ──
    {
      title: "Personas",
      description:
        "Model the key stakeholders at each account: full name, email, job description, personality summary, personal preferences, and past experiences. Use the Edit button to update any profile.",
      target: refTarget(personasTabLabelRef),
    },
    {
      title: "Persona Communications",
      description:
        "Open a persona's Communications panel to log and review interaction history — chat, email, meeting transcripts, and personality notes — giving AI analysis richer context for outreach recommendations.",
      target: refTarget(personasTabLabelRef),
    },
    {
      title: "AI Persona Analysis",
      description:
        "Click Analyze on any persona to generate an AI report with persona insights, proposal targeting strategy, relationship-strengthening tactics, stakeholder communication guidance, failure risks, and the top 3 recommended next actions. Regenerate any time context changes.",
      target: refTarget(personasTabLabelRef),
    },
    // ── Proposals ──
    {
      title: "Proposals",
      description:
        "Create proposals linked to a company with title, summary, intent signals, and technology fit. Track status (draft → in review → submitted → won / lost) and outcomes. Edit, delete, or drill into any proposal from the actions menu.",
      target: refTarget(proposalsTabLabelRef),
    },
    {
      title: "Stakeholder Linking",
      description:
        "Link personas to a proposal as stakeholders with a specific role (CTO, PO, Functional Tech Lead, Tech Lead, Other) and an influence level (1–5). These links enrich every AI analysis and communication generated for the proposal.",
      target: refTarget(proposalsTabLabelRef),
    },
    {
      title: "AI RFP Analysis",
      description:
        "Run an AI-powered RFP analysis on a proposal to generate success signals, failure signals, and a structured recommendation informed by company context and stakeholder data. From any evaluation you can also generate a new draft proposal pre-filled with AI-suggested title, summary, signals, and rationale.",
      target: refTarget(proposalsTabLabelRef),
    },
    // ── Meeting Notes ──
    {
      title: "Meeting Notes",
      description:
        "Inside a proposal, create meeting notes to capture customer conversations. Three entry modes: manual notes only, paste a transcript, or start a live audio recording session.",
      target: refTarget(proposalsTabLabelRef),
    },
    {
      title: "Live Audio Transcription",
      description:
        "Start a live recording powered by AssemblyAI WebSocket streaming. The portal captures audio from your microphone and displays timestamped transcript segments in real time, with connection status, chunk counters, and detected speaker labels.",
      target: refTarget(proposalsTabLabelRef),
    },
    {
      title: "Meeting AI Features",
      description:
        "After capturing a transcript, run three AI actions powered by Google Gemini: generate a Meeting Summary, run a Meeting Analysis to extract key signals, and produce Recommended Next Steps. Each output is editable and saveable. You can also assign transcript speakers to named stakeholders and rename speaker labels.",
      target: refTarget(proposalsTabLabelRef),
    },
    // ── Chat ──
    {
      title: "Proposal AI Chat",
      description:
        "Open a conversational AI chat scoped to any proposal. The assistant has full context of the proposal, linked stakeholders, evaluations, and company profile. Session history is persisted so context carries across visits. Use Delete History & Restart to reset the conversation.",
      target: refTarget(proposalsTabLabelRef),
    },
    // ── Communications ──
    {
      title: "Communications Workspace",
      description:
        "Open a per-proposal Communications panel to manage outreach. Select a target stakeholder role (and optionally a persona) to generate a new message — the prompt is automatically enriched with persona, proposal, and company context. View, inline-edit, duplicate, or delete any generated message.",
      target: refTarget(proposalsTabLabelRef),
    },
    // ── Cross-cutting features ──
    {
      title: "Text-to-Speech",
      description:
        "Use the Read Aloud button available on text areas, analysis outputs, and chat messages to listen to content via text-to-speech. Playback can be paused and resumed. A character limit indicator shows the maximum supported length.",
      target: refTarget(workspaceTabsRef),
      cover: (
        <img
          draggable={false}
          alt="Read_Aloud.png"
          src="./Read_Aloud.png"
        />
      )
    },
    // ── Wrap-up ──
    {
      title: "You're All Set",
      description:
        "This tour won't appear again on this browser. Start by adding a company, creating personas, building your first proposal, and exploring the AI features. Enjoy the Persona Intelligence Portal!",
      target: null,
    },
  ];

  return (
    <div className="portal-shell">
      <PageHeader
        title="Persona Intelligence Portal"
        description="Group insights by company, model stakeholder personas, track proposal win/loss signals, and generate targeted communications for CTO, PO, Functional Tech Lead, and Tech Lead audiences."
        actions={
          <>
            <span ref={promptAdminActionRef}>
              <Link href="/admin">
                <Button>Prompt Admin</Button>
              </Link>
            </span>
            <span ref={authButtonRef}>
              <AuthIconButton />
            </span>
            <span ref={themeToggleRef}>
              <ThemeToggle />
            </span>
          </>
        }
      />

      <Row ref={metricGridRef} gutter={[20, 20]} className="metric-grid">
        <Col xs={24} sm={8}>
          <Card className="metric-card">
            <Statistic title="Companies" value={companies.length} />
            <Typography.Text className="metric-caption">
              Account records aligned to enterprise context
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="metric-card">
            <Statistic title="Personas" value={personas.length} />
            <Typography.Text className="metric-caption">
              Stakeholders mapped for targeting and influence
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="metric-card">
            <Statistic title="Proposals" value={proposals.length} />
            <Typography.Text className="metric-caption">
              Opportunities monitored for outcome signals
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      <section ref={workspaceTabsRef} className="workspace-panel">
        <Tabs
          className="portal-tabs"
          size="large"
          tabPlacement={screens.lg ? "start" : "top"}
          items={[
            {
              key: "companies",
              label: <span ref={companiesTabLabelRef}>Companies</span>,
              children: <CompaniesTab />,
            },
            {
              key: "personas",
              label: <span ref={personasTabLabelRef}>Personas</span>,
              children: <PersonasTab />,
            },
            {
              key: "proposals",
              label: <span ref={proposalsTabLabelRef}>Proposals & Stakeholders</span>,
              children: <ProposalsTab />,
            },
          ]}
        />
      </section>

      <Divider />
      <Typography.Text type="secondary">
        The current implementation persists persona intelligence and proposal outcomes so your team
        can personalize future outreach based on profile traits, communication history, and prior
        wins or losses per company.
      </Typography.Text>

      <Tour
        open={tourOpen}
        steps={tourSteps}
        onClose={completeTour}
        onFinish={completeTour}
      />
    </div>
  );
}
