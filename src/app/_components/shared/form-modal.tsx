"use client";

import { Modal, Form } from "antd";
import type { FormInstance } from "antd";
import type { ReactNode } from "react";

interface FormModalProps {
    open: boolean;
    title: string;
    onCancel: () => void;
    form: FormInstance;
    onFinish: (values: any) => void;
    okText?: string;
    confirmLoading?: boolean;
    width?: Record<string, string>;
    centered?: boolean;
    subtitle?: ReactNode;
    children: ReactNode;
}

export function FormModal({
    open,
    title,
    onCancel,
    form,
    onFinish,
    okText = "Save",
    confirmLoading,
    width,
    centered = true,
    subtitle,
    children,
}: FormModalProps) {
    return (
        <Modal
            open={open}
            title={title}
            onCancel={onCancel}
            onOk={() => form.submit()}
            okText={okText}
            confirmLoading={confirmLoading}
            centered={centered}
            width={width}
        >
            {subtitle}
            <Form form={form} layout="vertical" onFinish={onFinish} style={subtitle ? { marginTop: 12 } : undefined}>
                {children}
            </Form>
        </Modal>
    );
}
