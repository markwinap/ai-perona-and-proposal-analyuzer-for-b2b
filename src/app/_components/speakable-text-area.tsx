"use client";

import { PauseCircleOutlined, SoundOutlined } from "@ant-design/icons";
import { App, Button, Input, Space, Typography } from "antd";
import type { TextAreaProps } from "antd/es/input";
import { useMemo, useRef, useState } from "react";

import { api } from "~/trpc/react";

const { TextArea } = Input;

export function SpeakableTextArea(props: TextAreaProps) {
    const { message } = App.useApp();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [cachedText, setCachedText] = useState<string>("");
    const [cachedAudioSrc, setCachedAudioSrc] = useState<string>("");
    const synthesizeMutation = api.speech.synthesize.useMutation({
        onError: (error) => message.error(error.message),
    });

    const currentText = useMemo(() => {
        if (typeof props.value === "string") {
            return props.value.trim();
        }

        if (typeof props.defaultValue === "string") {
            return props.defaultValue.trim();
        }

        return "";
    }, [props.defaultValue, props.value]);

    const playAudio = async (src: string) => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.onended = () => setIsPlaying(false);
            audioRef.current.onpause = () => setIsPlaying(false);
            audioRef.current.onerror = () => {
                setIsPlaying(false);
                message.error("Unable to play generated audio.");
            };
        }

        audioRef.current.src = src;
        audioRef.current.currentTime = 0;
        setIsPlaying(true);
        await audioRef.current.play();
    };

    const stopAudio = () => {
        if (!audioRef.current) {
            return;
        }

        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
    };

    const handleReadAloud = async () => {
        const trimmedText = currentText;
        if (!trimmedText) {
            return;
        }

        if (trimmedText.length > 2800) {
            message.warning("Text is too long for one Polly request. Please shorten it to 2800 characters or less.");
            return;
        }

        if (isPlaying) {
            stopAudio();
            return;
        }

        if (cachedText === trimmedText && cachedAudioSrc) {
            await playAudio(cachedAudioSrc);
            return;
        }

        const result = await synthesizeMutation.mutateAsync({ text: trimmedText });
        const src = `data:${result.contentType};base64,${result.audioBase64}`;

        setCachedText(trimmedText);
        setCachedAudioSrc(src);
        await playAudio(src);
    };

    return (
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
            <TextArea {...props} />
            <Space size={8} style={{ justifyContent: "flex-end", width: "100%" }}>
                <Typography.Text type="secondary">{currentText.length}/2800</Typography.Text>
                <Button
                    size="small"
                    icon={isPlaying ? <PauseCircleOutlined /> : <SoundOutlined />}
                    onClick={() => void handleReadAloud()}
                    loading={synthesizeMutation.isPending}
                    disabled={!currentText}
                >
                    {isPlaying ? "Stop" : "Read Aloud"}
                </Button>
            </Space>
        </Space>
    );
}
