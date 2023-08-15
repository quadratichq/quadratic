import {
  BorderAll,
  BorderBottom,
  BorderClear,
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
import { ClickEvent, MenuItem, SubMenu, SubMenuProps } from '@szhsin/react-menu';
import { useCallback, useEffect, useState } from 'react';
import { ColorResult } from 'react-color';
import { SheetController } from '../../../../../grid/controller/SheetController';
import { convertReactColorToString, convertTintToString } from '../../../../../helpers/convertColor';
import { BorderType, BorderTypeEnum } from '../../../../../schemas';
import { colors } from '../../../../../theme/colors';
import { QColorPicker } from '../../../../components/qColorPicker';
import { ChangeBorder, useBorders } from '../useBorders';
import './useGetBorderMenu.css';

interface Props extends SubMenuProps {
  sheetController: SheetController;
}

enum BorderSelection {
  none = 0,
  all,
  inner,
  outer,
  horizontal,
  vertical,
  left,
  top,
  right,
  bottom,
  clear,
}

export function useGetBorderMenu(props: Props): JSX.Element {
  const { sheet } = props.sheetController;
  const cursor = sheet.cursor;

  const [lineStyle, setLineStyle] = useState<BorderType | undefined>();
  const [borderSelection, setBorderSelection] = useState<BorderSelection>(BorderSelection.none);
  const defaultColor = convertTintToString(colors.defaultBorderColor);
  const [color, setColor] = useState<string>(defaultColor);

  const { changeBorders, clearBorders } = useBorders(props.sheetController);

  const clearSelection = useCallback(() => setBorderSelection(0), []);
  // clear border type when changing selection
  useEffect(() => {
    window.addEventListener('cursor-position', clearSelection);
    return () => window.removeEventListener('cursor-position', clearSelection);
  }, [clearSelection]);

  const handleChangeBorders = useCallback(
    (borderSelection: BorderSelection, color: string, lineStyle?: BorderType): void => {
      if (!borderSelection) return;
      if (borderSelection === BorderSelection.clear) {
        clearBorders();
        return;
      }
      const borders: ChangeBorder = {};
      if (color !== defaultColor) borders.color = color;
      if (lineStyle) borders.type = lineStyle;
      switch (borderSelection) {
        case BorderSelection.all:
          borders.borderAll = true;
          break;
        case BorderSelection.outer:
          borders.borderLeft = true;
          borders.borderRight = true;
          borders.borderTop = true;
          borders.borderBottom = true;
          break;
        case BorderSelection.inner:
          borders.borderHorizontal = true;
          borders.borderVertical = true;
          break;
        case BorderSelection.horizontal:
          borders.borderHorizontal = true;
          break;
        case BorderSelection.vertical:
          borders.borderVertical = true;
          break;
        case BorderSelection.left:
          borders.borderLeft = true;
          break;
        case BorderSelection.top:
          borders.borderTop = true;
          break;
        case BorderSelection.right:
          borders.borderRight = true;
          break;
        case BorderSelection.bottom:
          borders.borderBottom = true;
          break;
      }
      changeBorders(borders);
    },
    [changeBorders, defaultColor, clearBorders]
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
    (e: ClickEvent, change?: BorderType): void => {
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
          <BorderSelectionButton type={BorderSelection.all} title="All borders" label={<BorderAll />} />
          <BorderSelectionButton
            type={BorderSelection.inner}
            title="Inner borders"
            label={<BorderInner />}
            disabled={!cursor.multiCursor}
          />
          <BorderSelectionButton type={BorderSelection.outer} title="Outer borders" label={<BorderOuter />} />
          <BorderSelectionButton
            type={BorderSelection.horizontal}
            title="Horizontal borders"
            label={<BorderHorizontal />}
            disabled={!cursor.multiCursor}
          />
          <BorderSelectionButton
            type={BorderSelection.vertical}
            title="Vertical borders"
            label={<BorderVertical />}
            disabled={!cursor.multiCursor}
          />
        </div>
        <div className="borderMenuLine">
          <BorderSelectionButton type={BorderSelection.left} title="Left border" label={<BorderLeft />} />
          <BorderSelectionButton type={BorderSelection.top} title="Top border" label={<BorderTop />} />
          <BorderSelectionButton type={BorderSelection.right} title="Right border" label={<BorderRight />} />
          <BorderSelectionButton type={BorderSelection.bottom} title="Bottom border" label={<BorderBottom />} />
          <BorderSelectionButton type={BorderSelection.clear} title="Clear borders" label={<BorderClear />} />
        </div>
      </div>
      <div className="borderMenuFormatting">
        <SubMenu
          className="borderSubmenu color-picker-submenu"
          id="FillBorderColorMenuID"
          menuStyles={{
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
          <MenuItem onClick={(e) => handleChangeBorderType(e, BorderTypeEnum.line2)}>
            <div className="lineStyleBorder doubleBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, BorderTypeEnum.line3)}>
            <div className="lineStyleBorder tripleBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, BorderTypeEnum.dashed)}>
            <div className="lineStyleBorder dashedBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, BorderTypeEnum.dotted)}>
            <div className="lineStyleBorder dottedBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderType(e, BorderTypeEnum.double)}>
            <div className="lineStyleBorder twoLineBorder"></div>
          </MenuItem>
        </SubMenu>
      </div>
    </div>
  );
}
