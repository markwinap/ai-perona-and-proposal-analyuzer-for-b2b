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
        communicationForm.resetFields();
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
                width={MODAL_WIDTH_NARROW}
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
                title={editingPersona ? `Edit Persona: ${editingPersona.fullName}` : "Edit Persona"}
                onCancel={closeEditor}
                form={editForm}
                onFinish={(values) => {
                    if (!editingPersona) return;
                    updateMutation.mutate({ id: editingPersona.id, ...values });
                }}
                okText="Update Persona"
                confirmLoading={updateMutation.isPending}
                width={PERSONA_EDIT_WIDTH}
                subtitle={
                    editingPersona ? (
                        <Typography.Text type="secondary">Company: {editingPersona.company.name}</Typography.Text>
                    ) : null
                }
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
                    communicationModalPersona
                        ? `Communications: ${communicationModalPersona.fullName}`
                        : "Communications"
                }
                onCancel={closeCommunicationModal}
                footer={<Button onClick={closeCommunicationModal}>Close</Button>}
                centered
                width={MODAL_WIDTH_NARROW}
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
                title={
                    communicationModalPersona
                        ? `Add Communication: ${communicationModalPersona.fullName}`
                        : "Add Communication"
                }
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
                width={MODAL_WIDTH_NARROW}
                subtitle={
                    communicationModalPersona ? (
                        <Typography.Text type="secondary">
                            Company: {communicationModalPersona.company.name}
                        </Typography.Text>
                    ) : null
                }
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
                title={analyzePersona ? `Analyze Persona: ${analyzePersona.fullName}` : "Analyze Persona"}
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
        </>
    );
}
