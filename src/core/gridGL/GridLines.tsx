import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { Graphics } from '@inlet/react-pixi';
import {
    CELL_WIDTH,
    CELL_HEIGHT,
} from '../../constants/gridConstants';
import { colors } from '../../theme/colors';
import { useTicker } from './graphics/hooks/useTicker';
import { IGraphics } from './types/pixiRefs';
import { alphaGridLines } from '../gridUtils';

interface IProps {
    viewportRef: MutableRefObject<Viewport | undefined>;
}

export function GridLines(props: IProps) {
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

    const draw = useCallback((grid: PIXI.Graphics) => {
        const viewport = props.viewportRef.current;
        if (!viewport) return;
        const gridAlpha = alphaGridLines(viewport);
        if (gridAlpha === false) {
            grid.visible = false;
            return;
        }
        grid.alpha = gridAlpha;
        grid.visible = true;

        grid.clear();

        // Configure Line Style
        grid.lineStyle(1, colors.gridLines, 0.25, 0.5, true);

        const bounds = viewport.getVisibleBounds();
        const x_offset = bounds.left % CELL_WIDTH;
        const y_offset = bounds.top % CELL_HEIGHT;

        // Draw vertical lines
        for (let x = bounds.left; x <= bounds.right + CELL_WIDTH; x += CELL_WIDTH) {
            grid.moveTo(x - x_offset, bounds.top);
            grid.lineTo(x - x_offset, bounds.bottom);
        }

        // Draw horizontal lines
        for (let y = bounds.top; y <= bounds.bottom + CELL_HEIGHT; y += CELL_HEIGHT) {
            grid.moveTo(bounds.left, y - y_offset);
            grid.lineTo(bounds.right, y - y_offset);
        }
    }, [props.viewportRef]);

    useTicker(() => {
        const grid = graphicsRef.current;
        if (!grid) return;
        if (dirty) {
            draw(grid);
            setDirty(false);
        }
    });

    return <Graphics ref={graphicsRef} draw={draw} />;
};