"use client";

import { useMemo, useState } from "react";

import {
    Button,
    Col,
    Form,
    Input,
    Row,
    Space,
    message,
} from "antd";

import {
    csvFromArray,
} from "~/app/_components/shared/persona-portal.helpers";
import { SpeakableTextArea as TextArea } from "~/app/_components/shared/speakable-text-area";
import { useModalAudioCleanup } from "~/app/_components/hooks/use-modal-audio-cleanup";
import { useModalTour } from "~/app/_components/hooks/use-modal-tour";
import { MODAL_WIDTH_NARROW } from "~/app/_components/shared/modal-widths";
import { SectionHeader } from "~/app/_components/shared/section-header";
import { DataCard } from "~/app/_components/shared/data-card";
import { FormModal } from "~/app/_components/shared/form-modal";
import { api } from "~/trpc/react";

export function CompaniesTab() {
    const [messageApi, contextHolder] = message.useMessage();
    const [showCreateCompany, setShowCreateCompany] = useState(false);
    const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
    const [createForm] = Form.useForm();
    const [editForm] = Form.useForm();
    const utils = api.useUtils();

    const companiesQuery = api.company.list.useQuery();
    const companies = companiesQuery.data ?? [];

    useModalAudioCleanup(useMemo(() => [
        showCreateCompany,
        editingCompanyId !== null,
    ], [showCreateCompany, editingCompanyId]));

    const createMutation = api.company.create.useMutation({
        onSuccess: async () => {
            await utils.company.list.invalidate();
            createForm.resetFields();
            setShowCreateCompany(false);
            messageApi.success("Company created");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const updateMutation = api.company.update.useMutation({
        onSuccess: async () => {
            await utils.company.list.invalidate();
            setEditingCompanyId(null);
            messageApi.success("Company updated");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const editingCompany = companies.find((c) => c.id === editingCompanyId) ?? null;

    const createCompanyTour = useModalTour([
        { title: "Company Name & Industry", description: "Enter the company's legal name and primary industry vertical." },
        { title: "Business & Technology Intent", description: "Describe strategic goals and technology adoption plans. These fields feed into AI persona and proposal analyses." },
        { title: "Stacks, Certs & Standards", description: "List development stacks, regulatory certifications, compliance standards, partnerships, reference architectures, and engineering guidelines — comma-separated." },
    ]);

    const editCompanyTour = useModalTour([
        { title: "Update Company Profile", description: "Modify any company field. Changes are reflected across all linked personas and proposal AI analyses." },
        { title: "Comma-Separated Lists", description: "Fields like stacks, certifications, and partnerships accept comma-separated values. Add or remove entries as needed." },
    ]);

    const openEditor = (company: (typeof companies)[number]) => {
        setEditingCompanyId(company.id);
        editForm.setFieldsValue({
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

    const closeEditor = () => {
        setEditingCompanyId(null);
        editForm.resetFields();
    };

    const closeCreateModal = () => {
        setShowCreateCompany(false);
        createForm.resetFields();
    };

    return (
        <>
            {contextHolder}

            <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                <SectionHeader
                    title="Company Portfolio"
                    description="Maintain strategic account context, industry alignment, technical posture, and delivery standards in one view."
                    actionLabel="Add New Company"
                    onAction={() => setShowCreateCompany(true)}
                />

                <DataCard
                    title="Companies"
                    dataSource={companies}
                    loading={companiesQuery.isLoading}
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
                                <Button size="small" onClick={() => openEditor(row)}>
                                    Edit
                                </Button>
                            ),
                        },
                    ]}
                />
            </Space>

            <FormModal
                open={showCreateCompany}
                title="Create Company"
                onCancel={closeCreateModal}
                form={createForm}
                onFinish={(values) => createMutation.mutate(values)}
                okText="Save Company"
                confirmLoading={createMutation.isPending}
                width={MODAL_WIDTH_NARROW}
                extra={<createCompanyTour.HelpButton />}
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
                    <TextArea autoSize={{ minRows: 2 }} placeholder="Growth targets, priorities, strategic goals" />
                </Form.Item>
                <Form.Item name="technologyIntent" label="Technology Intent">
                    <TextArea autoSize={{ minRows: 2 }} placeholder="Cloud modernization, AI adoption, data platform plans" />
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
                <Form.Item name="referenceArchitectures" label="Reference Architectures (comma separated)">
                    <Input placeholder="Azure Landing Zone, Microservices blueprint" />
                </Form.Item>
                <Form.Item name="engineeringGuidelines" label="Engineering Guidelines (comma separated)">
                    <Input placeholder="Secure SDLC, API-first" />
                </Form.Item>
            </FormModal>

            <FormModal
                open={!!editingCompany}
                title="Edit Company"
                onCancel={closeEditor}
                form={editForm}
                onFinish={(values) => {
                    if (!editingCompany) return;
                    updateMutation.mutate({ id: editingCompany.id, ...values });
                }}
                okText="Update Company"
                confirmLoading={updateMutation.isPending}
                width={MODAL_WIDTH_NARROW}
                subtitle={editingCompany?.name}
                extra={<editCompanyTour.HelpButton />}
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
                    <TextArea autoSize={{ minRows: 2 }} />
                </Form.Item>
                <Form.Item name="technologyIntent" label="Technology Intent">
                    <TextArea autoSize={{ minRows: 2 }} />
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
            </FormModal>

            <createCompanyTour.TourOverlay />
            <editCompanyTour.TourOverlay />
        </>
    );
}
