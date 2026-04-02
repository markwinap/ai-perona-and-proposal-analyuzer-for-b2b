"use client";

import { useEffect, useRef, useState } from "react";

import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import Link from "next/link";

import { SpeakableTextArea as TextArea } from "./speakable-text-area";
import { stopSpeakableAudioPlayback } from "./speakable-text-area";
import { ThemeToggle } from "~/app/theme-toggle";
import { api } from "~/trpc/react";

type PromptEntry = {
  id: number | null;
  key: string;
  name: string;
  description: string | null;
  systemInstruction: string | null;
  promptTemplate: string;
  isActive: boolean;
  isCustomized: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

const PLACEHOLDER_DOCS: Record<string, string> = {
  persona_analysis:
    "Available placeholders: {{HISTORY_SUMMARY}} — JSON summary of won/lost/pending proposal counts; {{FULL_DATA}} — full JSON input data.",
  rfp_analysis: "Available placeholders: {{CONTEXT}} — full JSON input data.",
  proposal_draft: "Available placeholders: {{CONTEXT}} — full JSON input data.",
};

const KEY_LABELS: Record<string, string> = {
  persona_analysis: "Persona Analysis",
  rfp_analysis: "RFP Analysis",
  proposal_draft: "Proposal Draft",
};

export function PromptAdmin() {
  const [messageApi, contextHolder] = message.useMessage();
  const [editingPrompt, setEditingPrompt] = useState<PromptEntry | null>(null);
  const previousModalOpenRef = useRef(false);
  const [form] = Form.useForm<{
    name: string;
    description: string;
    systemInstruction: string;
    promptTemplate: string;
  }>();

  const { data: prompts = [], refetch, isLoading } = api.prompt.list.useQuery();

  const upsert = api.prompt.upsert.useMutation({
    onSuccess: async () => {
      await refetch();
      setEditingPrompt(null);
      void messageApi.success("Prompt saved.");
    },
    onError: (err) => {
      void messageApi.error(`Save failed: ${err.message}`);
    },
  });

  const resetToDefault = api.prompt.resetToDefault.useMutation({
    onSuccess: async () => {
      await refetch();
      void messageApi.success("Prompt reset to built-in default.");
    },
    onError: (err) => {
      void messageApi.error(`Reset failed: ${err.message}`);
    },
  });

  const openEditor = (prompt: PromptEntry) => {
    setEditingPrompt(prompt);
    form.setFieldsValue({
      name: prompt.name,
      description: prompt.description ?? "",
      systemInstruction: prompt.systemInstruction ?? "",
      promptTemplate: prompt.promptTemplate,
    });
  };

  const handleSave = () => {
    void form.validateFields().then((values) => {
      if (!editingPrompt) return;
      upsert.mutate({
        key: editingPrompt.key as "persona_analysis" | "rfp_analysis" | "proposal_draft",
        name: values.name,
        description: values.description || undefined,
        systemInstruction: values.systemInstruction || undefined,
        promptTemplate: values.promptTemplate,
        isActive: true,
      });
    });
  };

  useEffect(() => {
    const isModalOpen = Boolean(editingPrompt);
    if (previousModalOpenRef.current && !isModalOpen) {
      stopSpeakableAudioPlayback();
    }

    previousModalOpenRef.current = isModalOpen;
  }, [editingPrompt]);

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 48px" }}>
      {contextHolder}

      <header className="hero-banner">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          <div className="hero-copy">
            <Typography.Title level={1} className="hero-title">
              Prompt Administration
            </Typography.Title>
            <Typography.Paragraph className="hero-description">
              Manage the AI prompt templates used for persona analysis, RFP evaluation, and proposal
              draft generation. Edits are stored in the database and take effect on the next AI
              request.
            </Typography.Paragraph>
          </div>
          <Space>
            <Link href="/">
              <Button>← Back to Portal</Button>
            </Link>
            <ThemeToggle />
          </Space>
        </div>
      </header>

      <div style={{ padding: "24px 32px" }}>
        <Row gutter={[20, 20]}>
          {isLoading
            ? null
            : prompts.map((prompt) => (
                <Col xs={24} key={prompt.key}>
                  <Card
                    title={
                      <Space>
                        <Typography.Text strong>
                          {KEY_LABELS[prompt.key] ?? prompt.name}
                        </Typography.Text>
                        <Tag color="default" style={{ fontFamily: "monospace" }}>
                          {prompt.key}
                        </Tag>
                        {prompt.isCustomized ? (
                          <Badge status="processing" text="Customized" />
                        ) : (
                          <Badge status="default" text="Built-in default" />
                        )}
                      </Space>
                    }
                    extra={
                      <Space>
                        <Button type="primary" onClick={() => openEditor(prompt)}>
                          Edit
                        </Button>
                        {prompt.isCustomized && (
                          <Popconfirm
                            title="Reset to built-in default?"
                            description="This will delete any customizations and restore the original prompt."
                            onConfirm={() =>
                              resetToDefault.mutate({
                                key: prompt.key as
                                  | "persona_analysis"
                                  | "rfp_analysis"
                                  | "proposal_draft",
                              })
                            }
                            okText="Reset"
                            cancelText="Cancel"
                          >
                            <Button danger>Reset to Default</Button>
                          </Popconfirm>
                        )}
                      </Space>
                    }
                  >
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Description">
                        {prompt.description ?? "—"}
                      </Descriptions.Item>
                      {prompt.systemInstruction && (
                        <Descriptions.Item label="System Instruction">
                          <Typography.Text
                            style={{ fontFamily: "monospace", fontSize: 12 }}
                            ellipsis={{ tooltip: true }}
                          >
                            {prompt.systemInstruction}
                          </Typography.Text>
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="Template Preview">
                        <Typography.Text
                          style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}
                          ellipsis={{ tooltip: prompt.promptTemplate }}
                        >
                          {prompt.promptTemplate.slice(0, 400)}
                          {prompt.promptTemplate.length > 400 ? "…" : ""}
                        </Typography.Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Placeholders">
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {PLACEHOLDER_DOCS[prompt.key]}
                        </Typography.Text>
                      </Descriptions.Item>
                      {prompt.updatedAt && (
                        <Descriptions.Item label="Last Modified">
                          {new Date(prompt.updatedAt).toLocaleString()}
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </Card>
                </Col>
              ))}
        </Row>
      </div>

      <Modal
        open={!!editingPrompt}
        title={`Edit Prompt — ${editingPrompt ? (KEY_LABELS[editingPrompt.key] ?? editingPrompt.name) : ""}`}
        width={860}
        onCancel={() => setEditingPrompt(null)}
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button onClick={() => setEditingPrompt(null)}>Cancel</Button>
            <Button type="primary" loading={upsert.isPending} onClick={handleSave}>
              Save
            </Button>
          </Flex>
        }
      >
        {editingPrompt && (
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12, fontSize: 12 }}>
            {PLACEHOLDER_DOCS[editingPrompt.key]}
          </Typography.Text>
        )}
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Name" rules={[{ required: true, min: 2 }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="description" label="Description">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="systemInstruction"
            label="System Instruction"
            tooltip="The system instruction sent to the model (leave blank for none)."
          >
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="promptTemplate"
            label="Prompt Template"
            rules={[{ required: true, min: 10, message: "Prompt template is required." }]}
          >
            <TextArea rows={18} style={{ fontFamily: "monospace", fontSize: 12 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
