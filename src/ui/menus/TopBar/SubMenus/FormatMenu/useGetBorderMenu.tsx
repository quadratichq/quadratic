import { ClickEvent, MenuItem, SubMenu, SubMenuProps } from '@szhsin/react-menu';
import { menuItemIconStyles } from '../menuStyles';
import { BorderType } from '../../../../../core/gridDB/gridTypes';
import {
  BorderColor,
  LineStyle,
  BorderAll,
  BorderOuter,
  BorderTop,
  BorderRight,
  BorderLeft,
  BorderBottom,
  BorderInner,
  BorderHorizontal,
  BorderVertical,
  BorderClear,
} from '@mui/icons-material';
import { Tooltip } from '@mui/material';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { ColorResult } from 'react-color';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../../../../atoms/gridInteractionStateAtom';
import { ChangeBorder, useBorders } from '../useBorders';
import './useGetBorderMenu.css';
import { colors } from '../../../../../theme/colors';
import { convertReactColorToString, convertTintToString } from '../../../../../helpers/convertColor';
import { Sheet } from '../../../../../core/gridDB/Sheet';
import { PixiApp } from '../../../../../core/gridGL/pixiApp/PixiApp';
import { QColorPicker } from '../../../../components/qColorPicker';

interface Props extends SubMenuProps {
  sheet: Sheet;
  app: PixiApp;
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
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const multiCursor = interactionState.showMultiCursor;

  const [lineStyle, setLineStyle] = useState<BorderType | undefined>();
  const [borderSelection, setBorderSelection] = useState<BorderSelection>(BorderSelection.none);
  const defaultColor = convertTintToString(colors.defaultBorderColor);
  const [color, setColor] = useState<string>(defaultColor);

  const { changeBorders, clearBorders } = useBorders(props.sheet, props.app);

  // clear border type when changing selection
  useEffect(() => {
    setBorderSelection(0);
  }, [interactionState]);

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
        <Tooltip title={props.title} arrow>
          {props.label}
        </Tooltip>
      </div>
    );
  };

  return (
    <SubMenu
      label={
        <Fragment>
          <BorderAll style={menuItemIconStyles}></BorderAll>
          <span>Border</span>
        </Fragment>
      }
    >
      <div className="borderMenu">
        <div className="borderMenuLines">
          <div className="borderMenuLine">
            <BorderSelectionButton type={BorderSelection.all} title="All borders" label={<BorderAll />} />
            <BorderSelectionButton
              type={BorderSelection.inner}
              title="Inner borders"
              label={<BorderInner />}
              disabled={!multiCursor}
            />
            <BorderSelectionButton type={BorderSelection.outer} title="Outer borders" label={<BorderOuter />} />
            <BorderSelectionButton
              type={BorderSelection.horizontal}
              title="Horizontal borders"
              label={<BorderHorizontal />}
              disabled={!multiCursor}
            />
            <BorderSelectionButton
              type={BorderSelection.vertical}
              title="Vertical borders"
              label={<BorderVertical />}
              disabled={!multiCursor}
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
            className="borderSubmenu"
            id="FillBorderColorMenuID"
            menuStyles={{
              padding: '0px',
            }}
            label={<BorderColor style={{ ...menuItemIconStyles, color }}></BorderColor>}
          >
            <QColorPicker onChangeComplete={handleChangeBorderColor}></QColorPicker>
          </SubMenu>
          <SubMenu
            id="BorderLineStyleMenuID"
            className="borderSubmenu"
            label={<LineStyle style={menuItemIconStyles}></LineStyle>}
          >
            <MenuItem onClick={(e) => handleChangeBorderType(e)}>
              <div className="lineStyleBorder normalBorder"></div>
            </MenuItem>
            <MenuItem onClick={(e) => handleChangeBorderType(e, BorderType.line2)}>
              <div className="lineStyleBorder doubleBorder"></div>
            </MenuItem>
            <MenuItem onClick={(e) => handleChangeBorderType(e, BorderType.line3)}>
              <div className="lineStyleBorder tripleBorder"></div>
            </MenuItem>
            <MenuItem onClick={(e) => handleChangeBorderType(e, BorderType.dashed)}>
              <div className="lineStyleBorder dashedBorder"></div>
            </MenuItem>
            <MenuItem onClick={(e) => handleChangeBorderType(e, BorderType.dotted)}>
              <div className="lineStyleBorder dottedBorder"></div>
            </MenuItem>
            <MenuItem onClick={(e) => handleChangeBorderType(e, BorderType.double)}>
              <div className="lineStyleBorder twoLineBorder"></div>
            </MenuItem>
          </SubMenu>
        </div>
      </div>
    </SubMenu>
  );
}
