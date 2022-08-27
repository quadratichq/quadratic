import { Viewport } from 'pixi-viewport';
import { useState } from 'react';

export function useViewportChanged(viewport?: Viewport): boolean {
    const [lastX, setLastX] = useState(Infinity);
    const [lastY, setLastY] = useState(Infinity);
    const [lastScaleX, setLastScaleX] = useState(Infinity);
    const [lastScaleY, setLastScaleY] = useState(Infinity);

    if (!viewport) return false;

    if (lastX !== viewport.x || lastY !== viewport.y || lastScaleX !== viewport.scale.x || lastScaleY !== viewport.scale.y) {
        setLastX(viewport.x);
        setLastY(viewport.y);
        setLastScaleX(viewport.scale.x);
        setLastScaleY(viewport.scale.y);
        return true;
    }
    return false;
}