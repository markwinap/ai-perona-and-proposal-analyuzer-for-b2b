"use client";

import { useCallback, useState } from "react";
import { Button, Tour, type TourProps } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";

export interface ModalTourStep {
    title: string;
    description: string;
    target?: React.RefObject<HTMLElement | null>;
}

/**
 * Provides a help-tour toggle for any modal.
 *
 * Returns:
 *  - `tourOpen` / `setTourOpen` — state pair
 *  - `HelpButton` — a small ? icon-button to drop into a modal title or footer
 *  - `TourOverlay` — a `<Tour>` element to place at the bottom of the modal JSX
 */
export function useModalTour(steps: ModalTourStep[]) {
    const [tourOpen, setTourOpen] = useState(false);

    const resolvedSteps: TourProps["steps"] = steps.map((s) => ({
        title: s.title,
        description: s.description,
        target: s.target?.current ? () => s.target!.current! : null,
    }));

    const HelpButton = useCallback(
        ({ style }: { style?: React.CSSProperties } = {}) => (
            <Button
                type="text"
                size="small"
                icon={<QuestionCircleOutlined />}
                onClick={() => setTourOpen(true)}
                aria-label="Open help tour"
                style={style}
            />
        ),
        [],
    );

    const TourOverlay = useCallback(
        () => (
            <Tour
                open={tourOpen}
                steps={resolvedSteps}
                onClose={() => setTourOpen(false)}
                onFinish={() => setTourOpen(false)}
            />
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tourOpen],
    );

    return { tourOpen, setTourOpen, HelpButton, TourOverlay };
}
