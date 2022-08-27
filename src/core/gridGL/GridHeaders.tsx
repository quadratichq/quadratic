import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Viewport } from 'pixi-viewport';
import * as PIXI from 'pixi.js';
import {
    CELL_WIDTH,
    CELL_HEIGHT,
    LABEL_MAXIMUM_WIDTH_PERCENT,
    LABEL_MAXIMUM_HEIGHT_PERCENT,
    LABEL_PADDING_ROWS,
} from '../../constants/gridConstants';
import { colors } from '../../theme/colors';
import { Container, Graphics } from '@inlet/react-pixi';
import { IContainer, IGraphics } from './types/pixiRefs';
import { useTicker } from './graphics/hooks/useTicker';

interface IProps {
    viewportRef: MutableRefObject<Viewport | undefined>;
    labelFontSize?: number;
}

export function GridHeaders(props: IProps) {
    const graphicsRef = useRef<IGraphics>(null);
    const labelsRef = useRef<IContainer>(null);
    const cornerRef = useRef<IGraphics>(null);
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

    const characterSize = useMemo(() => {
        const label = new PIXI.BitmapText("X", {
            fontName: "OpenSans",
            fontSize: props.labelFontSize ?? 12,
            tint: 0x000000,
        });
        return { width: label.width, height: label.height };
    }, [props.labelFontSize]);

    const findInterval = (i: number): number => {
        if (i > 100) return 500;
        if (i > 50) return 100;
        if (i > 10) return 50;
        if (i > 5) return 10;
        return 5;
    };

    useTicker(() => {
        if (!dirty) return;
        const graphics = graphicsRef.current;
        const labels = labelsRef.current;
        const corner = cornerRef.current;
        const viewport = props.viewportRef.current;
        if (!graphics || !viewport || !labels || !corner) return;

        const bounds = viewport.getVisibleBounds();
        const cellWidth = CELL_WIDTH / viewport.scale.x;
        const cellHeight = CELL_HEIGHT / viewport.scale.x;
        const inverseScale = 1 / viewport.scale.x;

        graphics.clear();
        labels.children.forEach(child => child.visible = false);

        // caches labels so we can reuse them on rerender
        let labelIndex = 0;
        const getLabel = (): PIXI.BitmapText => {
            if (labelIndex < labels.children.length) {
                const label = labels.children[labelIndex];
                labelIndex++;
                label.visible = true;
                return label as PIXI.BitmapText;
            } else {
                const label = labels.addChild(new PIXI.BitmapText("", {
                    fontName: "OpenSans",
                    fontSize: props.labelFontSize ?? 12,
                    tint: 0x000000,
                }));
                label.anchor.set(0.5);
                return label;
            }
        };

        const drawHorizontal = () => {

            // draw bar
            graphics.beginFill(colors.headerBackgroundColor);
            graphics.drawRect(bounds.left, bounds.top, bounds.width, cellHeight);

            // calculate whether we need to skip numbers
            const xOffset = bounds.left % CELL_WIDTH;
            const leftOffset = bounds.left - xOffset - CELL_WIDTH / 2;
            const rightOffset = bounds.right - xOffset + CELL_WIDTH / 2;
            const leftNumberLength = Math.round(leftOffset / CELL_WIDTH - 1).toString().length;
            const rightNumberLength = Math.round(rightOffset / CELL_WIDTH - 1).toString().length;
            const largestWidth = Math.max(leftNumberLength, rightNumberLength) * characterSize.width;
            let mod = 0;
            if (largestWidth > CELL_WIDTH * viewport.scale.x * LABEL_MAXIMUM_WIDTH_PERCENT) {
                const skipNumbers = Math.ceil((cellWidth * (1 - LABEL_MAXIMUM_WIDTH_PERCENT)) / largestWidth);
                mod = findInterval(skipNumbers);
            }

            // create labels
            for (let x = leftOffset; x < rightOffset; x += CELL_WIDTH) {
                const column = Math.round(x / CELL_WIDTH - 1);
                if (mod === 0 || column % mod === 0) {
                    const label = getLabel();
                    label.text = column.toString();
                    label.position.set(x, bounds.top + cellHeight / 2);
                    label.scale.set(inverseScale);
                }
            }
        };

        let rowWidth: number;
        const drawVertical = () => {

            // determine width of row header
            const yOffset = bounds.top % CELL_HEIGHT;
            const topOffset = bounds.top - yOffset - CELL_HEIGHT / 2;
            const bottomOffset = bounds.bottom - yOffset - CELL_HEIGHT / 2;
            const topNumberLength = Math.round(topOffset / CELL_HEIGHT - 1).toString().length;
            const bottomNumberLength = Math.round(bottomOffset / CELL_HEIGHT - 1).toString().length;
            rowWidth = Math.max(topNumberLength, bottomNumberLength) * characterSize.width / viewport.scale.x + LABEL_PADDING_ROWS / viewport.scale.x * 2;
            rowWidth = Math.max(rowWidth, CELL_HEIGHT / viewport.scale.x);

            graphics.beginFill(colors.headerBackgroundColor);
            graphics.drawRect(bounds.left, bounds.top + CELL_HEIGHT / viewport.scale.x, rowWidth, bounds.height - CELL_HEIGHT / viewport.scale.x);
            let mod = 0;
            if (characterSize.height > CELL_HEIGHT * viewport.scale.x * LABEL_MAXIMUM_HEIGHT_PERCENT) {
                const skipNumbers = Math.ceil((cellHeight * (1 - LABEL_MAXIMUM_HEIGHT_PERCENT)) / characterSize.height);
                mod = findInterval(skipNumbers);
            }
            for (let y = topOffset; y < bottomOffset; y += CELL_HEIGHT) {
                const row = Math.round(y / CELL_HEIGHT - 1);
                if (mod === 0 || row % mod === 0) {
                    const label = getLabel();
                    label.text = row.toString();
                    label.position.set(bounds.left + rowWidth / 2, y);
                    label.scale.set(inverseScale);
                }
            }
        };

        const drawCorner = () => {
            corner.clear();
            corner.beginFill(colors.headerCornerBackgroundColor);
            corner.drawRect(bounds.left, bounds.top, rowWidth, cellHeight);
            corner.endFill();
        };

        drawHorizontal();
        drawVertical();
        drawCorner();

        setDirty(false);
    });

    return <Container>
        <Graphics ref={graphicsRef} />
        <Container ref={labelsRef} />
        <Graphics ref={cornerRef} />
    </Container>
}