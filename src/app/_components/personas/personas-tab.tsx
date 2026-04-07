"use client";

import { useMemo, useState } from "react";

import {
    Button,
    Card,
    Col,
    Flex,
    Form,
    Input,
    Modal,
    Row,
    Select,
    Space,
    Table,
    Tag,
    Typography,
    message,
} from "antd";

import {
    COMMUNICATION_TYPE_OPTIONS,
    TABLE_PAGE_SIZE,
} from "~/app/_components/shared/persona-portal.constants";
import {
    mapCompanyOptions,
} from "~/app/_components/shared/persona-portal.helpers";
import { ReadAloudButton, SpeakableTextArea as TextArea } from "~/app/_components/shared/speakable-text-area";
import { SearchSelect } from "~/app/_components/shared/search-select";
import { useModalAudioCleanup } from "~/app/_components/hooks/use-modal-audio-cleanup";
import { useModalTour } from "~/app/_components/hooks/use-modal-tour";
import { MODAL_WIDTH_NARROW, MODAL_WIDTH_MEDIUM } from "~/app/_components/shared/modal-widths";
import { SectionHeader } from "~/app/_components/shared/section-header";
import { DataCard } from "~/app/_components/shared/data-card";
import { FormModal } from "~/app/_components/shared/form-modal";
import { TranslationToggle } from "~/app/_components/shared/translation-toggle";
import { api } from "~/trpc/react";

const PERSONA_EDIT_WIDTH = {
    xs: "90%",
    sm: "80%",
    md: "70%",
    lg: "60%",
    xl: "60%",
    xxl: "60%",
} as const;

export function PersonasTab() {
    const [messageApi, contextHolder] = message.useMessage();
    const [showCreatePersona, setShowCreatePersona] = useState(false);
    const [editingPersonaId, setEditingPersonaId] = useState<number | null>(null);
    const [communicationModalPersonaId, setCommunicationModalPersonaId] = useState<number | null>(null);
    const [showAddCommunicationModal, setShowAddCommunicationModal] = useState(false);
    const [analyzePersonaModalId, setAnalyzePersonaModalId] = useState<number | null>(null);
    const [personaAnalysisTranslation, setPersonaAnalysisTranslation] = useState<string | null>(null);
    const [personaAnalysisViewMode, setPersonaAnalysisViewMode] = useState<"original" | "translated">("original");

    const [createForm] = Form.useForm();
    const [editForm] = Form.useForm();
    const [communicationForm] = Form.useForm();
    const utils = api.useUtils();

    const companiesQuery = api.company.list.useQuery();
    const personasQuery = api.persona.list.useQuery();
    const communicationsQuery = api.persona.listCommunications.useQuery();

    const companies = companiesQuery.data ?? [];
    const personas = personasQuery.data ?? [];
    const companyOptions = useMemo(() => mapCompanyOptions(companies), [companies]);

    useModalAudioCleanup(useMemo(() => [
        showCreatePersona,
        editingPersonaId !== null,
        communicationModalPersonaId !== null,
        communicationModalPersonaId !== null && showAddCommunicationModal,
        analyzePersonaModalId !== null,
    ], [showCreatePersona, editingPersonaId, communicationModalPersonaId, showAddCommunicationModal, analyzePersonaModalId]));

    const createPersonaTour = useModalTour([
        { title: "Company & Identity", description: "Select the parent company and provide the persona's full name and optional email address." },
        { title: "Role & Personality", description: "Describe the persona's job scope, personality traits, and communication preferences to improve AI-generated insights." },
        { title: "Past Experiences", description: "Document previous projects and outcomes so proposal analyses can reference relevant history." },
    ]);

    const editPersonaTour = useModalTour([
        { title: "Update Identity", description: "Modify the persona's name, email, or profile fields. Changes propagate to all linked proposals and analyses." },
        { title: "Personality & Preferences", description: "Refine personality summaries and preferences to sharpen AI-driven communication recommendations." },
    ]);

    const communicationsTour = useModalTour([
        { title: "Communication History", description: "View all recorded interactions with this persona — emails, calls, meetings, and notes." },
        { title: "Add Communication", description: "Click 'Add Communication' to log a new interaction that feeds into persona analysis and proposal scoring." },
    ]);

    const addCommunicationTour = useModalTour([
        { title: "Communication Type", description: "Select the kind of interaction — email, call, meeting, or other." },
        { title: "Subject & Content", description: "Provide a subject line and paste the full communication content. This data powers AI persona insights." },
    ]);

    const analyzePersonaTour = useModalTour([
        { title: "AI Persona Analysis", description: "View the AI-generated behavioral profile and communication recommendations for this persona." },
        { title: "Translation & Regeneration", description: "Translate the analysis to Spanish (LatAm) or regenerate it with the latest data using the footer actions." },
    ]);

    const createMutation = api.persona.create.useMutation({
        onSuccess: async () => {
            await utils.persona.list.invalidate();
            createForm.resetFields();
            setShowCreatePersona(false);
            messageApi.success("Persona created");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const updateMutation = api.persona.update.useMutation({
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
            setShowAddCommunicationModal(false);
            messageApi.success("Communication record added");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const analyzeMutation = api.persona.analyze.useMutation({
        onSuccess: async () => {
            await utils.persona.list.invalidate();
            setPersonaAnalysisTranslation(null);
            setPersonaAnalysisViewMode("original");
            messageApi.success("Persona analysis generated");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const translateMutation = api.persona.translateAnalysis.useMutation({
        onError: (error) => messageApi.error(error.message),
    });

    const editingPersona = personas.find((p) => p.id === editingPersonaId) ?? null;
    const communicationModalPersona =
        communicationModalPersonaId === null
            ? null
            : personas.find((p) => p.id === communicationModalPersonaId) ?? null;

    const personaCommunications = useMemo(() => {
        if (communicationModalPersonaId === null) return [];
        return (communicationsQuery.data ?? []).filter(
            (c) => c.persona.id === communicationModalPersonaId,
        );
    }, [communicationsQuery.data, communicationModalPersonaId]);

    const analyzePersona =
        analyzePersonaModalId === null
            ? null
            : personas.find((p) => p.id === analyzePersonaModalId) ?? null;

    const openEditor = (persona: (typeof personas)[number]) => {
        setEditingPersonaId(persona.id);
        editForm.setFieldsValue({
            fullName: persona.fullName,
            email: persona.email ?? "",
            jobDescription: persona.jobDescription ?? "",
            personalitySummary: persona.personalitySummary ?? "",
            personalPreferences: persona.personalPreferences ?? "",
            pastExperiences: persona.pastExperiences ?? "",
        });
    };

    const closeEditor = () => {
        setEditingPersonaId(null);
        editForm.resetFields();
    };

    const closeCreateModal = () => {
        setShowCreatePersona(false);
        createForm.resetFields();
    };

    const closeCommunicationModal = () => {
        setShowAddCommunicationModal(false);
        setCommunicationModalPersonaId(null);
    };

    const closeAddCommunicationModal = () => {
        setShowAddCommunicationModal(false);
        communicationForm.resetFields();
    };

    const closeAnalyzeModal = () => {
        setAnalyzePersonaModalId(null);
        setPersonaAnalysisTranslation(null);
        setPersonaAnalysisViewMode("original");
    };

    return (
        <>
            {contextHolder}

            <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                <SectionHeader
                    title="Persona Coverage"
                    description="Capture stakeholder profiles, communication history, and buyer behavior for sharper decision support."
                    actionLabel="Add New Persona"
                    onAction={() => setShowCreatePersona(true)}
                />

                <DataCard
                    title="Personas"
                    dataSource={personas}
                    loading={personasQuery.isLoading}
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
                        {
                            title: "Actions",
                            render: (_, row) => (
                                <Space size="small">
                                    <Button size="small" onClick={() => openEditor(row)}>
                                        Edit
                                    </Button>
                                    <Button size="small" onClick={() => setCommunicationModalPersonaId(row.id)}>
                                        Communications
                                    </Button>
                                    <Button size="small" type="primary" onClick={() => setAnalyzePersonaModalId(row.id)}>
                                        Analyze
                                    </Button>
                                </Space>
                            ),
                        },
                    ]}
                />
            </Space>

            <FormModal
                open={showCreatePersona}
                title="Create Persona"
                onCancel={closeCreateModal}
                form={createForm}
                onFinish={(values) => createMutation.mutate(values)}
                okText="Save Persona"
                confirmLoading={createMutation.isPending}
                width={MODAL_WIDTH_MEDIUM}
                extra={<createPersonaTour.HelpButton />}
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
                    <TextArea autoSize={{ minRows: 2 }} placeholder="Role scope and accountability" />
                </Form.Item>
                <Form.Item name="personalitySummary" label="Personality Summary">
                    <TextArea autoSize={{ minRows: 2 }} placeholder="Analytical, risk-aware, collaborative" />
                </Form.Item>
                <Form.Item name="personalPreferences" label="Personal Preferences">
                    <TextArea autoSize={{ minRows: 2 }} placeholder="Prefers concise briefs and architecture diagrams" />
                </Form.Item>
                <Form.Item name="pastExperiences" label="Past Experiences">
                    <TextArea autoSize={{ minRows: 2 }} placeholder="Previous transformation projects and outcomes" />
                </Form.Item>
            </FormModal>

            <FormModal
                open={!!editingPersona}
                title="Edit Persona"
                onCancel={closeEditor}
                form={editForm}
                onFinish={(values) => {
                    if (!editingPersona) return;
                    updateMutation.mutate({ id: editingPersona.id, ...values });
                }}
                okText="Update Persona"
                confirmLoading={updateMutation.isPending}
                width={PERSONA_EDIT_WIDTH}
                subtitle={editingPersona ? `${editingPersona.fullName} · ${editingPersona.company.name}` : null}
                extra={<editPersonaTour.HelpButton />}
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
                    <TextArea autoSize={{ minRows: 2 }} />
                </Form.Item>
                <Form.Item name="personalitySummary" label="Personality Summary">
                    <TextArea autoSize={{ minRows: 2 }} />
                </Form.Item>
                <Form.Item name="personalPreferences" label="Personal Preferences">
                    <TextArea autoSize={{ minRows: 2 }} />
                </Form.Item>
                <Form.Item name="pastExperiences" label="Past Experiences">
                    <TextArea autoSize={{ minRows: 2 }} />
                </Form.Item>
            </FormModal>

            {/* Communications Modal */}
            <Modal
                open={communicationModalPersona !== null}
                title={
                    <Flex align="center" gap={4}>
                        <span>{communicationModalPersona
                            ? `Communications: ${communicationModalPersona.fullName}`
                            : "Communications"}</span>
                        <communicationsTour.HelpButton />
                    </Flex>
                }
                onCancel={closeCommunicationModal}
                footer={<Button onClick={closeCommunicationModal}>Close</Button>}
                centered
                width={MODAL_WIDTH_MEDIUM}
            >
                {communicationModalPersona ? (
                    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                        <Typography.Text type="secondary">
                            Company: {communicationModalPersona.company.name}
                        </Typography.Text>

                        <Flex justify="end">
                            <Button type="primary" onClick={() => setShowAddCommunicationModal(true)}>
                                Add Communication
                            </Button>
                        </Flex>

                        <Card title="Communication History" size="small">
                            <Table
                                className="portal-table"
                                rowKey="id"
                                size="middle"
                                pagination={{ pageSize: TABLE_PAGE_SIZE }}
                                loading={communicationsQuery.isLoading}
                                dataSource={personaCommunications}
                                columns={[
                                    { title: "Type", render: (_, row) => <Tag>{row.type}</Tag> },
                                    { title: "Subject", dataIndex: "subject" },
                                    { title: "Excerpt", render: (_, row) => row.content.slice(0, 120) },
                                ]}
                            />
                        </Card>
                    </Space>
                ) : null}
            </Modal>

            <FormModal
                open={communicationModalPersona !== null && showAddCommunicationModal}
                title="Add Communication"
                onCancel={closeAddCommunicationModal}
                form={communicationForm}
                onFinish={(values) => {
                    if (!communicationModalPersona) return;
                    communicationMutation.mutate({
                        companyId: communicationModalPersona.company.id,
                        personaId: communicationModalPersona.id,
                        ...values,
                    });
                }}
                okText="Save Communication"
                confirmLoading={communicationMutation.isPending}
                width={MODAL_WIDTH_MEDIUM}
                subtitle={communicationModalPersona ? `${communicationModalPersona.fullName} · ${communicationModalPersona.company.name}` : null}
                extra={<addCommunicationTour.HelpButton />}
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
            </FormModal>

            {/* Analyze Persona Modal */}
            <Modal
                open={analyzePersonaModalId !== null}
                title={
                    <Flex align="center" gap={4}>
                        <span>{analyzePersona ? `Analyze Persona: ${analyzePersona.fullName}` : "Analyze Persona"}</span>
                        <analyzePersonaTour.HelpButton />
                    </Flex>
                }
                onCancel={closeAnalyzeModal}
                width={MODAL_WIDTH_MEDIUM}
                centered
                footer={[
                    <Flex gap="small" wrap justify="end" key="footer" style={{ width: "100%" }}>
                        <Button key="close" onClick={closeAnalyzeModal}>
                            Close
                        </Button>
                        <TranslationToggle
                            viewMode={personaAnalysisViewMode}
                            onShowOriginal={() => setPersonaAnalysisViewMode("original")}
                            onShowTranslation={() => {
                                if (!analyzePersona?.analysis) return;

                                if (personaAnalysisTranslation) {
                                    setPersonaAnalysisViewMode("translated");
                                    return;
                                }

                                translateMutation.mutate(
                                    { analysis: analyzePersona.analysis },
                                    {
                                        onSuccess: (result) => {
                                            setPersonaAnalysisTranslation(result.translatedAnalysis);
                                            setPersonaAnalysisViewMode("translated");
                                            messageApi.success("Persona analysis translated to Spanish (LatAm)");
                                        },
                                    },
                                );
                            }}
                            translating={translateMutation.isPending}
                            disabled={!analyzePersona?.analysis}
                        />
                        <Button
                            key="regenerate"
                            type="primary"
                            loading={analyzeMutation.isPending}
                            onClick={() => {
                                if (analyzePersonaModalId) {
                                    setPersonaAnalysisTranslation(null);
                                    setPersonaAnalysisViewMode("original");
                                    analyzeMutation.mutate({ personaId: analyzePersonaModalId });
                                }
                            }}
                        >
                            Regenerate Analysis
                        </Button>
                    </Flex>,
                ]}
            >
                {analyzePersona?.analysis ? (
                    <div>
                        <Typography.Paragraph style={{ marginBottom: 16 }}>
                            <Typography.Text strong>
                                {analyzePersona.fullName} ({analyzePersona.company.name})
                            </Typography.Text>
                        </Typography.Paragraph>
                        <Card className="analysis-result-card" type="inner" style={{ marginBottom: 16 }}>
                            <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                                {personaAnalysisViewMode === "translated" && personaAnalysisTranslation
                                    ? personaAnalysisTranslation
                                    : analyzePersona.analysis}
                            </Typography.Paragraph>
                        </Card>
                    </div>
                ) : (
                    <Typography.Paragraph type="secondary">
                        No analysis yet. Click &quot;Regenerate Analysis&quot; to generate one.
                    </Typography.Paragraph>
                )}
            </Modal>

            <createPersonaTour.TourOverlay />
            <editPersonaTour.TourOverlay />
            <communicationsTour.TourOverlay />
            <addCommunicationTour.TourOverlay />
            <analyzePersonaTour.TourOverlay />
        </>
    );
}
