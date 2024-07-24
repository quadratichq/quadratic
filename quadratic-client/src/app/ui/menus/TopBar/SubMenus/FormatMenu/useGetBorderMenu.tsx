import { events } from '@/app/events/events';
import { BorderSelection, CellBorderLine } from '@/app/quadratic-core-types';
import {
  BorderAllIcon,
  BorderBottomIcon,
  BorderColorIcon,
  BorderHorizontalIcon,
  BorderInnerIcon,
  BorderLeftIcon,
  BorderNoneIcon,
  BorderOuterIcon,
  BorderRightIcon,
  BorderStyleIcon,
  BorderTopIcon,
  BorderVerticalIcon,
} from '@/app/ui/icons';
import { Tooltip } from '@mui/material';
import { ClickEvent, MenuItem, SubMenu } from '@szhsin/react-menu';
import { useCallback, useEffect, useState } from 'react';
import { ColorResult } from 'react-color';
import { sheets } from '../../../../../grid/controller/Sheets';
import { convertReactColorToString, convertTintToString } from '../../../../../helpers/convertColor';
import { colors } from '../../../../../theme/colors';
import { QColorPicker } from '../../../../components/qColorPicker';
import { ChangeBorder, useBorders } from '../useBorders';
import './useGetBorderMenu.css';

export function useGetBorderMenu(): JSX.Element | null {
  const [lineStyle, setLineStyle] = useState<CellBorderLine | undefined>();
  const [borderSelection, setBorderSelection] = useState<BorderSelection | undefined>();
  const defaultColor = convertTintToString(colors.defaultBorderColor);
  const [color, setColor] = useState<string>(defaultColor);

  const { changeBorders } = useBorders();

  const [multiCursor, setMultiCursor] = useState(!!sheets.sheet?.cursor.multiCursor);
  const clearSelection = useCallback(() => {
    setBorderSelection('clear');
    setMultiCursor(!!sheets.sheet.cursor.multiCursor);
  }, []);

  // clear border type when changing selection
  useEffect(() => {
    events.on('cursorPosition', clearSelection);
    return () => {
      events.off('cursorPosition', clearSelection);
    };
  }, [clearSelection]);

  const handleChangeBorders = useCallback(
    (borderSelection: BorderSelection | undefined, color: string, lineStyle?: CellBorderLine): void => {
      if (borderSelection === undefined) return;
      const borders: ChangeBorder = { selection: borderSelection, type: lineStyle };
      if (color !== defaultColor) borders.color = color;
      changeBorders(borders);
    },
    [changeBorders, defaultColor]
  );

  const handleChangeBorderColor = useCallback(
    (change: ColorResult) => {
      const converted = convertReactColorToString(change);
      if (converted !== color) {
        setColor(converted);
      }
      handleChangeBorders(borderSelection, converted, lineStyle);
    },
    [color, setColor, borderSelection, handleChangeBorders, lineStyle]
  );

  const handleChangeBorderType = useCallback(
    (e: ClickEvent, change?: CellBorderLine): void => {
      e.keepOpen = true;
      if (change !== lineStyle) {
        setLineStyle(change);
      }
      handleChangeBorders(borderSelection, color, change);
    },
    [lineStyle, setLineStyle, borderSelection, color, handleChangeBorders]
  );

  const BorderSelectionButton = (props: {
    type: BorderSelection;
    label: JSX.Element;
    disabled?: boolean;
    title: string;
  }): JSX.Element => {
    return (
      <div
        className={`borderMenuType ${props.disabled ? 'borderDisabled' : ''}`}
        onClick={() => {
          if (!props.disabled) {
            setBorderSelection(props.type);
            handleChangeBorders(props.type, color);
          }
        }}
      >
        <Tooltip title={props.title} arrow disableInteractive>
          {props.label}
        </Tooltip>
      </div>
    );
  };

  const cursor = sheets.sheet.cursor;
  if ((cursor.multiCursor && cursor.multiCursor.length > 1) || cursor.columnRow !== undefined) {
    return null;
  }

  return (
    <div className="borderMenu">
      <div className="borderMenuLines">
        <div className="borderMenuLine">
          <BorderSelectionButton type={'all'} title="All borders" label={<BorderAllIcon className="h-5 w-5" />} />
          <BorderSelectionButton
            type={'inner'}
            title="Inner borders"
            label={<BorderInnerIcon className="h-5 w-5" />}
            disabled={!multiCursor}
          />
          <BorderSelectionButton type={'outer'} title="Outer borders" label={<BorderOuterIcon className="h-5 w-5" />} />
          <BorderSelectionButton
            type={'horizontal'}
            title="Horizontal borders"
            label={<BorderHorizontalIcon className="h-5 w-5" />}
            disabled={!multiCursor}
          />
          <BorderSelectionButton
            type={'vertical'}
            title="Vertical borders"
            label={<BorderVerticalIcon className="h-5 w-5" />}
            disabled={!multiCursor}
          />
        </div>
        <div className="borderMenuLine">
          <BorderSelectionButton type={'left'} title="Left border" label={<BorderLeftIcon className="h-5 w-5" />} />
          <BorderSelectionButton type={'top'} title="Top border" label={<BorderTopIcon className="h-5 w-5" />} />
          <BorderSelectionButton type={'right'} title="Right border" label={<BorderRightIcon className="h-5 w-5" />} />
          <BorderSelectionButton
            type={'bottom'}
            title="Bottom border"
            label={<BorderBottomIcon className="h-5 w-5" />}
          />
          <BorderSelectionButton type={'clear'} title="Clear borders" label={<BorderNoneIcon className="h-5 w-5" />} />
        </div>
      </div>
      <div className="borderMenuFormatting">
        <SubMenu
          className="borderSubmenu color-picker-submenu"
          id="FillBorderColorMenuID"
          label={<BorderColorIcon className="mr-1 h-5 w-5"></BorderColorIcon>}
        >
          <QColorPicker onChangeComplete={handleChangeBorderColor} />
        </SubMenu>
        <SubMenu
          id="BorderLineStyleMenuID"
          className="borderSubmenu"
          label={<BorderStyleIcon className="mr-1 h-5 w-5" />}
        >
          <MenuItem onClick={(e) => handleChangeBorderType(e)}>
            <div className="lineStyleBorder normalBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, 'line2')}>
            <div className="lineStyleBorder doubleBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, 'line3')}>
            <div className="lineStyleBorder tripleBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, 'dashed')}>
            <div className="lineStyleBorder dashedBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, 'dotted')}>
            <div className="lineStyleBorder dottedBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, 'double')}>
            <div className="lineStyleBorder twoLineBorder"></div>
          </MenuItem>
        </SubMenu>
      </div>
    </div>
  );
}
