"use client";

import {
  Button,
  Card,
  Col,
  Divider,
  Grid,
  Row,
  Statistic,
  Tabs,
  Typography,
} from "antd";
import Link from "next/link";

import { AuthIconButton } from "~/app/_components/shared/auth-icon-button";
import { PageHeader } from "~/app/_components/shared/page-header";
import { CompaniesTab } from "~/app/_components/companies/companies-tab";
import { PersonasTab } from "~/app/_components/personas/personas-tab";
import { ProposalsTab } from "~/app/_components/proposals/proposals-tab";
import { ThemeToggle } from "~/app/theme-toggle";
import { api } from "~/trpc/react";

const { useBreakpoint } = Grid;

export function PersonaPortal() {
  const screens = useBreakpoint();

  const companiesQuery = api.company.list.useQuery();
  const personasQuery = api.persona.list.useQuery();
  const proposalsQuery = api.proposal.list.useQuery();

  const companies = companiesQuery.data ?? [];
  const personas = personasQuery.data ?? [];
  const proposals = proposalsQuery.data ?? [];

  return (
    <div className="portal-shell">
      <PageHeader
        title="Persona Intelligence Portal"
        description="Group insights by company, model stakeholder personas, track proposal win/loss signals, and generate targeted communications for CTO, PO, Functional Tech Lead, and Tech Lead audiences."
        actions={
          <>
            <Link href="/admin">
              <Button>Prompt Admin</Button>
            </Link>
            <AuthIconButton />
            <ThemeToggle />
          </>
        }
      />

      <Row gutter={[20, 20]} className="metric-grid">
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

      <section className="workspace-panel">
        <Tabs
          className="portal-tabs"
          size="large"
          tabPlacement={screens.lg ? "start" : "top"}
          items={[
            {
              key: "companies",
              label: "Companies",
              children: <CompaniesTab />,
            },
            {
              key: "personas",
              label: "Personas",
              children: <PersonasTab />,
            },
            {
              key: "proposals",
              label: "Proposals & Stakeholders",
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
    </div>
  );
}
