"use client";

import { Button, Space, Typography } from "antd";
import type { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    description: string;
    actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
    return (
        <header className="hero-banner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                <div className="hero-copy">
                    <Typography.Title level={1} className="hero-title">
                        {title}
                    </Typography.Title>
                    <Typography.Paragraph className="hero-description">
                        {description}
                    </Typography.Paragraph>
                </div>
                {actions ? <Space>{actions}</Space> : null}
            </div>
        </header>
    );
}
