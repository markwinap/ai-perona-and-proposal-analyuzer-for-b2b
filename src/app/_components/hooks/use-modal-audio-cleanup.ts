"use client";

import { useEffect, useRef } from "react";

import { stopSpeakableAudioPlayback } from "./use-audio-playback";

/**
 * Stops any playing audio when any tracked modal closes.
 * Pass an array of boolean flags (one per modal's open state).
 */
export function useModalAudioCleanup(modalVisibilityFlags: boolean[]) {
    const previousRef = useRef<boolean[] | null>(null);

    useEffect(() => {
        const previous = previousRef.current;
        const closedAny =
            previous !== null &&
            previous.some((wasOpen, index) => wasOpen && !modalVisibilityFlags[index]);

        if (closedAny) {
            stopSpeakableAudioPlayback();
        }

        previousRef.current = [...modalVisibilityFlags];
    }, [modalVisibilityFlags]);
}
