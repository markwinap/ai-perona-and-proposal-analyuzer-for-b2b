"use client";

import { PauseCircleOutlined, SoundOutlined } from "@ant-design/icons";
import { App, Button, Input, Space, Typography } from "antd";
import type { ButtonProps } from "antd";
import type { TextAreaProps } from "antd/es/input";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "~/trpc/react";

const { TextArea } = Input;

const STOP_SPEAKABLE_AUDIO_EVENT = "app:stop-speakable-audio";
const MAX_POLLY_TEXT_LENGTH = 2800;

export const stopSpeakableAudioPlayback = () => {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new Event(STOP_SPEAKABLE_AUDIO_EVENT));
};

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

    useEffect(() => {
        const handleStopAudio = () => {
            stopAudio();
        };

        window.addEventListener(STOP_SPEAKABLE_AUDIO_EVENT, handleStopAudio);

        return () => {
            window.removeEventListener(STOP_SPEAKABLE_AUDIO_EVENT, handleStopAudio);
            stopAudio();
        };
    }, []);

    const handleReadAloud = async () => {
        const trimmedText = currentText;
        if (!trimmedText) {
            return;
        }

        if (trimmedText.length > MAX_POLLY_TEXT_LENGTH) {
            message.warning(`Text is too long for one Polly request. Please shorten it to ${MAX_POLLY_TEXT_LENGTH} characters or less.`);
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
                <Typography.Text type="secondary">{currentText.length}/{MAX_POLLY_TEXT_LENGTH}</Typography.Text>
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

export function ReadAloudButton({
    text,
    size = "small",
}: {
    text: string | null | undefined;
    size?: ButtonProps["size"];
}) {
    const { message } = App.useApp();
    const normalizedText = (text ?? "").trim();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [cachedText, setCachedText] = useState<string>("");
    const [cachedAudioSrc, setCachedAudioSrc] = useState<string>("");
    const synthesizeMutation = api.speech.synthesize.useMutation({
        onError: (error) => message.error(error.message),
    });

    const stopAudio = () => {
        if (!audioRef.current) {
            return;
        }

        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
    };

    useEffect(() => {
        const handleStopAudio = () => {
            stopAudio();
        };

        window.addEventListener(STOP_SPEAKABLE_AUDIO_EVENT, handleStopAudio);

        return () => {
            window.removeEventListener(STOP_SPEAKABLE_AUDIO_EVENT, handleStopAudio);
            stopAudio();
        };
    }, []);

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

    const handleReadAloud = async () => {
        if (!normalizedText) {
            return;
        }

        if (normalizedText.length > MAX_POLLY_TEXT_LENGTH) {
            message.warning(`Text is too long for one Polly request. Please shorten it to ${MAX_POLLY_TEXT_LENGTH} characters or less.`);
            return;
        }

        if (isPlaying) {
            stopAudio();
            return;
        }

        if (cachedText === normalizedText && cachedAudioSrc) {
            await playAudio(cachedAudioSrc);
            return;
        }

        const result = await synthesizeMutation.mutateAsync({ text: normalizedText });
        const src = `data:${result.contentType};base64,${result.audioBase64}`;

        setCachedText(normalizedText);
        setCachedAudioSrc(src);
        await playAudio(src);
    };

    return (
        <Button
            size={size}
            icon={isPlaying ? <PauseCircleOutlined /> : <SoundOutlined />}
            onClick={() => void handleReadAloud()}
            loading={synthesizeMutation.isPending}
            disabled={!normalizedText}
        >
            {isPlaying ? "Stop" : "Read Aloud"}
        </Button>
    );
}
