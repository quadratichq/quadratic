import {
  BorderAll,
  BorderBottom,
  BorderClear,
  // BorderClear,
  BorderColor,
  BorderHorizontal,
  BorderInner,
  BorderLeft,
  BorderOuter,
  BorderRight,
  BorderTop,
  BorderVertical,
  LineStyle,
} from '@mui/icons-material';
import { Tooltip } from '@mui/material';
import { ClickEvent, MenuItem, SubMenu } from '@szhsin/react-menu';
import { useCallback, useEffect, useState } from 'react';
import { ColorResult } from 'react-color';
import { sheets } from '../../../../../grid/controller/Sheets';
import { convertReactColorToString, convertTintToString } from '../../../../../helpers/convertColor';
import { BorderSelection, CellBorderLine } from '../../../../../quadratic-core/quadratic_core';
import { colors } from '../../../../../theme/colors';
import { QColorPicker } from '../../../../components/qColorPicker';
import { ChangeBorder, useBorders } from '../useBorders';
import './useGetBorderMenu.css';

export function useGetBorderMenu(): JSX.Element {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;

  const [lineStyle, setLineStyle] = useState<CellBorderLine | undefined>();
  const [borderSelection, setBorderSelection] = useState<BorderSelection | undefined>();
  const defaultColor = convertTintToString(colors.defaultBorderColor);
  const [color, setColor] = useState<string>(defaultColor);

  const { changeBorders } = useBorders();

  const clearSelection = useCallback(() => setBorderSelection(0), []);
  // clear border type when changing selection
  useEffect(() => {
    window.addEventListener('cursor-position', clearSelection);
    return () => window.removeEventListener('cursor-position', clearSelection);
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

  return (
    <div className="borderMenu">
      <div className="borderMenuLines">
        <div className="borderMenuLine">
          <BorderSelectionButton type={BorderSelection.All} title="All borders" label={<BorderAll />} />
          <BorderSelectionButton
            type={BorderSelection.Inner}
            title="Inner borders"
            label={<BorderInner />}
            disabled={!cursor.multiCursor}
          />
          <BorderSelectionButton type={BorderSelection.Outer} title="Outer borders" label={<BorderOuter />} />
          <BorderSelectionButton
            type={BorderSelection.Horizontal}
            title="Horizontal borders"
            label={<BorderHorizontal />}
            disabled={!cursor.multiCursor}
          />
          <BorderSelectionButton
            type={BorderSelection.Vertical}
            title="Vertical borders"
            label={<BorderVertical />}
            disabled={!cursor.multiCursor}
          />
        </div>
        <div className="borderMenuLine">
          <BorderSelectionButton type={BorderSelection.Left} title="Left border" label={<BorderLeft />} />
          <BorderSelectionButton type={BorderSelection.Top} title="Top border" label={<BorderTop />} />
          <BorderSelectionButton type={BorderSelection.Right} title="Right border" label={<BorderRight />} />
          <BorderSelectionButton type={BorderSelection.Bottom} title="Bottom border" label={<BorderBottom />} />
          <BorderSelectionButton type={BorderSelection.Clear} title="Clear borders" label={<BorderClear />} />
        </div>
      </div>
      <div className="borderMenuFormatting">
        <SubMenu
          className="borderSubmenu color-picker-submenu"
          id="FillBorderColorMenuID"
          menuStyle={{
            padding: '0px',
          }}
          label={<BorderColor style={{ marginRight: '0.25rem' }}></BorderColor>}
        >
          <QColorPicker onChangeComplete={handleChangeBorderColor} />
        </SubMenu>
        <SubMenu
          id="BorderLineStyleMenuID"
          className="borderSubmenu"
          label={<LineStyle style={{ marginRight: '0.25rem' }}></LineStyle>}
        >
          <MenuItem onClick={(e) => handleChangeBorderType(e)}>
            <div className="lineStyleBorder normalBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, CellBorderLine.Line2)}>
            <div className="lineStyleBorder doubleBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, CellBorderLine.Line3)}>
            <div className="lineStyleBorder tripleBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, CellBorderLine.Dashed)}>
            <div className="lineStyleBorder dashedBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, CellBorderLine.Dotted)}>
            <div className="lineStyleBorder dottedBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, CellBorderLine.Double)}>
            <div className="lineStyleBorder twoLineBorder"></div>
          </MenuItem>
        </SubMenu>
      </div>
    </div>
  );
}
