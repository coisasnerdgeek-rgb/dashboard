import React, { useState, useCallback } from 'react';

interface ClickPosition {
    x: number;
    y: number;
}

interface UseModalPositionReturn {
    clickPosition: ClickPosition | undefined;
    capturePosition: (e: React.MouseEvent) => void;
    clearPosition: () => void;
}

/**
 * Hook to capture click position for modal positioning
 * Usage:
 * const { clickPosition, capturePosition } = useModalPosition();
 * <button onClick={(e) => { capturePosition(e); openModal(); }}>Open</button>
 * <Modal clickPosition={clickPosition} .../>
 */
export function useModalPosition(): UseModalPositionReturn {
    const [clickPosition, setClickPosition] = useState<ClickPosition | undefined>();

    const capturePosition = useCallback((e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setClickPosition({
            x: rect.left + rect.width / 2, // Center of button
            y: rect.bottom + 8, // 8px below button
        });
    }, []);

    const clearPosition = useCallback(() => {
        setClickPosition(undefined);
    }, []);

    return { clickPosition, capturePosition, clearPosition };
}
