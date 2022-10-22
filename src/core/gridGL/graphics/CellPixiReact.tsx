import { useCallback } from 'react';
import { Graphics, Container } from '@inlet/react-pixi';
import { CodeIcon } from './primatives/CodeIcon';

import FastBitmapText from './primatives/FastBitmapText';

import { CELL_WIDTH, CELL_HEIGHT, CELL_TEXT_MARGIN_LEFT, CELL_TEXT_MARGIN_TOP } from '../../../constants/gridConstants';
import { CellTypes } from '../../gridDB/db';
import { colors } from '../../../theme/colors';
import useWhyDidYouUpdate from '../../../hooks/useWhyDidYouUpdate';
import { gridOffsets } from '../../gridDB/gridOffsets';

interface CellPixiReactProps {
  x: number;
  y: number;
  xPosition?: number;
  yPosition?: number;
  width?: number;
  height?: number;
  text: string;
  type: CellTypes;
  renderText: boolean;
  showCellTypeOutlines: boolean;
  array_cells?: [number, number][];
}

const CellPixiReact = (props: CellPixiReactProps) => {
  // Calculate X and Y positions
  const x_pos = props.xPosition;
  const y_pos = props.yPosition;

  const draw_outline = useCallback(
    (g) => {
      g.clear();
      if (x_pos === undefined || y_pos === undefined) return g;

      // Change outline color based on cell type
      if (props.type !== 'TEXT') {

        // don't draw normal cell outlines since it's handled by the grid
        // g.lineStyle(1, colors.cellColorUserText, 0.75, 0.5, true);

        if (props.type === 'PYTHON') {
          g.lineStyle(1, colors.cellColorUserPython, 0.75, 0.5, true);
        } else if (props.type === 'COMPUTED') {
          g.lineStyle(1, colors.independence, 0.75, 0.5, true);
        }

        // Draw outline
        g.drawRect(x_pos, y_pos, props.width, props.height);
      }

      // for cells that output an array, draw an outline around the array
      if (!props.array_cells) return g;

      // calculate array cells outline size
      let xEnd = x_pos + gridOffsets.getColumnPlacement(props.x).width;
      let yEnd = y_pos + gridOffsets.getRowPlacement(props.y).height;
      for (let i = 0; i < props.array_cells.length; i++) {
        const cell = props.array_cells[i];
        const xPlacement = gridOffsets.getColumnPlacement(cell[0]);
        xEnd = Math.max(xPlacement.x + xPlacement.width, xEnd);
        const yPlacement = gridOffsets.getRowPlacement(cell[1]);
        yEnd = Math.max(yPlacement.y + yPlacement.height, yEnd);
      }

      // draw array cells outline
      g.lineStyle(1, colors.cellColorUserPython, 0.35, 0.5, false, 1);
      g.drawRect(x_pos, y_pos, xEnd - x_pos, yEnd - y_pos);

      // double outline the master cell
      g.lineStyle(1, colors.cellColorUserPython, 0.25, 0.5, false, 1);
      g.drawRect(x_pos, y_pos, props.width, props.height);
    },
    [props.type, props.array_cells, props.x, props.y, x_pos, y_pos, props.width, props.height]
  );

  if (x_pos === undefined || y_pos === undefined || props.width === undefined || props.height === undefined) return null;

  return (
    <Container interactiveChildren={false} cullable={true}>
      <FastBitmapText
        x={x_pos + CELL_TEXT_MARGIN_LEFT}
        y={y_pos + CELL_TEXT_MARGIN_TOP}
        text={props.text}
        visible={props.renderText}
      />
      {props.showCellTypeOutlines && <Graphics draw={draw_outline} />}
      {props.type === 'PYTHON' && props.showCellTypeOutlines && <CodeIcon x_pos={x_pos} y_pos={y_pos}></CodeIcon>}
    </Container>
  );
};

export default CellPixiReact;
