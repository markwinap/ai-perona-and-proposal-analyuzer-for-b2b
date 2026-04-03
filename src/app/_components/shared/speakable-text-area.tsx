"use client";

import { PauseCircleOutlined, SoundOutlined } from "@ant-design/icons";
import { Button, Input, Space, Typography } from "antd";
import type { ButtonProps } from "antd";
import type { TextAreaProps } from "antd/es/input";
import { useMemo } from "react";

import { useAudioPlayback, MAX_POLLY_TEXT_LENGTH } from "~/app/_components/hooks/use-audio-playback";

export { stopSpeakableAudioPlayback } from "~/app/_components/hooks/use-audio-playback";

const { TextArea } = Input;

export function SpeakableTextArea(props: TextAreaProps) {
    const { isPlaying, isPending, handleReadAloud } = useAudioPlayback();

    const currentText = useMemo(() => {
        if (typeof props.value === "string") {
            return props.value.trim();
        }

        if (typeof props.defaultValue === "string") {
            return props.defaultValue.trim();
        }

        return "";
    }, [props.defaultValue, props.value]);

    return (
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
            <TextArea {...props} />
            <Space size={8} style={{ justifyContent: "flex-end", width: "100%" }}>
                <Typography.Text type="secondary">{currentText.length}/{MAX_POLLY_TEXT_LENGTH}</Typography.Text>
                <Button
                    size="small"
                    icon={isPlaying ? <PauseCircleOutlined /> : <SoundOutlined />}
                    onClick={() => void handleReadAloud(currentText)}
                    loading={isPending}
                    disabled={!currentText}
                >
                    {isPlaying ? "Stop" : "Read Aloud"}
                </Button>
            </Space>
        </Space>
    );
}

export function ReadAloudButton({
    text,
    size = "small",
}: {
    text: string | null | undefined;
    size?: ButtonProps["size"];
}) {
    const normalizedText = (text ?? "").trim();
    const { isPlaying, isPending, handleReadAloud } = useAudioPlayback();

    return (
        <Button
            size={size}
            icon={isPlaying ? <PauseCircleOutlined /> : <SoundOutlined />}
            onClick={() => void handleReadAloud(normalizedText)}
            loading={isPending}
            disabled={!normalizedText}
        >
            {isPlaying ? "Stop" : "Read Aloud"}
        </Button>
    );
}
