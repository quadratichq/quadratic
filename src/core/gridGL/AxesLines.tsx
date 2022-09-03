import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Viewport } from 'pixi-viewport';
import { Graphics } from '@inlet/react-pixi';
import { useTicker } from './graphics/hooks/useTicker';
import { IGraphics } from './types/pixiRefs';

interface IProps {
    viewportRef: MutableRefObject<Viewport | undefined>;
    showGridAxes: boolean;
}

export function AxesLines(props: IProps) {
    const graphicsRef = useRef<IGraphics>(null);
    const [dirty, setDirty] = useState(false);

    const { viewportRef } = props;

    const setDirtyTrue = useCallback(() => setDirty(true), [setDirty]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        viewport.on('zoomed', setDirtyTrue);
        viewport.on('moved', setDirtyTrue);
        setDirty(true);
        return () => {
            viewport.off('zoomed', setDirtyTrue);
            viewport.off('moved', setDirtyTrue);
        }
    }, [viewportRef, setDirtyTrue]);

    useEffect(() => {
        setDirty(true);
    }, [props.showGridAxes]);

    useTicker(() => {
        const viewport = viewportRef.current;
        const graphics = graphicsRef.current;
        if (!viewport || !graphics) return;
        if (dirty) {
            graphics.clear();
            viewport.dirty = true;
            if (props.showGridAxes) {
                const bounds = viewport.getVisibleBounds();
                graphics.lineStyle(10, 0x000000, 0.35, 0, true);
                if (0 >= bounds.left && 0 <= bounds.right) {
                    graphics.moveTo(0, bounds.top);
                    graphics.lineTo(0, bounds.bottom);
                }
                if (0 >= bounds.top && 0 <= bounds.bottom) {
                    graphics.moveTo(bounds.left, 0);
                    graphics.lineTo(bounds.right, 0);
                }
            }
            setDirty(false);
        }
    });
    return <Graphics ref={graphicsRef} />;
};