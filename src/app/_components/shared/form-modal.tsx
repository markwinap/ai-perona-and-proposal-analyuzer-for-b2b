"use client";

import { Flex, Modal, Form, Typography } from "antd";
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
    /** Extra element rendered to the right of the modal title (e.g. a help button). */
    extra?: ReactNode;
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
    extra,
    children,
}: FormModalProps) {
    return (
        <Modal
            open={open}
            title={
                <div>
                    <Flex align="center" gap={4}>
                        <span>{title}</span>
                        {extra}
                    </Flex>
                    {subtitle && (
                        <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                            {subtitle}
                        </Typography.Text>
                    )}
                </div>
            }
            onCancel={onCancel}
            onOk={() => form.submit()}
            okText={okText}
            confirmLoading={confirmLoading}
            centered={centered}
            width={width}
        >
            <Form form={form} layout="vertical" onFinish={onFinish}>
                {children}
            </Form>
        </Modal>
    );
}
