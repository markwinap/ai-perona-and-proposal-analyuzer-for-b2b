"use client";

import { useEffect, useRef, useState, useCallback } from "react";

import { App } from "antd";

import { api } from "~/trpc/react";

const STOP_SPEAKABLE_AUDIO_EVENT = "app:stop-speakable-audio";
const MAX_POLLY_TEXT_LENGTH = 2800;

export { STOP_SPEAKABLE_AUDIO_EVENT, MAX_POLLY_TEXT_LENGTH };

export const stopSpeakableAudioPlayback = () => {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new Event(STOP_SPEAKABLE_AUDIO_EVENT));
};

export function useAudioPlayback() {
    const { message } = App.useApp();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [cachedText, setCachedText] = useState("");
    const [cachedAudioSrc, setCachedAudioSrc] = useState("");

    const synthesizeMutation = api.speech.synthesize.useMutation({
        onError: (error) => message.error(error.message),
    });

    const stopAudio = useCallback(() => {
        if (!audioRef.current) {
            return;
        }

        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
    }, []);

    const playAudio = useCallback(
        async (src: string) => {
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
        },
        [message],
    );

    useEffect(() => {
        const handleStopAudio = () => {
            stopAudio();
        };

        window.addEventListener(STOP_SPEAKABLE_AUDIO_EVENT, handleStopAudio);

        return () => {
            window.removeEventListener(STOP_SPEAKABLE_AUDIO_EVENT, handleStopAudio);
            stopAudio();
        };
    }, [stopAudio]);

    const handleReadAloud = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) {
                return;
            }

            if (trimmed.length > MAX_POLLY_TEXT_LENGTH) {
                message.warning(
                    `Text is too long for one Polly request. Please shorten it to ${MAX_POLLY_TEXT_LENGTH} characters or less.`,
                );
                return;
            }

            if (isPlaying) {
                stopAudio();
                return;
            }

            if (cachedText === trimmed && cachedAudioSrc) {
                await playAudio(cachedAudioSrc);
                return;
            }

            const result = await synthesizeMutation.mutateAsync({ text: trimmed });
            const src = `data:${result.contentType};base64,${result.audioBase64}`;

            setCachedText(trimmed);
            setCachedAudioSrc(src);
            await playAudio(src);
        },
        [isPlaying, cachedText, cachedAudioSrc, stopAudio, playAudio, synthesizeMutation, message],
    );

    return {
        isPlaying,
        isPending: synthesizeMutation.isPending,
        handleReadAloud,
        stopAudio,
    };
}
