"use client";

import { Button, Space, Typography } from "antd";

interface SectionHeaderProps {
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
}

export function SectionHeader({ title, description, actionLabel, onAction }: SectionHeaderProps) {
    return (
        <div className="section-toolbar">
            <div>
                <Typography.Title level={4} className="section-title">
                    {title}
                </Typography.Title>
                <Typography.Paragraph className="section-description">
                    {description}
                </Typography.Paragraph>
            </div>
            <Button type="primary" onClick={onAction}>
                {actionLabel}
            </Button>
        </div>
    );
}
