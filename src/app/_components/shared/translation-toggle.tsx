"use client";

import { Button, Space } from "antd";

interface TranslationToggleProps {
    viewMode: "original" | "translated";
    onShowOriginal: () => void;
    onShowTranslation: () => void;
    translating?: boolean;
    disabled?: boolean;
    size?: "small" | "middle" | "large";
}

export function TranslationToggle({
    viewMode,
    onShowOriginal,
    onShowTranslation,
    translating,
    disabled,
    size = "middle",
}: TranslationToggleProps) {
    return (
        <Space.Compact size={size}>
            <Button
                type={viewMode === "original" ? "primary" : "default"}
                onClick={onShowOriginal}
            >
                Show Original
            </Button>
            <Button
                type={viewMode === "translated" ? "primary" : "default"}
                loading={translating}
                disabled={disabled}
                onClick={onShowTranslation}
            >
                Show Translation
            </Button>
        </Space.Compact>
    );
}
