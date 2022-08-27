import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Viewport } from 'pixi-viewport';
import { Graphics, PixiRef } from '@inlet/react-pixi';
import { useTicker } from './graphics/hooks/useTicker';

type IGraphics = PixiRef<typeof Graphics>;

interface IProps {
    viewportRef: MutableRefObject<Viewport | undefined>;
    showGridAxes: boolean;
}

export function AxesLines(props: IProps) {
    const graphicsRef = useRef<IGraphics>(null);
    const [dirty, setDirty] = useState(false);

    const setDirtyTrue = useCallback(() => setDirty(true), [setDirty]);

    useEffect(() => {
        const viewport = props.viewportRef.current;
        if (!viewport) return;
        viewport.on('zoomed', setDirtyTrue);
        viewport.on('moved', setDirtyTrue);
        setDirty(true);
        return () => {
            viewport.off('zoomed', setDirtyTrue);
            viewport.off('moved', setDirtyTrue);
        }
    }, [props.viewportRef, setDirtyTrue]);

    useEffect(() => {
        setDirty(true);
    }, [props.showGridAxes]);

    useTicker(() => {
        const viewport = props.viewportRef.current;
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