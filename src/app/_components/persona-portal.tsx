"use client";

import { useMemo, useState } from "react";

import {
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";

import {
  COMMUNICATION_TYPE_OPTIONS,
  STAKEHOLDER_ROLE_OPTIONS,
  TABLE_PAGE_SIZE,
} from "./persona-portal.constants";
import {
  csvFromArray,
  mapCompanyOptions,
  mapPersonaOptions,
  mapProposalOptions,
  recommendationPreview,
  shouldCloseEditor,
} from "./persona-portal.helpers";
import { SearchSelect } from "./search-select";
import { api } from "~/trpc/react";

const { TextArea } = Input;
const { useBreakpoint } = Grid;

const buildProposalAnalysisTranslationSource = (input: {
  successSignals: string | null;
  failureSignals: string | null;
  recommendation: string | null;
}) => {
  return [
    "Success Signals",
    input.successSignals?.trim() || "—",
    "",
    "Failure Signals",
    input.failureSignals?.trim() || "—",
    "",
    "Recommendation",
    input.recommendation?.trim() || "—",
  ].join("\n");
};

export function PersonaPortal() {
  const [messageApi, contextHolder] = message.useMessage();
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showCreatePersona, setShowCreatePersona] = useState(false);
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [editingPersonaId, setEditingPersonaId] = useState<number | null>(null);
  const [editingProposalId, setEditingProposalId] = useState<number | null>(null);
  const [communicationModalPersonaId, setCommunicationModalPersonaId] = useState<number | null>(null);
  const [analyzePersonaModalId, setAnalyzePersonaModalId] = useState<number | null>(null);
  const [rfpAnalysisModalProposalId, setRfpAnalysisModalProposalId] = useState<number | null>(null);
  const [stakeholderModalProposalId, setStakeholderModalProposalId] = useState<number | null>(null);
  const [showManualEvaluation, setShowManualEvaluation] = useState(false);
  const [showGenerateComm, setShowGenerateComm] = useState(false);
  const [generatingFromEvaluationId, setGeneratingFromEvaluationId] = useState<number | null>(null);
  const [personaAnalysisTranslation, setPersonaAnalysisTranslation] = useState<string | null>(null);
  const [personaAnalysisViewMode, setPersonaAnalysisViewMode] = useState<"original" | "translated">("original");
  const [translatedProposalAnalyses, setTranslatedProposalAnalyses] = useState<Record<number, string>>({});
  const [proposalAnalysisViewModes, setProposalAnalysisViewModes] = useState<
    Record<number, "original" | "translated">
  >({});
  const [translatingProposalEvaluationId, setTranslatingProposalEvaluationId] = useState<number | null>(null);
  const [createCompanyForm] = Form.useForm();
  const [createPersonaForm] = Form.useForm();
  const [createProposalForm] = Form.useForm();
  const [editCompanyForm] = Form.useForm();
  const [editPersonaForm] = Form.useForm();
  const [editProposalForm] = Form.useForm();
  const [evaluationForm] = Form.useForm();
  const [generateCommForm] = Form.useForm();
  const [communicationForm] = Form.useForm();
  const [stakeholderForm] = Form.useForm();
  const utils = api.useUtils();
  const screens = useBreakpoint();

  const companiesQuery = api.company.list.useQuery();
  const personasQuery = api.persona.list.useQuery();
  const communicationsQuery = api.persona.listCommunications.useQuery();
  const proposalsQuery = api.proposal.list.useQuery();
  const generatedMessagesQuery = api.proposal.listGeneratedCommunications.useQuery();

  const companyMutation = api.company.create.useMutation({
    onSuccess: async () => {
      await utils.company.list.invalidate();
      createCompanyForm.resetFields();
      setShowCreateCompany(false);
      messageApi.success("Company created");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const companyUpdateMutation = api.company.update.useMutation({
    onSuccess: async () => {
      await utils.company.list.invalidate();
      setEditingCompanyId(null);
      messageApi.success("Company updated");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const personaMutation = api.persona.create.useMutation({
    onSuccess: async () => {
      await utils.persona.list.invalidate();
      createPersonaForm.resetFields();
      setShowCreatePersona(false);
      messageApi.success("Persona created");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const personaUpdateMutation = api.persona.update.useMutation({
    onSuccess: async () => {
      await utils.persona.list.invalidate();
      setEditingPersonaId(null);
      messageApi.success("Persona updated");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const communicationMutation = api.persona.addCommunication.useMutation({
    onSuccess: async () => {
      await utils.persona.listCommunications.invalidate();
      communicationForm.resetFields();
      setCommunicationModalPersonaId(null);
      messageApi.success("Communication record added");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const analyzePersonaMutation = api.persona.analyze.useMutation({
    onSuccess: async () => {
      await utils.persona.list.invalidate();
      setPersonaAnalysisTranslation(null);
      setPersonaAnalysisViewMode("original");
      messageApi.success("Persona analysis generated");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const translatePersonaAnalysisMutation = api.persona.translateAnalysis.useMutation({
    onError: (error) => messageApi.error(error.message),
  });

  const proposalMutation = api.proposal.create.useMutation({
    onSuccess: async () => {
      await utils.proposal.list.invalidate();
      createProposalForm.resetFields();
      setShowCreateProposal(false);
      messageApi.success("Proposal created");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const proposalUpdateMutation = api.proposal.update.useMutation({
    onSuccess: async () => {
      await utils.proposal.list.invalidate();
      setEditingProposalId(null);
      messageApi.success("Proposal updated");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const stakeholderMutation = api.proposal.addStakeholder.useMutation({
    onSuccess: async () => {
      await utils.proposal.list.invalidate();
      stakeholderForm.resetFields();
      setStakeholderModalProposalId(null);
      messageApi.success("Stakeholder link saved");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const evaluationMutation = api.proposal.evaluate.useMutation({
    onSuccess: async () => {
      await utils.proposal.list.invalidate();
      evaluationForm.resetFields();
      setShowManualEvaluation(false);
      messageApi.success("Proposal evaluation added");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const generationMutation = api.proposal.generateCommunicationTarget.useMutation({
    onSuccess: async () => {
      await utils.proposal.listGeneratedCommunications.invalidate();
      generateCommForm.resetFields();
      setShowGenerateComm(false);
      messageApi.success("Communication target generated");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const analyzeRfpMutation = api.proposal.analyzeRfp.useMutation({
    onSuccess: async () => {
      await utils.proposal.list.invalidate();
      setTranslatedProposalAnalyses({});
      setProposalAnalysisViewModes({});
      messageApi.success("AI RFP analysis generated and saved");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const translateProposalAnalysisMutation = api.proposal.translateAnalysis.useMutation({
    onError: (error) => messageApi.error(error.message),
  });

  const generateRfpProposalMutation = api.proposal.generateRfpProposalFromRecommendation.useMutation({
    onSuccess: async (result) => {
      await utils.proposal.list.invalidate();
      messageApi.success(
        `New proposal draft created: ${result?.proposal?.title ?? "Generated Proposal"}`
      );
    },
    onError: (error) => messageApi.error(error.message),
  });

  const deleteProposalMutation = api.proposal.delete.useMutation({
    onSuccess: async () => {
      await utils.proposal.list.invalidate();
      messageApi.success("Proposal deleted");
    },
    onError: (error) => messageApi.error(error.message),
  });

  const companies = companiesQuery.data ?? [];
  const personas = personasQuery.data ?? [];
  const proposals = proposalsQuery.data ?? [];
  const companyOptions = useMemo(() => mapCompanyOptions(companies), [companies]);
  const personaOptions = useMemo(() => mapPersonaOptions(personas), [personas]);
  const proposalOptions = useMemo(() => mapProposalOptions(proposals), [proposals]);
  const proposalById = useMemo(() => {
    return new Map(proposals.map((proposal) => [proposal.id, proposal]));
  }, [proposals]);

  const editingCompany = companies.find((company) => company.id === editingCompanyId) ?? null;
  const editingPersona = personas.find((persona) => persona.id === editingPersonaId) ?? null;
  const editingProposal = proposals.find((proposal) => proposal.id === editingProposalId) ?? null;
  const communicationModalPersona =
    communicationModalPersonaId === null
      ? null
      : personas.find((persona) => persona.id === communicationModalPersonaId) ?? null;
  const analyzePersonaModalPersona =
    analyzePersonaModalId === null
      ? null
      : personas.find((persona) => persona.id === analyzePersonaModalId) ?? null;
  const rfpModalProposal =
    rfpAnalysisModalProposalId === null ? null : proposalById.get(rfpAnalysisModalProposalId) ?? null;
  const latestRfpEvaluation = rfpModalProposal
    ? [...rfpModalProposal.evaluations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0] ?? null
    : null;
  const stakeholderModalProposal =
    stakeholderModalProposalId === null ? null : proposalById.get(stakeholderModalProposalId) ?? null;

  const closeCompanyEditor = () => {
    if (!shouldCloseEditor(editCompanyForm.isFieldsTouched(), "Discard unsaved company changes?")) {
      return;
    }
    setEditingCompanyId(null);
    editCompanyForm.resetFields();
  };

  const closeCreateCompanyModal = () => {
    if (!shouldCloseEditor(createCompanyForm.isFieldsTouched(), "Discard new company details?")) {
      return;
    }
    setShowCreateCompany(false);
    createCompanyForm.resetFields();
  };

  const closePersonaEditor = () => {
    if (!shouldCloseEditor(editPersonaForm.isFieldsTouched(), "Discard unsaved persona changes?")) {
      return;
    }
    setEditingPersonaId(null);
    editPersonaForm.resetFields();
  };

  const closeCreatePersonaModal = () => {
    if (!shouldCloseEditor(createPersonaForm.isFieldsTouched(), "Discard new persona details?")) {
      return;
    }
    setShowCreatePersona(false);
    createPersonaForm.resetFields();
  };

  const closeProposalEditor = () => {
    if (!shouldCloseEditor(editProposalForm.isFieldsTouched(), "Discard unsaved proposal changes?")) {
      return;
    }
    setEditingProposalId(null);
    editProposalForm.resetFields();
  };

  const closeCreateProposalModal = () => {
    if (!shouldCloseEditor(createProposalForm.isFieldsTouched(), "Discard new proposal details?")) {
      return;
    }
    setShowCreateProposal(false);
    createProposalForm.resetFields();
  };

  const closeCommunicationModal = () => {
    if (!shouldCloseEditor(communicationForm.isFieldsTouched(), "Discard new communication details?")) {
      return;
    }
    setCommunicationModalPersonaId(null);
    communicationForm.resetFields();
  };

  const openCompanyEditor = (company: (typeof companies)[number]) => {
    setEditingCompanyId(company.id);
    editCompanyForm.setFieldsValue({
      name: company.name,
      industry: company.industry ?? "",
      businessIntent: company.businessIntent ?? "",
      technologyIntent: company.technologyIntent ?? "",
      developmentStacks: csvFromArray(company.developmentStacks),
      certifications: csvFromArray(company.certifications),
      standards: csvFromArray(company.standards),
      partnerships: csvFromArray(company.partnerships),
      referenceArchitectures: csvFromArray(company.referenceArchitectures),
      engineeringGuidelines: csvFromArray(company.engineeringGuidelines),
    });
  };

  const openPersonaEditor = (persona: (typeof personas)[number]) => {
    setEditingPersonaId(persona.id);
    editPersonaForm.setFieldsValue({
      fullName: persona.fullName,
      email: persona.email ?? "",
      jobDescription: persona.jobDescription ?? "",
      personalitySummary: persona.personalitySummary ?? "",
      personalPreferences: persona.personalPreferences ?? "",
      pastExperiences: persona.pastExperiences ?? "",
    });
  };

  const openProposalEditor = (proposal: (typeof proposals)[number]) => {
    setEditingProposalId(proposal.id);
    editProposalForm.setFieldsValue({
      title: proposal.title,
      summary: proposal.summary ?? "",
      intentSignals: proposal.intentSignals ?? "",
      technologyFit: proposal.technologyFit ?? "",
    });
  };

  const proposalStatusColor = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized.includes("won") || normalized.includes("success")) return "success";
    if (normalized.includes("lost") || normalized.includes("fail")) return "error";
    if (normalized.includes("active") || normalized.includes("progress")) return "processing";
    return "default";
  };

  const outcomeColor = (outcome: string | null) => {
    if (outcome === "success") return "success";
    if (outcome === "failure") return "error";
    return "default";
  };

  const shortText = (value: string | null | undefined, max = 84) => {
    if (!value) return "No details";
    return value.length > max ? `${value.slice(0, max)}...` : value;
  };

  return (
    <div className="portal-shell">
      {contextHolder}

      <header className="hero-banner">
        <div className="hero-copy">
          <Typography.Title level={1} className="hero-title">
            Persona Intelligence Portal
          </Typography.Title>
          <Typography.Paragraph className="hero-description">
            Group insights by company, model stakeholder personas, track proposal win/loss signals,
            and generate targeted communications for CTO, PO, Functional Tech Lead, and Tech Lead
            audiences.
          </Typography.Paragraph>
        </div>
      </header>


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
              children: (
                <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                  <div className="section-toolbar">
                    <div>
                      <Typography.Title level={4} className="section-title">
                        Company Portfolio
                      </Typography.Title>
                      <Typography.Paragraph className="section-description">
                        Maintain strategic account context, industry alignment, technical posture, and
                        delivery standards in one view.
                      </Typography.Paragraph>
                    </div>
                    <Button type="primary" onClick={() => setShowCreateCompany(true)}>
                      Add New Company
                    </Button>
                  </div>

                  <Card title="Companies" className="data-card">
                    <Table
                      className="portal-table"
                      rowKey="id"
                      size="middle"
                      pagination={{ pageSize: TABLE_PAGE_SIZE }}
                      dataSource={companies}
                      columns={[
                        { title: "Name", dataIndex: "name" },
                        { title: "Industry", dataIndex: "industry" },
                        {
                          title: "Tech Stacks",
                          render: (_, row) => row.developmentStacks.join(", "),
                        },
                        {
                          title: "Certifications",
                          render: (_, row) => row.certifications.join(", "),
                        },
                        {
                          title: "Actions",
                          render: (_, row) => (
                            <Button size="small" onClick={() => openCompanyEditor(row)}>
                              Edit
                            </Button>
                          ),
                        },
                      ]}
                    />
                  </Card>
                </Space>
              ),
            },
            {
              key: "personas",
              label: "Personas",
              children: (
                <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                  <div className="section-toolbar">
                    <div>
                      <Typography.Title level={4} className="section-title">
                        Persona Coverage
                      </Typography.Title>
                      <Typography.Paragraph className="section-description">
                        Capture stakeholder profiles, communication history, and buyer behavior for
                        sharper decision support.
                      </Typography.Paragraph>
                    </div>
                    <Button type="primary" onClick={() => setShowCreatePersona(true)}>
                      Add New Persona
                    </Button>
                  </div>

                  <Card title="Personas" className="data-card">
                    <Table
                      className="portal-table"
                      rowKey="id"
                      size="middle"
                      pagination={{ pageSize: TABLE_PAGE_SIZE }}
                      dataSource={personas}
                      columns={[
                        {
                          title: "Persona",
                          render: (_, row) => (
                            <Space orientation="vertical" size={0}>
                              <Typography.Text strong>{row.fullName}</Typography.Text>
                              <Typography.Text type="secondary">{row.email ?? "No email"}</Typography.Text>
                            </Space>
                          ),
                        },
                        { title: "Company", render: (_, row) => row.company.name },
                        // { title: "Job", dataIndex: "jobDescription" },
                        // { title: "Personality", dataIndex: "personalitySummary" },
                        {
                          title: "Actions",
                          render: (_, row) => (
                            <Space size="small">
                              <Button size="small" onClick={() => openPersonaEditor(row)}>
                                Edit
                              </Button>
                              <Button size="small" onClick={() => setCommunicationModalPersonaId(row.id)}>
                                Add Communication
                              </Button>
                              <Button size="small" type="primary" onClick={() => setAnalyzePersonaModalId(row.id)}>
                                Analyze
                              </Button>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Card>

                  <Card title="Communications" className="data-card">
                    <Table
                      className="portal-table"
                      rowKey="id"
                      size="middle"
                      pagination={{ pageSize: TABLE_PAGE_SIZE }}
                      dataSource={communicationsQuery.data ?? []}
                      columns={[
                        {
                          title: "Persona",
                          render: (_, row) => row.persona.fullName,
                        },
                        {
                          title: "Company",
                          render: (_, row) => row.company.name,
                        },
                        {
                          title: "Type",
                          render: (_, row) => <Tag>{row.type}</Tag>,
                        },
                        { title: "Subject", dataIndex: "subject" },
                        {
                          title: "Excerpt",
                          render: (_, row) => row.content.slice(0, 120),
                        },
                      ]}
                    />
                  </Card>


                </Space>
              ),
            },
            {
              key: "proposals",
              label: "Proposals & Stakeholders",
              children: (
                <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                  <div className="section-toolbar">
                    <div>
                      <Typography.Title level={4} className="section-title">
                        Opportunity Governance
                      </Typography.Title>
                      <Typography.Paragraph className="section-description">
                        Review pipeline health, stakeholder alignment, and communication readiness at
                        proposal level.
                      </Typography.Paragraph>
                    </div>
                    <Button type="primary" onClick={() => setShowCreateProposal(true)}>
                      Add New Proposal
                    </Button>
                  </div>

                  <Card title="Proposals" className="data-card">
                    <Table
                      className="portal-table"
                      rowKey="id"
                      size="middle"
                      pagination={{ pageSize: TABLE_PAGE_SIZE }}
                      dataSource={proposals}
                      columns={[
                        {
                          title: "Opportunity",
                          render: (_, row) => (
                            <Space orientation="vertical" size={1}>
                              <Typography.Text strong>{row.title}</Typography.Text>
                              <Typography.Text type="secondary">
                                {shortText(row.summary, 92)}
                              </Typography.Text>
                            </Space>
                          ),
                        },
                        {
                          title: "Company",
                          render: (_, row) => row.company.name,
                        },
                        {
                          title: "Health",
                          render: (_, row) => (
                            <Space size={6} wrap>
                              <Tag color={proposalStatusColor(row.status)}>{row.status}</Tag>
                              <Tag color={outcomeColor(row.outcome)}>{row.outcome ?? "pending"}</Tag>
                            </Space>
                          ),
                        },
                        {
                          title: "Signals Snapshot",
                          render: (_, row) => (
                            <Space direction="vertical" size={1}>
                              <Typography.Text>{shortText(row.intentSignals, 78)}</Typography.Text>
                              <Typography.Text type="secondary">
                                Tech fit: {shortText(row.technologyFit, 64)}
                              </Typography.Text>
                            </Space>
                          ),
                        },
                        {
                          title: "Readiness",
                          render: (_, row) => {
                            const latestEvaluation = [...row.evaluations].sort(
                              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                            )[0];

                            if (!latestEvaluation) {
                              return <Typography.Text type="secondary">No evaluation</Typography.Text>;
                            }

                            return (
                              <Space direction="vertical" size={1}>
                                <Typography.Text>
                                  Success: <strong>{latestEvaluation.successScore}</strong>
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                  Risk: {latestEvaluation.failureRiskScore}
                                </Typography.Text>
                              </Space>
                            );
                          },
                        },
                        {
                          title: "Stakeholders",
                          render: (_, row) => row.stakeholders.length,
                        },
                        {
                          title: "Actions",
                          render: (_, row) => (
                            <Space size="small">
                              <Button size="small" onClick={() => openProposalEditor(row)}>
                                Edit
                              </Button>
                              <Button size="small" onClick={() => setStakeholderModalProposalId(row.id)}>
                                Link Stakeholder
                              </Button>
                              <Button
                                size="small"
                                type="default"
                                onClick={() => setRfpAnalysisModalProposalId(row.id)}
                              >
                                AI Analysis
                              </Button>
                              <Button
                                size="small"
                                danger
                                onClick={() => {
                                  Modal.confirm({
                                    title: "Delete Proposal",
                                    content: `Are you sure you want to delete "${row.title}"? This action cannot be undone.`,
                                    okText: "Delete",
                                    okType: "danger",
                                    cancelText: "Cancel",
                                    onOk() {
                                      deleteProposalMutation.mutate({ proposalId: row.id });
                                    },
                                  });
                                }}
                                loading={deleteProposalMutation.isPending}
                              >
                                Delete
                              </Button>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Card>

                  <Card
                    className="data-card"
                    title="Generated Communications"
                    extra={
                      <Button
                        type="default"
                        size="small"
                        onClick={() => setShowGenerateComm((v) => !v)}
                      >
                        {showGenerateComm ? "Cancel" : "Generate Communication"}
                      </Button>
                    }
                  >
                    {showGenerateComm ? (
                      <Form
                        form={generateCommForm}
                        layout="vertical"
                        onFinish={(values) => generationMutation.mutate(values)}
                        style={{ marginBottom: 16 }}
                      >
                        <Row gutter={12}>
                          <Col xs={24} md={8}>
                            <Form.Item name="proposalId" label="Proposal" rules={[{ required: true }]}>
                              <SearchSelect options={proposalOptions} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name="stakeholderRole" label="Role" rules={[{ required: true }]}>
                              <Select options={STAKEHOLDER_ROLE_OPTIONS} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name="personaId" label="Persona (optional)">
                              <SearchSelect allowClear options={personaOptions} />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Button type="primary" htmlType="submit" loading={generationMutation.isPending}>
                          Generate Message
                        </Button>
                      </Form>
                    ) : null}
                    <Table
                      className="portal-table"
                      rowKey="id"
                      size="middle"
                      pagination={{ pageSize: TABLE_PAGE_SIZE }}
                      dataSource={generatedMessagesQuery.data ?? []}
                      columns={[
                        {
                          title: "Proposal",
                          render: (_, row) => row.proposal.title,
                        },
                        {
                          title: "Role",
                          dataIndex: "stakeholderRole",
                        },
                        {
                          title: "Generation",
                          render: () => <Tag>AI-assisted</Tag>,
                        },
                        {
                          title: "Message",
                          render: (_, row) => row.generatedMessage.slice(0, 140),
                        },
                      ]}
                    />
                  </Card>
                </Space>
              ),
            },
          ]}
        />
      </section>

      <Modal
        open={showCreatePersona}
        title="Create Persona"
        onCancel={closeCreatePersonaModal}
        onOk={() => createPersonaForm.submit()}
        okText="Save Persona"
        confirmLoading={personaMutation.isPending}
        centered
        width={{
          xs: '90%',
          sm: '80%',
          md: '70%',
          lg: '60%',
          xl: '40%',
          xxl: '40%',
        }}
      >
        <Form
          form={createPersonaForm}
          layout="vertical"
          onFinish={(values) => personaMutation.mutate(values)}
        >
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="companyId" label="Company" rules={[{ required: true }]}>
                <SearchSelect options={companyOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
                <Input placeholder="Jane Doe" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="email" label="Email">
                <Input placeholder="jane@company.com" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="jobDescription" label="Job Description">
            <TextArea rows={2} placeholder="Role scope and accountability" />
          </Form.Item>
          <Form.Item name="personalitySummary" label="Personality Summary">
            <TextArea rows={2} placeholder="Analytical, risk-aware, collaborative" />
          </Form.Item>
          <Form.Item name="personalPreferences" label="Personal Preferences">
            <TextArea rows={2} placeholder="Prefers concise briefs and architecture diagrams" />
          </Form.Item>
          <Form.Item name="pastExperiences" label="Past Experiences">
            <TextArea rows={2} placeholder="Previous transformation projects and outcomes" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={showCreateProposal}
        title="Create Proposal"
        onCancel={closeCreateProposalModal}
        onOk={() => createProposalForm.submit()}
        okText="Save Proposal"
        confirmLoading={proposalMutation.isPending}
        centered
        width={{
          xs: '90%',
          sm: '80%',
          md: '70%',
          lg: '60%',
          xl: '40%',
          xxl: '40%',
        }}
      >
        <Form
          form={createProposalForm}
          layout="vertical"
          onFinish={(values) => proposalMutation.mutate(values)}
        >
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="companyId" label="Company" rules={[{ required: true }]}>
                <Select options={companyOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="title" label="Proposal Title" rules={[{ required: true }]}>
                <Input placeholder="AI-assisted modern data platform" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="summary" label="Summary">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="intentSignals" label="Intent Signals">
            <TextArea rows={2} placeholder="Recent RFP, migration program, executive initiative" />
          </Form.Item>
          <Form.Item name="technologyFit" label="Technology Fit">
            <TextArea rows={2} placeholder="Stack and platform compatibility with customer constraints" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={showCreateCompany}
        title="Create Company"
        onCancel={closeCreateCompanyModal}
        onOk={() => createCompanyForm.submit()}
        okText="Save Company"
        confirmLoading={companyMutation.isPending}
        centered
        width={{
          xs: '90%',
          sm: '80%',
          md: '70%',
          lg: '60%',
          xl: '40%',
          xxl: '40%',
        }}
      >
        <Form
          form={createCompanyForm}
          layout="vertical"
          onFinish={(values) => companyMutation.mutate(values)}
        >
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
                <Input placeholder="Contoso" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="industry" label="Industry">
                <Input placeholder="FinTech" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="businessIntent" label="Business Intent">
            <TextArea rows={2} placeholder="Growth targets, priorities, strategic goals" />
          </Form.Item>
          <Form.Item name="technologyIntent" label="Technology Intent">
            <TextArea rows={2} placeholder="Cloud modernization, AI adoption, data platform plans" />
          </Form.Item>
          <Form.Item name="developmentStacks" label="Development Stacks (comma separated)">
            <Input placeholder="Next.js, .NET, Azure Functions" />
          </Form.Item>
          <Form.Item name="certifications" label="Regulatory Certifications (comma separated)">
            <Input placeholder="ISO 27001, SOC2" />
          </Form.Item>
          <Form.Item name="standards" label="Standards (comma separated)">
            <Input placeholder="NIST, OWASP ASVS" />
          </Form.Item>
          <Form.Item name="partnerships" label="Technology Partnerships (comma separated)">
            <Input placeholder="Microsoft, AWS, Databricks" />
          </Form.Item>
          <Form.Item
            name="referenceArchitectures"
            label="Reference Architectures (comma separated)"
          >
            <Input placeholder="Azure Landing Zone, Microservices blueprint" />
          </Form.Item>
          <Form.Item name="engineeringGuidelines" label="Engineering Guidelines (comma separated)">
            <Input placeholder="Secure SDLC, API-first" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!editingCompany}
        title={editingCompany ? `Edit Company: ${editingCompany.name}` : "Edit Company"}
        onCancel={closeCompanyEditor}
        onOk={() => editCompanyForm.submit()}
        okText="Update Company"
        confirmLoading={companyUpdateMutation.isPending}
        centered
        width={{
          xs: '90%',
          sm: '80%',
          md: '70%',
          lg: '60%',
          xl: '40%',
          xxl: '40%',
        }}
      >
        <Form
          form={editCompanyForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editingCompany) return;
            companyUpdateMutation.mutate({
              id: editingCompany.id,
              ...values,
            });
          }}
        >
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="industry" label="Industry">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="businessIntent" label="Business Intent">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="technologyIntent" label="Technology Intent">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="developmentStacks" label="Development Stacks (comma separated)">
            <Input />
          </Form.Item>
          <Form.Item name="certifications" label="Regulatory Certifications (comma separated)">
            <Input />
          </Form.Item>
          <Form.Item name="standards" label="Standards (comma separated)">
            <Input />
          </Form.Item>
          <Form.Item name="partnerships" label="Technology Partnerships (comma separated)">
            <Input />
          </Form.Item>
          <Form.Item name="referenceArchitectures" label="Reference Architectures (comma separated)">
            <Input />
          </Form.Item>
          <Form.Item name="engineeringGuidelines" label="Engineering Guidelines (comma separated)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={communicationModalPersona !== null}
        title={
          communicationModalPersona
            ? `Add Communication: ${communicationModalPersona.fullName}`
            : "Add Communication"
        }
        onCancel={closeCommunicationModal}
        onOk={() => communicationForm.submit()}
        okText="Save Communication"
        confirmLoading={communicationMutation.isPending}
        centered
        width={{
          xs: '90%',
          sm: '80%',
          md: '70%',
          lg: '60%',
          xl: '40%',
          xxl: '40%',
        }}
      >
        {communicationModalPersona ? (
          <Typography.Text type="secondary">
            Company: {communicationModalPersona.company.name}
          </Typography.Text>
        ) : null}
        <Form
          form={communicationForm}
          layout="vertical"
          onFinish={(values) => {
            if (!communicationModalPersona) return;
            communicationMutation.mutate({
              companyId: communicationModalPersona.company.id,
              personaId: communicationModalPersona.id,
              ...values,
            });
          }}
          style={{ marginTop: 12 }}
        >
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={COMMUNICATION_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="subject" label="Subject">
            <Input placeholder="Quarterly architecture review" />
          </Form.Item>
          <Form.Item name="content" label="Content" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="Paste email, chat, meeting transcript, or notes" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!editingPersona}
        title={editingPersona ? `Edit Persona: ${editingPersona.fullName}` : "Edit Persona"}
        onCancel={closePersonaEditor}
        onOk={() => editPersonaForm.submit()}
        okText="Update Persona"
        confirmLoading={personaUpdateMutation.isPending}
        centered
        width={{
          xs: '90%',
          sm: '80%',
          md: '70%',
          lg: '60%',
          xl: '40%',
          xxl: '40%',
        }}
      >
        {editingPersona ? (
          <Typography.Text type="secondary">Company: {editingPersona.company.name}</Typography.Text>
        ) : null}
        <Form
          form={editPersonaForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editingPersona) return;
            personaUpdateMutation.mutate({
              id: editingPersona.id,
              ...values,
            });
          }}
          style={{ marginTop: 12 }}
        >
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="email" label="Email">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="jobDescription" label="Job Description">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="personalitySummary" label="Personality Summary">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="personalPreferences" label="Personal Preferences">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="pastExperiences" label="Past Experiences">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={analyzePersonaModalId !== null}
        title={
          analyzePersonaModalPersona
            ? `Analyze Persona: ${analyzePersonaModalPersona.fullName}`
            : "Analyze Persona"
        }
        onCancel={() => {
          setAnalyzePersonaModalId(null);
          setPersonaAnalysisTranslation(null);
          setPersonaAnalysisViewMode("original");
        }}
        width={{
          xs: "90%",
          sm: "80%",
          md: "70%",
          lg: "60%",
          xl: "50%",
          xxl: "50%",
        }}
        centered
        footer={[
          <Flex gap="small" wrap justify="end" key="footer" style={{ width: "100%" }}>
            <Button
              key="close"
              onClick={() => {
                setAnalyzePersonaModalId(null);
                setPersonaAnalysisTranslation(null);
                setPersonaAnalysisViewMode("original");
              }}
            >
              Close
            </Button>
            <Space.Compact key="persona-view-toggle">
              <Button
                type={personaAnalysisViewMode === "original" ? "primary" : "default"}
                disabled={personaAnalysisViewMode === "original"}
                onClick={() => setPersonaAnalysisViewMode("original")}
              >
                Show Original
              </Button>
              <Button
                type={personaAnalysisViewMode === "translated" ? "primary" : "default"}
                loading={translatePersonaAnalysisMutation.isPending}
                disabled={!analyzePersonaModalPersona?.analysis}
                onClick={() => {
                  if (!analyzePersonaModalPersona?.analysis) {
                    return;
                  }

                  if (personaAnalysisTranslation) {
                    setPersonaAnalysisViewMode("translated");
                    return;
                  }

                  translatePersonaAnalysisMutation.mutate(
                    { analysis: analyzePersonaModalPersona.analysis },
                    {
                      onSuccess: (result) => {
                        setPersonaAnalysisTranslation(result.translatedAnalysis);
                        setPersonaAnalysisViewMode("translated");
                        messageApi.success("Persona analysis translated to Spanish (LatAm)");
                      },
                    }
                  );
                }}
              >
                Show Translation
              </Button>
            </Space.Compact>
            <Button
              key="regenerate"
              type="primary"
              loading={analyzePersonaMutation.isPending}
              onClick={() => {
                if (analyzePersonaModalId) {
                  setPersonaAnalysisTranslation(null);
                  setPersonaAnalysisViewMode("original");
                  analyzePersonaMutation.mutate({ personaId: analyzePersonaModalId });
                }
              }}
            >
              Regenerate Analysis
            </Button>
          </Flex>
        ]}
      >
        {analyzePersonaModalPersona?.analysis ? (
          <div>
            <Typography.Paragraph style={{ marginBottom: 16 }}>
              <Typography.Text strong>
                {analyzePersonaModalPersona.fullName} ({analyzePersonaModalPersona.company.name})
              </Typography.Text>
            </Typography.Paragraph>
            <Card className="analysis-result-card" type="inner" style={{ marginBottom: 16 }}>
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                {personaAnalysisViewMode === "translated" && personaAnalysisTranslation
                  ? personaAnalysisTranslation
                  : analyzePersonaModalPersona.analysis}
              </Typography.Paragraph>
            </Card>
          </div>
        ) : (
          <Typography.Paragraph type="secondary">
            No analysis yet. Click "Regenerate Analysis" to generate one.
          </Typography.Paragraph>
        )}
      </Modal>

      <Modal
        open={!!editingProposal}
        title={editingProposal ? `Edit Proposal: ${editingProposal.title}` : "Edit Proposal"}
        onCancel={closeProposalEditor}
        onOk={() => editProposalForm.submit()}
        okText="Update Proposal"
        confirmLoading={proposalUpdateMutation.isPending}
        centered
        width={{
          xs: '90%',
          sm: '80%',
          md: '70%',
          lg: '60%',
          xl: '40%',
          xxl: '40%',
        }}
      >
        {editingProposal ? (
          <Typography.Text type="secondary">Company: {editingProposal.company.name}</Typography.Text>
        ) : null}
        <Form
          form={editProposalForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editingProposal) return;
            proposalUpdateMutation.mutate({
              proposalId: editingProposal.id,
              ...values,
            });
          }}
          style={{ marginTop: 12 }}
        >
          <Form.Item
            name="title"
            label="Proposal Title"
            rules={[{ required: true, message: "Title is required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="summary" label="Summary">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="intentSignals" label="Intent Signals">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="technologyFit" label="Technology Fit">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={stakeholderModalProposalId !== null}
        title={
          stakeholderModalProposal
            ? `Link Stakeholder: ${stakeholderModalProposal.title}`
            : "Link Stakeholder"
        }
        onCancel={() => {
          setStakeholderModalProposalId(null);
          stakeholderForm.resetFields();
        }}
        onOk={() => stakeholderForm.submit()}
        okText="Save Stakeholder Link"
        confirmLoading={stakeholderMutation.isPending}
        centered
        width={{
          xs: '90%',
          sm: '80%',
          md: '70%',
          lg: '60%',
          xl: '40%',
          xxl: '40%',
        }}
      >
        <Form
          form={stakeholderForm}
          layout="vertical"
          onFinish={(values) =>
            stakeholderMutation.mutate({
              proposalId: stakeholderModalProposalId!,
              ...values,
            })
          }
        >
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="personaId" label="Persona" rules={[{ required: true }]}>
                <SearchSelect options={personaOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="role" label="Stakeholder Role" rules={[{ required: true }]}>
                <Select options={STAKEHOLDER_ROLE_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="influenceLevel" label="Influence Level (1-5)" initialValue={3}>
                <InputNumber min={1} max={5} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="notes" label="Notes">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        open={rfpAnalysisModalProposalId !== null}
        title={`AI RFP Analysis: ${rfpModalProposal?.title ?? ""}`}
        onCancel={() => {
          setRfpAnalysisModalProposalId(null);
          setShowManualEvaluation(false);
          setTranslatedProposalAnalyses({});
          setProposalAnalysisViewModes({});
          setTranslatingProposalEvaluationId(null);
        }}
        footer={
          <Button
            onClick={() => {
              setRfpAnalysisModalProposalId(null);
              setShowManualEvaluation(false);
              setTranslatedProposalAnalyses({});
              setProposalAnalysisViewModes({});
              setTranslatingProposalEvaluationId(null);
            }}
          >
            Close
          </Button>
        }
        centered
        width={{
          xs: '90%',
          sm: '80%',
          md: '70%',
          lg: '60%',
          xl: '40%',
          xxl: '40%',
        }}      >
        {rfpModalProposal ? (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Typography.Text type="secondary">Company: {rfpModalProposal.company.name}</Typography.Text>
            <Space size="small" wrap>
              <Button
                type="primary"
                loading={analyzeRfpMutation.isPending}
                onClick={() => analyzeRfpMutation.mutate({ proposalId: rfpModalProposal.id })}
              >
                Run AI RFP Analysis
              </Button>
              <Button
                loading={generateRfpProposalMutation.isPending && generatingFromEvaluationId === latestRfpEvaluation?.id}
                disabled={!latestRfpEvaluation?.recommendation}
                onClick={() => {
                  if (!latestRfpEvaluation) return;
                  setGeneratingFromEvaluationId(latestRfpEvaluation.id);
                  generateRfpProposalMutation.mutate(
                    { proposalId: rfpModalProposal.id, evaluationId: latestRfpEvaluation.id },
                    { onSettled: () => setGeneratingFromEvaluationId(null) }
                  );
                }}
              >
                Generate New Proposal From Latest Recommendation
              </Button>
              <Button
                onClick={() => setShowManualEvaluation((v) => !v)}
              >
                {showManualEvaluation ? "Cancel Manual Evaluation" : "Add Manual Evaluation"}
              </Button>
            </Space>

            {showManualEvaluation ? (
              <Card size="small" title="Manual Evaluation">
                <Form
                  form={evaluationForm}
                  layout="vertical"
                  onFinish={(values) =>
                    evaluationMutation.mutate({ proposalId: rfpModalProposal.id, ...values })
                  }
                >
                  <Form.Item name="successSignals" label="Success Signals">
                    <TextArea rows={2} placeholder="Budget approval, architectural sponsorship" />
                  </Form.Item>
                  <Form.Item name="failureSignals" label="Failure Signals">
                    <TextArea rows={2} placeholder="Compliance blockers, timeline mismatch" />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="successScore"
                        label="Success Score (0-100)"
                        initialValue={65}
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={0} max={100} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="failureRiskScore"
                        label="Failure Risk Score (0-100)"
                        initialValue={35}
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={0} max={100} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="recommendation" label="Recommendation">
                    <TextArea rows={2} placeholder="Lead with phased implementation and compliance evidence" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={evaluationMutation.isPending}>
                    Save Evaluation
                  </Button>
                </Form>
              </Card>
            ) : null}

            {rfpModalProposal.evaluations.length > 0 ? (
              <>
                <Typography.Text strong>
                  Analysis History ({rfpModalProposal.evaluations.length})
                </Typography.Text>
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={[...rfpModalProposal.evaluations].sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )}
                  expandable={{
                    expandedRowRender: (row) => (
                      <Space direction="vertical" size="small" style={{ width: "100%" }}>
                        <Space.Compact size="small">
                          <Button
                            size="small"
                            type={proposalAnalysisViewModes[row.id] === "original" ? "primary" : "default"}
                            disabled={proposalAnalysisViewModes[row.id] === "original"}
                            onClick={() =>
                              setProposalAnalysisViewModes((current) => ({
                                ...current,
                                [row.id]: "original",
                              }))
                            }
                          >
                            Show Original
                          </Button>
                          <Button
                            size="small"
                            type={proposalAnalysisViewModes[row.id] === "translated" ? "primary" : "default"}
                            loading={translateProposalAnalysisMutation.isPending && translatingProposalEvaluationId === row.id}
                            onClick={() => {
                              if (translatedProposalAnalyses[row.id]) {
                                setProposalAnalysisViewModes((current) => ({
                                  ...current,
                                  [row.id]: "translated",
                                }));
                                return;
                              }

                              setTranslatingProposalEvaluationId(row.id);
                              translateProposalAnalysisMutation.mutate(
                                {
                                  analysis: buildProposalAnalysisTranslationSource({
                                    successSignals: row.successSignals,
                                    failureSignals: row.failureSignals,
                                    recommendation: row.recommendation,
                                  }),
                                },
                                {
                                  onSuccess: (result) => {
                                    setTranslatedProposalAnalyses((current) => ({
                                      ...current,
                                      [row.id]: result.translatedAnalysis,
                                    }));
                                    setProposalAnalysisViewModes((current) => ({
                                      ...current,
                                      [row.id]: "translated",
                                    }));
                                    messageApi.success("Proposal analysis translated to Spanish (LatAm)");
                                  },
                                  onSettled: () => setTranslatingProposalEvaluationId(null),
                                }
                              );
                            }}
                          >
                            Show Translation
                          </Button>
                        </Space.Compact>
                        {proposalAnalysisViewModes[row.id] === "translated" && translatedProposalAnalyses[row.id] ? (
                          <>
                            <Typography.Text strong>Español LATAM</Typography.Text>
                            <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                              {translatedProposalAnalyses[row.id]}
                            </Typography.Paragraph>
                          </>
                        ) : (
                          <>
                            <Typography.Text strong>Success Signals</Typography.Text>
                            <Typography.Paragraph style={{ marginBottom: 0 }}>
                              {row.successSignals ?? "—"}
                            </Typography.Paragraph>
                            <Typography.Text strong>Failure Signals</Typography.Text>
                            <Typography.Paragraph style={{ marginBottom: 0 }}>
                              {row.failureSignals ?? "—"}
                            </Typography.Paragraph>
                            <Typography.Text strong>Recommendation</Typography.Text>
                            <Typography.Paragraph style={{ marginBottom: 0 }}>
                              {row.recommendation ?? "—"}
                            </Typography.Paragraph>
                          </>
                        )}
                      </Space>
                    ),
                  }}
                  columns={[
                    {
                      title: "Date",
                      render: (_, row) => new Date(row.createdAt).toLocaleString(),
                    },
                    { title: "Success Score", dataIndex: "successScore" },
                    { title: "Failure Risk Score", dataIndex: "failureRiskScore" },
                    {
                      title: "Recommendation",
                      render: (_, row) => (
                        <Space direction="vertical" size={4} style={{ width: "100%" }}>
                          <Typography.Text>{recommendationPreview(row.recommendation)}</Typography.Text>
                          <Button
                            size="small"
                            disabled={!row.recommendation}
                            loading={
                              generateRfpProposalMutation.isPending &&
                              generatingFromEvaluationId === row.id
                            }
                            onClick={() => {
                              setGeneratingFromEvaluationId(row.id);
                              generateRfpProposalMutation.mutate(
                                {
                                  proposalId: rfpModalProposal.id,
                                  evaluationId: row.id,
                                },
                                { onSettled: () => setGeneratingFromEvaluationId(null) }
                              );
                            }}
                          >
                            Generate Proposal
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ) : (
              <Typography.Text type="secondary">
                No analyses yet. Click "Run AI RFP Analysis" to generate one.
              </Typography.Text>
            )}
          </Space>
        ) : null}
      </Modal>

      <Divider />
      <Typography.Text type="secondary">
        The current implementation persists persona intelligence and proposal outcomes so your team
        can personalize future outreach based on profile traits, communication history, and prior
        wins or losses per company.
      </Typography.Text>
    </div>
  );
}
