"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
    Button,
    Card,
    Col,
    Collapse,
    Dropdown,
    Empty,
    Flex,
    Form,
    Input,
    InputNumber,
    Modal,
    Row,
    Select,
    Space,
    Spin,
    Table,
    Tag,
    Typography,
    message,
} from "antd";
import { SendOutlined } from "@ant-design/icons";

import {
    STAKEHOLDER_ROLE_OPTIONS,
} from "~/app/_components/shared/persona-portal.constants";
import {
    mapCompanyOptions,
    mapPersonaOptions,
    recommendationPreview,
} from "~/app/_components/shared/persona-portal.helpers";
import { ReadAloudButton, SpeakableTextArea as TextArea } from "~/app/_components/shared/speakable-text-area";
import { SearchSelect } from "~/app/_components/shared/search-select";
import { ProposalMeetingNotes } from "~/app/_components/proposals/proposal-meeting-notes";
import { useModalAudioCleanup } from "~/app/_components/hooks/use-modal-audio-cleanup";
import { useModalTour } from "~/app/_components/hooks/use-modal-tour";
import { MODAL_WIDTH_NARROW, MODAL_WIDTH_WIDE, MODAL_WIDTH_EXTRA_WIDE, MODAL_WIDTH_MEDIUM } from "~/app/_components/shared/modal-widths";
import { SectionHeader } from "~/app/_components/shared/section-header";
import { DataCard } from "~/app/_components/shared/data-card";
import { FormModal } from "~/app/_components/shared/form-modal";
import { TranslationToggle } from "~/app/_components/shared/translation-toggle";
import { api } from "~/trpc/react";

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

export function ProposalsTab() {
    const [messageApi, contextHolder] = message.useMessage();
    const [modal, modalContextHolder] = Modal.useModal();

    // Modal visibility state
    const [showCreateProposal, setShowCreateProposal] = useState(false);
    const [editingProposalId, setEditingProposalId] = useState<number | null>(null);
    const [stakeholderModalProposalId, setStakeholderModalProposalId] = useState<number | null>(null);
    const [rfpAnalysisModalProposalId, setRfpAnalysisModalProposalId] = useState<number | null>(null);
    const [showManualEvaluation, setShowManualEvaluation] = useState(false);
    const [chatModalProposalId, setChatModalProposalId] = useState<number | null>(null);
    const [chatDraft, setChatDraft] = useState("");
    const [proposalDetailsModalId, setProposalDetailsModalId] = useState<number | null>(null);
    const [generateCommModalProposalId, setGenerateCommModalProposalId] = useState<number | null>(null);

    // Generated communication state
    const [selectedGeneratedCommunicationId, setSelectedGeneratedCommunicationId] = useState<number | null>(null);
    const [generatedCommunicationDraft, setGeneratedCommunicationDraft] = useState("");
    const [generateCommFormVersion, setGenerateCommFormVersion] = useState(0);
    const [generatingFromEvaluationId, setGeneratingFromEvaluationId] = useState<number | null>(null);

    // Translation state
    const [translatedProposalAnalyses, setTranslatedProposalAnalyses] = useState<Record<number, string>>({});
    const [proposalAnalysisViewModes, setProposalAnalysisViewModes] = useState<Record<number, "original" | "translated">>({});
    const [translatingProposalEvaluationId, setTranslatingProposalEvaluationId] = useState<number | null>(null);

    // Forms
    const [createForm] = Form.useForm();
    const [editForm] = Form.useForm();
    const [evaluationForm] = Form.useForm();
    const [stakeholderForm] = Form.useForm();
    const utils = api.useUtils();
    const chatLastMessageRef = useRef<HTMLDivElement | null>(null);

    // Queries
    const companiesQuery = api.company.list.useQuery();
    const personasQuery = api.persona.list.useQuery();
    const proposalsQuery = api.proposal.list.useQuery();
    const generatedMessagesQuery = api.proposal.listGeneratedCommunications.useQuery(
        generateCommModalProposalId !== null ? { proposalId: generateCommModalProposalId } : undefined,
        { enabled: generateCommModalProposalId !== null },
    );
    const proposalChatQuery = api.proposal.getChatSession.useQuery(
        { proposalId: chatModalProposalId ?? 1 },
        { enabled: chatModalProposalId !== null },
    );

    const companies = companiesQuery.data ?? [];
    const personas = personasQuery.data ?? [];
    const proposals = proposalsQuery.data ?? [];
    const companyOptions = useMemo(() => mapCompanyOptions(companies), [companies]);
    const personaOptions = useMemo(() => mapPersonaOptions(personas), [personas]);
    const proposalById = useMemo(() => new Map(proposals.map((p) => [p.id, p])), [proposals]);

    useModalAudioCleanup(useMemo(() => [
        showCreateProposal,
        editingProposalId !== null,
        stakeholderModalProposalId !== null,
        rfpAnalysisModalProposalId !== null,
        showManualEvaluation,
        chatModalProposalId !== null,
        proposalDetailsModalId !== null,
        generateCommModalProposalId !== null,
    ], [showCreateProposal, editingProposalId, stakeholderModalProposalId, rfpAnalysisModalProposalId, showManualEvaluation, chatModalProposalId, proposalDetailsModalId, generateCommModalProposalId]));

    const createProposalTour = useModalTour([
        { title: "Company & Title", description: "Select the target company and give the proposal a descriptive title." },
        { title: "Summary & Signals", description: "Provide an executive summary, intent signals from the customer, and technology fit notes to feed AI analysis." },
    ]);

    const editProposalTour = useModalTour([
        { title: "Update Proposal Details", description: "Modify the proposal title, summary, intent signals, or technology fit. Changes propagate to future AI evaluations." },
    ]);

    const stakeholderTour = useModalTour([
        { title: "Persona & Role", description: "Select which persona is a stakeholder on this proposal and assign their role (decision-maker, influencer, etc.)." },
        { title: "Influence & Notes", description: "Rate the stakeholder's influence level (1-5) and add optional context notes." },
    ]);

    const rfpAnalysisTour = useModalTour([
        { title: "AI RFP Analysis", description: "Run an AI analysis to score proposal success and failure signals, or add a manual evaluation." },
        { title: "Analysis History", description: "Expand any evaluation row to see success/failure signals, recommendations, and translation options." },
        { title: "Generate Proposal", description: "Use 'Generate Proposal' on any evaluation to create a new proposal draft from the recommendation." },
    ]);

    const manualEvaluationTour = useModalTour([
        { title: "Signals & Scores", description: "Describe success and failure signals, then assign numeric scores (0-100) for success likelihood and failure risk." },
        { title: "Recommendation", description: "Provide a strategic recommendation that can later be used to auto-generate a full proposal draft." },
    ]);

    const chatTour = useModalTour([
        { title: "Proposal Chat", description: "Chat with an AI assistant that has full context about this proposal, its stakeholders, and company." },
        { title: "Default Context", description: "Expand 'Default Context' to see the background information the AI uses for every response." },
        { title: "Send Messages", description: "Type a question and press Enter to send. Use Shift+Enter for newlines. Delete history to start fresh." },
    ]);

    const meetingNotesTour = useModalTour([
        { title: "Meeting Notes", description: "View and manage meeting notes associated with this proposal. Add new notes, speakers, and AI-generated summaries." },
    ]);

    const communicationsTour = useModalTour([
        { title: "Generate Communication", description: "Select a stakeholder role and optional persona to generate a tailored proposal communication." },
        { title: "Message Library", description: "Edit, duplicate, or delete generated messages. Click 'Save Changes' after editing to persist updates." },
    ]);

    // Mutations
    const createMutation = api.proposal.create.useMutation({
        onSuccess: async () => {
            await utils.proposal.list.invalidate();
            createForm.resetFields();
            setShowCreateProposal(false);
            messageApi.success("Proposal created");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const updateMutation = api.proposal.update.useMutation({
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
        onSuccess: async (result) => {
            await utils.proposal.listGeneratedCommunications.invalidate();
            setGenerateCommFormVersion((v) => v + 1);
            if (result) {
                setSelectedGeneratedCommunicationId(result.id);
            }
            messageApi.success("Communication target generated");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const updateGeneratedCommunicationMutation = api.proposal.updateGeneratedCommunication.useMutation({
        onSuccess: async () => {
            await utils.proposal.listGeneratedCommunications.invalidate();
            messageApi.success("Generated communication saved");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const duplicateGeneratedCommunicationMutation = api.proposal.duplicateGeneratedCommunication.useMutation({
        onSuccess: async (result) => {
            await utils.proposal.listGeneratedCommunications.invalidate();
            if (result) {
                setSelectedGeneratedCommunicationId(result.id);
            }
            messageApi.success("Generated communication duplicated");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const deleteGeneratedCommunicationMutation = api.proposal.deleteGeneratedCommunication.useMutation({
        onSuccess: async (_, input) => {
            await utils.proposal.listGeneratedCommunications.invalidate();
            if (selectedGeneratedCommunicationId === input.generatedCommunicationId) {
                setSelectedGeneratedCommunicationId(null);
            }
            messageApi.success("Generated communication deleted");
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
            messageApi.success(`New proposal draft created: ${result?.proposal?.title ?? "Generated Proposal"}`);
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

    const sendChatMessageMutation = api.proposal.sendChatMessage.useMutation({
        onSuccess: async () => {
            if (chatModalProposalId === null) return;
            await utils.proposal.getChatSession.invalidate({ proposalId: chatModalProposalId });
            setChatDraft("");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const resetChatHistoryMutation = api.proposal.resetChatHistory.useMutation({
        onSuccess: async () => {
            if (chatModalProposalId === null) return;
            await utils.proposal.getChatSession.invalidate({ proposalId: chatModalProposalId });
            setChatDraft("");
            messageApi.success("Chat history deleted. Default context is ready for a new conversation.");
        },
        onError: (error) => messageApi.error(error.message),
    });

    // Derived state
    const editingProposal = proposals.find((p) => p.id === editingProposalId) ?? null;
    const rfpModalProposal = rfpAnalysisModalProposalId === null ? null : proposalById.get(rfpAnalysisModalProposalId) ?? null;
    const latestRfpEvaluation = rfpModalProposal
        ? [...rfpModalProposal.evaluations].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0] ?? null
        : null;
    const stakeholderModalProposal = stakeholderModalProposalId === null ? null : proposalById.get(stakeholderModalProposalId) ?? null;
    const chatModalProposal = chatModalProposalId === null ? null : proposalById.get(chatModalProposalId) ?? null;
    const chatMessages = proposalChatQuery.data?.messages ?? [];
    const proposalDetailsModalProposal = proposalDetailsModalId === null ? null : proposalById.get(proposalDetailsModalId) ?? null;
    const generateCommModalProposal = generateCommModalProposalId === null ? null : proposalById.get(generateCommModalProposalId) ?? null;
    const proposalGeneratedMessages = generatedMessagesQuery.data ?? [];
    const selectedGeneratedCommunication =
        selectedGeneratedCommunicationId === null
            ? null
            : proposalGeneratedMessages.find((item) => item.id === selectedGeneratedCommunicationId) ?? null;

    // Effects
    useEffect(() => {
        if (generateCommModalProposalId === null) {
            setSelectedGeneratedCommunicationId(null);
            setGeneratedCommunicationDraft("");
        }
    }, [generateCommModalProposalId]);

    useEffect(() => {
        if (proposalGeneratedMessages.length === 0) {
            setSelectedGeneratedCommunicationId(null);
            setGeneratedCommunicationDraft("");
            return;
        }

        const hasSelected = proposalGeneratedMessages.some(
            (item) => item.id === selectedGeneratedCommunicationId,
        );

        if (!hasSelected) {
            setSelectedGeneratedCommunicationId(proposalGeneratedMessages[0]?.id ?? null);
        }
    }, [proposalGeneratedMessages, selectedGeneratedCommunicationId]);

    useEffect(() => {
        setGeneratedCommunicationDraft(selectedGeneratedCommunication?.generatedMessage ?? "");
    }, [selectedGeneratedCommunication]);

    useEffect(() => {
        if (chatModalProposalId === null || chatMessages.length === 0) return;

        const frameId = requestAnimationFrame(() => {
            chatLastMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        return () => cancelAnimationFrame(frameId);
    }, [chatMessages, chatModalProposalId]);

    // Handlers
    const openEditor = (proposal: (typeof proposals)[number]) => {
        setEditingProposalId(proposal.id);
        editForm.setFieldsValue({
            title: proposal.title,
            summary: proposal.summary ?? "",
            intentSignals: proposal.intentSignals ?? "",
            technologyFit: proposal.technologyFit ?? "",
        });
    };

    const closeEditor = () => {
        setEditingProposalId(null);
        editForm.resetFields();
    };

    const closeCreateModal = () => {
        setShowCreateProposal(false);
        createForm.resetFields();
    };

    const closeRfpModal = () => {
        setRfpAnalysisModalProposalId(null);
        setShowManualEvaluation(false);
        setTranslatedProposalAnalyses({});
        setProposalAnalysisViewModes({});
        setTranslatingProposalEvaluationId(null);
    };

    return (
        <>
            {contextHolder}
            {modalContextHolder}

            <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                <SectionHeader
                    title="Opportunity Governance"
                    description="Review pipeline health, stakeholder alignment, and communication readiness at proposal level."
                    actionLabel="Add New Proposal"
                    onAction={() => setShowCreateProposal(true)}
                />

                <DataCard
                    title="Proposals"
                    dataSource={proposals}
                    loading={proposalsQuery.isLoading}
                    columns={[
                        {
                            title: "Opportunity",
                            render: (_, row) => (
                                <Space orientation="vertical" size={1}>
                                    <Typography.Text strong>{row.title}</Typography.Text>
                                    <Typography.Text type="secondary">{shortText(row.summary, 92)}</Typography.Text>
                                </Space>
                            ),
                        },
                        { title: "Company", render: (_, row) => row.company.name },
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
                                <Space orientation="vertical" size={1}>
                                    <Typography.Text>{shortText(row.intentSignals, 78)}</Typography.Text>
                                    <Typography.Text type="secondary">Tech fit: {shortText(row.technologyFit, 64)}</Typography.Text>
                                </Space>
                            ),
                        },
                        {
                            title: "Readiness",
                            render: (_, row) => {
                                const latestEvaluation = [...row.evaluations].sort(
                                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                                )[0];

                                if (!latestEvaluation) {
                                    return <Typography.Text type="secondary">No evaluation</Typography.Text>;
                                }

                                return (
                                    <Space orientation="vertical" size={1}>
                                        <Typography.Text>Success: <strong>{latestEvaluation.successScore}</strong></Typography.Text>
                                        <Typography.Text type="secondary">Risk: {latestEvaluation.failureRiskScore}</Typography.Text>
                                    </Space>
                                );
                            },
                        },
                        { title: "Stakeholders", render: (_, row) => row.stakeholders.length },
                        {
                            title: "Actions",
                            render: (_, row) => {
                                const actionMenuItems = [
                                    { key: "link-stakeholder", label: "Link Stakeholder", onClick: () => setStakeholderModalProposalId(row.id) },
                                    { key: "ai-analysis", label: "AI Analysis", onClick: () => setRfpAnalysisModalProposalId(row.id) },
                                    { key: "chat", label: "Chat", onClick: () => setChatModalProposalId(row.id) },
                                    { key: "notes", label: "Notes", onClick: () => setProposalDetailsModalId(row.id) },
                                    { key: "generate-comm", label: "Communications", onClick: () => setGenerateCommModalProposalId(row.id) },
                                    { type: "divider" as const },
                                    {
                                        key: "delete",
                                        label: "Delete",
                                        danger: true,
                                        onClick: () => {
                                            modal.confirm({
                                                title: "Delete Proposal",
                                                content: `Are you sure you want to delete "${row.title}"? This action cannot be undone.`,
                                                okText: "Delete",
                                                okType: "danger",
                                                cancelText: "Cancel",
                                                onOk() {
                                                    deleteProposalMutation.mutate({ proposalId: row.id });
                                                },
                                            });
                                        },
                                    },
                                ];

                                return (
                                    <Space size="small">
                                        <Button size="small" onClick={() => openEditor(row)}>Edit</Button>
                                        <Dropdown menu={{ items: actionMenuItems as any }} placement="bottomRight" trigger={["click"]}>
                                            <Button size="small">More</Button>
                                        </Dropdown>
                                    </Space>
                                );
                            },
                        },
                    ]}
                />
            </Space>

            <FormModal
                open={showCreateProposal}
                title="Create Proposal"
                onCancel={closeCreateModal}
                form={createForm}
                onFinish={(values) => createMutation.mutate(values)}
                okText="Save Proposal"
                confirmLoading={createMutation.isPending}
                width={MODAL_WIDTH_MEDIUM}
                extra={<createProposalTour.HelpButton />}
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
                    <TextArea autoSize={{ minRows: 2 }} />
                </Form.Item>
                <Form.Item name="intentSignals" label="Intent Signals">
                    <TextArea autoSize={{ minRows: 2 }} placeholder="Recent RFP, migration program, executive initiative" />
                </Form.Item>
                <Form.Item name="technologyFit" label="Technology Fit">
                    <TextArea autoSize={{ minRows: 2 }} placeholder="Stack and platform compatibility with customer constraints" />
                </Form.Item>
            </FormModal>

            <FormModal
                open={!!editingProposal}
                title="Edit Proposal"
                onCancel={closeEditor}
                form={editForm}
                onFinish={(values) => {
                    if (!editingProposal) return;
                    updateMutation.mutate({ proposalId: editingProposal.id, ...values });
                }}
                okText="Update Proposal"
                confirmLoading={updateMutation.isPending}
                width={MODAL_WIDTH_MEDIUM}
                subtitle={editingProposal ? `${editingProposal.title} · ${editingProposal.company.name}` : null}
                extra={<editProposalTour.HelpButton />}
            >
                <Form.Item name="title" label="Proposal Title" rules={[{ required: true, message: "Title is required" }]}>
                    <Input />
                </Form.Item>
                <Form.Item name="summary" label="Summary">
                    <TextArea autoSize={{ minRows: 2 }} />
                </Form.Item>
                <Form.Item name="intentSignals" label="Intent Signals">
                    <TextArea autoSize={{ minRows: 2 }} />
                </Form.Item>
                <Form.Item name="technologyFit" label="Technology Fit">
                    <TextArea autoSize={{ minRows: 2 }} />
                </Form.Item>
            </FormModal>

            <FormModal
                open={stakeholderModalProposalId !== null}
                title="Link Stakeholder"
                onCancel={() => { setStakeholderModalProposalId(null); stakeholderForm.resetFields(); }}
                form={stakeholderForm}
                onFinish={(values) => stakeholderMutation.mutate({ proposalId: stakeholderModalProposalId!, ...values })}
                okText="Save Stakeholder Link"
                confirmLoading={stakeholderMutation.isPending}
                width={MODAL_WIDTH_MEDIUM}
                subtitle={stakeholderModalProposal?.title}
                extra={<stakeholderTour.HelpButton />}
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
            </FormModal>

            {/* AI RFP Analysis Modal */}
            <Modal
                open={rfpAnalysisModalProposalId !== null}
                title={
                    <Flex align="center" gap={4}>
                        <span>{`AI RFP Analysis: ${rfpModalProposal?.title ?? ""}`}</span>
                        <rfpAnalysisTour.HelpButton />
                    </Flex>
                }
                onCancel={closeRfpModal}
                footer={<Button onClick={closeRfpModal}>Close</Button>}
                centered
                width={MODAL_WIDTH_MEDIUM}
            >
                {rfpModalProposal ? (
                    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                        <Typography.Text type="secondary">Company: {rfpModalProposal.company.name}</Typography.Text>
                        <Dropdown
                            trigger={["click"]}
                            menu={{
                                items: [
                                    { key: "run-analysis", label: "Run AI RFP Analysis" },
                                    {
                                        key: "generate-latest",
                                        label: "Generate New Proposal From Latest Recommendation",
                                        disabled: !latestRfpEvaluation?.recommendation || (generateRfpProposalMutation.isPending && generatingFromEvaluationId === latestRfpEvaluation?.id),
                                    },
                                    { key: "manual-evaluation", label: "Add Manual Evaluation" },
                                ],
                                onClick: ({ key }) => {
                                    if (key === "run-analysis") {
                                        analyzeRfpMutation.mutate({ proposalId: rfpModalProposal.id });
                                        return;
                                    }

                                    if (key === "generate-latest") {
                                        if (!latestRfpEvaluation) return;
                                        setGeneratingFromEvaluationId(latestRfpEvaluation.id);
                                        generateRfpProposalMutation.mutate(
                                            { proposalId: rfpModalProposal.id, evaluationId: latestRfpEvaluation.id },
                                            { onSettled: () => setGeneratingFromEvaluationId(null) },
                                        );
                                        return;
                                    }

                                    if (key === "manual-evaluation") {
                                        setShowManualEvaluation(true);
                                    }
                                },
                            }}
                        >
                            <Button
                                type="primary"
                                loading={analyzeRfpMutation.isPending || (generateRfpProposalMutation.isPending && generatingFromEvaluationId === latestRfpEvaluation?.id)}
                            >
                                Actions
                            </Button>
                        </Dropdown>

                        {rfpModalProposal.evaluations.length > 0 ? (
                            <>
                                <Typography.Text strong>Analysis History ({rfpModalProposal.evaluations.length})</Typography.Text>
                                <Table
                                    rowKey="id"
                                    size="small"
                                    pagination={false}
                                    dataSource={[...rfpModalProposal.evaluations].sort(
                                        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                                    )}
                                    expandable={{
                                        expandedRowRender: (row) => (
                                            <Space orientation="vertical" size="small" style={{ width: "100%" }}>
                                                <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                                                    <TranslationToggle
                                                        viewMode={proposalAnalysisViewModes[row.id] === "translated" ? "translated" : "original"}
                                                        onShowOriginal={() => setProposalAnalysisViewModes((c) => ({ ...c, [row.id]: "original" }))}
                                                        onShowTranslation={() => {
                                                            if (translatedProposalAnalyses[row.id]) {
                                                                setProposalAnalysisViewModes((c) => ({ ...c, [row.id]: "translated" }));
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
                                                                        setTranslatedProposalAnalyses((c) => ({ ...c, [row.id]: result.translatedAnalysis }));
                                                                        setProposalAnalysisViewModes((c) => ({ ...c, [row.id]: "translated" }));
                                                                        messageApi.success("Proposal analysis translated to Spanish (LatAm)");
                                                                    },
                                                                    onSettled: () => setTranslatingProposalEvaluationId(null),
                                                                },
                                                            );
                                                        }}
                                                        translating={translateProposalAnalysisMutation.isPending && translatingProposalEvaluationId === row.id}
                                                        size="small"
                                                    />
                                                    <ReadAloudButton
                                                        text={
                                                            proposalAnalysisViewModes[row.id] === "translated" && translatedProposalAnalyses[row.id]
                                                                ? translatedProposalAnalyses[row.id]
                                                                : buildProposalAnalysisTranslationSource({
                                                                    successSignals: row.successSignals,
                                                                    failureSignals: row.failureSignals,
                                                                    recommendation: row.recommendation,
                                                                })
                                                        }
                                                    />
                                                </Flex>
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
                                                        <Typography.Paragraph style={{ marginBottom: 0 }}>{row.successSignals ?? "—"}</Typography.Paragraph>
                                                        <Typography.Text strong>Failure Signals</Typography.Text>
                                                        <Typography.Paragraph style={{ marginBottom: 0 }}>{row.failureSignals ?? "—"}</Typography.Paragraph>
                                                        <Typography.Text strong>Recommendation</Typography.Text>
                                                        <Typography.Paragraph style={{ marginBottom: 0 }}>{row.recommendation ?? "—"}</Typography.Paragraph>
                                                    </>
                                                )}
                                            </Space>
                                        ),
                                    }}
                                    columns={[
                                        { title: "Date", render: (_, row) => new Date(row.createdAt).toLocaleString() },
                                        { title: "Success Score", dataIndex: "successScore" },
                                        { title: "Failure Risk Score", dataIndex: "failureRiskScore" },
                                        {
                                            title: "Recommendation",
                                            render: (_, row) => (
                                                <Space orientation="vertical" size={4} style={{ width: "100%" }}>
                                                    <Typography.Text>{recommendationPreview(row.recommendation)}</Typography.Text>
                                                    <Button
                                                        size="small"
                                                        disabled={!row.recommendation}
                                                        loading={generateRfpProposalMutation.isPending && generatingFromEvaluationId === row.id}
                                                        onClick={() => {
                                                            setGeneratingFromEvaluationId(row.id);
                                                            generateRfpProposalMutation.mutate(
                                                                { proposalId: rfpModalProposal.id, evaluationId: row.id },
                                                                { onSettled: () => setGeneratingFromEvaluationId(null) },
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
                                No analyses yet. Click &quot;Run AI RFP Analysis&quot; to generate one.
                            </Typography.Text>
                        )}
                    </Space>
                ) : null}
            </Modal>

            <FormModal
                open={showManualEvaluation && rfpModalProposal !== null}
                title="Manual Evaluation"
                onCancel={() => setShowManualEvaluation(false)}
                form={evaluationForm}
                onFinish={(values) => {
                    if (!rfpModalProposal) return;
                    evaluationMutation.mutate({ proposalId: rfpModalProposal.id, ...values });
                }}
                okText="Save Evaluation"
                confirmLoading={evaluationMutation.isPending}
                width={MODAL_WIDTH_MEDIUM}
                subtitle={rfpModalProposal?.title}
                extra={<manualEvaluationTour.HelpButton />}
            >
                <Form.Item name="successSignals" label="Success Signals">
                    <TextArea autoSize={{ minRows: 2 }} placeholder="Budget approval, architectural sponsorship" />
                </Form.Item>
                <Form.Item name="failureSignals" label="Failure Signals">
                    <TextArea autoSize={{ minRows: 2 }} placeholder="Compliance blockers, timeline mismatch" />
                </Form.Item>
                <Row gutter={12}>
                    <Col xs={24} md={12}>
                        <Form.Item name="successScore" label="Success Score (0-100)" initialValue={65} rules={[{ required: true }]}>
                            <InputNumber min={0} max={100} style={{ width: "100%" }} />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                        <Form.Item name="failureRiskScore" label="Failure Risk Score (0-100)" initialValue={35} rules={[{ required: true }]}>
                            <InputNumber min={0} max={100} style={{ width: "100%" }} />
                        </Form.Item>
                    </Col>
                </Row>
                <Form.Item name="recommendation" label="Recommendation">
                    <TextArea autoSize={{ minRows: 2 }} placeholder="Lead with phased implementation and compliance evidence" />
                </Form.Item>
            </FormModal>

            {/* Chat Modal */}
            <Modal
                open={chatModalProposalId !== null}
                title={
                    <Flex align="center" gap={4}>
                        <span>{chatModalProposal ? `Proposal Chat: ${chatModalProposal.title}` : "Proposal Chat"}</span>
                        <chatTour.HelpButton />
                    </Flex>
                }
                onCancel={() => { setChatModalProposalId(null); setChatDraft(""); }}
                footer={
                    <Flex justify="end" gap="small" style={{ width: "100%" }}>
                        <Button
                            danger
                            type="text"
                            loading={resetChatHistoryMutation.isPending}
                            disabled={chatModalProposalId === null}
                            onClick={() => {
                                if (chatModalProposalId === null) return;
                                modal.confirm({
                                    title: "Delete chat history?",
                                    content: "This will clear all messages and restart from the default context.",
                                    okText: "Delete & Restart",
                                    okType: "danger",
                                    cancelText: "Cancel",
                                    onOk() {
                                        resetChatHistoryMutation.mutate({ proposalId: chatModalProposalId });
                                    },
                                });
                            }}
                        >
                            Delete History & Restart
                        </Button>
                        <Button onClick={() => { setChatModalProposalId(null); setChatDraft(""); }}>
                            Close
                        </Button>
                    </Flex>
                }
                centered
                width={MODAL_WIDTH_WIDE}
            >
                {chatModalProposalId !== null ? (
                    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                        <Collapse
                            items={[{
                                key: "default-context",
                                label: "Default Context (Proposal + Stakeholders + Company)",
                                children: (
                                    <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                                        {proposalChatQuery.data?.session.defaultContext ?? "Loading proposal context..."}
                                    </Typography.Paragraph>
                                ),
                            }]}
                        />

                        <Card size="small" title="Conversation">
                            {proposalChatQuery.isLoading ? (
                                <Flex justify="center" style={{ padding: 24 }}><Spin /></Flex>
                            ) : chatMessages.length === 0 ? (
                                <Typography.Text type="secondary">
                                    No chat history yet. Ask a question to start from the default context.
                                </Typography.Text>
                            ) : (
                                <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
                                    <Space orientation="vertical" size="small" style={{ width: "100%" }}>
                                        {chatMessages.map((msg, index) => (
                                            <div key={msg.id} ref={index === chatMessages.length - 1 ? chatLastMessageRef : undefined}>
                                                <Card size="small" type="inner">
                                                    <Space orientation="vertical" size={4} style={{ width: "100%" }}>
                                                        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                                                            <Tag color={msg.role === "assistant" ? "blue" : "green"}>
                                                                {msg.role === "assistant" ? "Assistant" : "You"}
                                                            </Tag>
                                                            <ReadAloudButton text={msg.content} />
                                                        </Flex>
                                                        <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                                                            {msg.content}
                                                        </Typography.Paragraph>
                                                    </Space>
                                                </Card>
                                            </div>
                                        ))}
                                    </Space>
                                </div>
                            )}
                        </Card>

                        <Form
                            layout="vertical"
                            onFinish={() => {
                                if (chatModalProposalId === null || !chatDraft.trim()) return;
                                sendChatMessageMutation.mutate({ proposalId: chatModalProposalId, message: chatDraft.trim() });
                            }}
                        >
                            <Form.Item
                                label="Message"
                                extra={<Typography.Text type="secondary">Press Enter to send. Use Shift+Enter for a newline.</Typography.Text>}
                            >
                                <Flex align="end" gap="small">
                                    <TextArea
                                        value={chatDraft}
                                        onChange={(event) => setChatDraft(event.target.value)}
                                        onPressEnter={(event) => {
                                            if (event.shiftKey) return;
                                            event.preventDefault();
                                            if (chatModalProposalId === null || !chatDraft.trim() || sendChatMessageMutation.isPending) return;
                                            sendChatMessageMutation.mutate({ proposalId: chatModalProposalId, message: chatDraft.trim() });
                                        }}
                                        autoSize={{ minRows: 1, maxRows: 6 }}
                                        style={{ flex: 1 }}
                                        disabled={sendChatMessageMutation.isPending}
                                        placeholder="Ask about strategy, stakeholder-specific talking points, risk handling, or proposal positioning..."
                                    />
                                    <Button
                                        htmlType="submit"
                                        type="primary"
                                        icon={<SendOutlined />}
                                        aria-label="Send message"
                                        loading={sendChatMessageMutation.isPending}
                                        disabled={chatModalProposalId === null || !chatDraft.trim()}
                                    />
                                </Flex>
                            </Form.Item>
                        </Form>
                    </Space>
                ) : null}
            </Modal>

            {/* Proposal Details / Meeting Notes Modal */}
            <Modal
                open={proposalDetailsModalId !== null}
                title={
                    <Flex align="center" gap={4}>
                        <span>{proposalDetailsModalProposal ? `${proposalDetailsModalProposal.title} - Meeting Notes` : "Proposal Details"}</span>
                        <meetingNotesTour.HelpButton />
                    </Flex>
                }
                onCancel={() => setProposalDetailsModalId(null)}
                footer={<Button onClick={() => setProposalDetailsModalId(null)}>Close</Button>}
                centered
                width={MODAL_WIDTH_WIDE}
            >
                {proposalDetailsModalProposal ? (
                    <ProposalMeetingNotes
                        proposalId={proposalDetailsModalProposal.id}
                        proposal={proposalDetailsModalProposal}
                    />
                ) : null}
            </Modal>

            {/* Generated Communications Modal */}
            <Modal
                open={generateCommModalProposalId !== null}
                title={
                    <Flex align="center" gap={4}>
                        <span>{generateCommModalProposal ? `${generateCommModalProposal.title} - Communications` : "Communications"}</span>
                        <communicationsTour.HelpButton />
                    </Flex>
                }
                onCancel={() => setGenerateCommModalProposalId(null)}
                footer={<Button onClick={() => setGenerateCommModalProposalId(null)}>Close</Button>}
                centered
                width={MODAL_WIDTH_EXTRA_WIDE}
            >
                <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                    <Card size="small" type="inner" title="Generate New Communication">
                        {generateCommModalProposal ? (
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                                Generate a proposal-specific communication for {generateCommModalProposal.company.name}.
                            </Typography.Paragraph>
                        ) : null}
                        <Form
                            key={`${generateCommModalProposalId ?? "closed"}-${generateCommFormVersion}`}
                            layout="vertical"
                            initialValues={{ proposalId: generateCommModalProposalId ?? undefined }}
                            preserve={false}
                            onFinish={(values) => generationMutation.mutate(values)}
                        >
                            <Form.Item name="proposalId" hidden>
                                <InputNumber />
                            </Form.Item>
                            <Row gutter={12}>
                                <Col xs={24} md={12}>
                                    <Form.Item name="stakeholderRole" label="Role" rules={[{ required: true }]}>
                                        <Select options={STAKEHOLDER_ROLE_OPTIONS} placeholder="Select stakeholder role" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item name="personaId" label="Persona (optional)">
                                        <SearchSelect allowClear options={personaOptions} />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Button type="primary" htmlType="submit" loading={generationMutation.isPending}>
                                Generate Message
                            </Button>
                        </Form>
                    </Card>

                    <Card size="small" type="inner" title={`Generated Messages (${proposalGeneratedMessages.length})`}>
                        {generatedMessagesQuery.isLoading ? (
                            <Flex justify="center" style={{ padding: 24 }}><Spin /></Flex>
                        ) : proposalGeneratedMessages.length === 0 ? (
                            <Empty description="No generated communications for this proposal yet." />
                        ) : (
                            <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                                {proposalGeneratedMessages.map((item) => {
                                    const isSelected = item.id === selectedGeneratedCommunicationId;
                                    const isDeleting =
                                        deleteGeneratedCommunicationMutation.isPending &&
                                        deleteGeneratedCommunicationMutation.variables?.generatedCommunicationId === item.id;
                                    const isDuplicating =
                                        duplicateGeneratedCommunicationMutation.isPending &&
                                        duplicateGeneratedCommunicationMutation.variables?.generatedCommunicationId === item.id;
                                    const hasChanges = isSelected &&
                                        generatedCommunicationDraft.trim() &&
                                        generatedCommunicationDraft.trim() !== item.generatedMessage.trim();

                                    return (
                                        <Card key={item.id} size="small" style={{ borderColor: isSelected ? "#1677ff" : undefined }}>
                                            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
                                                <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                                                    <Space size={8} wrap>
                                                        <Tag color="blue">{item.stakeholderRole}</Tag>
                                                        {item.persona ? <Tag>{item.persona.fullName}</Tag> : null}
                                                        <Typography.Text type="secondary">
                                                            {new Date(item.createdAt).toLocaleString()}
                                                        </Typography.Text>
                                                    </Space>
                                                    <Space size="small" wrap>
                                                        {isSelected ? (
                                                            <>
                                                                <Button size="small" onClick={() => setSelectedGeneratedCommunicationId(item.id)}>
                                                                    Edit
                                                                </Button>
                                                                {hasChanges && (
                                                                    <Button size="small" onClick={() => {
                                                                        setSelectedGeneratedCommunicationId(null);
                                                                        setGeneratedCommunicationDraft("");
                                                                    }}>
                                                                        Cancel
                                                                    </Button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <Button size="small" onClick={() => setSelectedGeneratedCommunicationId(item.id)}>
                                                                Edit
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="small"
                                                            onClick={() => duplicateGeneratedCommunicationMutation.mutate({ generatedCommunicationId: item.id })}
                                                            loading={isDuplicating}
                                                        >
                                                            Duplicate
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            danger
                                                            onClick={() => {
                                                                modal.confirm({
                                                                    title: "Delete Generated Communication",
                                                                    content: "This saved generated communication will be permanently removed.",
                                                                    okText: "Delete",
                                                                    okType: "danger",
                                                                    cancelText: "Cancel",
                                                                    onOk() {
                                                                        deleteGeneratedCommunicationMutation.mutate({ generatedCommunicationId: item.id });
                                                                    },
                                                                });
                                                            }}
                                                            loading={isDeleting}
                                                        >
                                                            Delete
                                                        </Button>
                                                        {hasChanges && (
                                                            <Button
                                                                size="small"
                                                                type="primary"
                                                                onClick={() => {
                                                                    updateGeneratedCommunicationMutation.mutate({
                                                                        generatedCommunicationId: item.id,
                                                                        generatedMessage: generatedCommunicationDraft.trim(),
                                                                    });
                                                                }}
                                                                loading={updateGeneratedCommunicationMutation.isPending}
                                                            >
                                                                Save Changes
                                                            </Button>
                                                        )}
                                                    </Space>
                                                </Flex>
                                                {isSelected ? (
                                                    <TextArea
                                                        value={generatedCommunicationDraft}
                                                        onChange={(event) => setGeneratedCommunicationDraft(event.target.value)}
                                                        autoSize={{ minRows: 4, maxRows: 14 }}
                                                    />
                                                ) : (
                                                    <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                                                        {item.generatedMessage}
                                                    </Typography.Paragraph>
                                                )}
                                            </Space>
                                        </Card>
                                    );
                                })}
                            </Space>
                        )}
                    </Card>
                </Space>
            </Modal>

            <createProposalTour.TourOverlay />
            <editProposalTour.TourOverlay />
            <stakeholderTour.TourOverlay />
            <rfpAnalysisTour.TourOverlay />
            <manualEvaluationTour.TourOverlay />
            <chatTour.TourOverlay />
            <meetingNotesTour.TourOverlay />
            <communicationsTour.TourOverlay />
        </>
    );
}
