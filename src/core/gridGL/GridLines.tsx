import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { Graphics, PixiRef } from '@inlet/react-pixi';
import {
    CELL_WIDTH,
    CELL_HEIGHT,
} from '../../constants/gridConstants';
import { colors } from '../../theme/colors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTicker } from './graphics/hooks/useTicker';

type IGraphics = PixiRef<typeof Graphics>;

interface IProps {
    ticker: PIXI.Ticker;
}

export const GridLines = (props: IProps) => {
    const gridRef = useRef<IGraphics>(null);
    const viewport = gridRef.current?.parent as Viewport;
    const [dirty, setDirty] = useState(false);

    const setDirtyTrue = useCallback(() => setDirty(true), [setDirty]);

    useEffect(() => {
        if (!viewport) return;
        viewport.on('zoomed', setDirtyTrue);
        viewport.on('moved', setDirtyTrue);
        return () => {
            viewport.off('zoomed', setDirtyTrue);
            viewport.off('moved', setDirtyTrue);
        }
    }, [viewport, setDirtyTrue]);

    const draw = (grid: PIXI.Graphics) => {
        if (!viewport) return;
        if (viewport.scale._x < 0.1) {
            grid.visible = false;
            return;
        } else if (viewport.scale._x < 0.3) {
            grid.alpha = viewport.scale._x * 3 - 0.3;
            grid.visible = true;
        } else {
            grid.alpha = 1;
        }

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
    };

    useTicker(props.ticker, () => {
        const grid = gridRef.current;
        if (!grid || !viewport) return;
        if (dirty) {
            draw(grid);
            setDirty(false);
        }
    });

    return <Graphics ref={gridRef} draw={draw} />;
};