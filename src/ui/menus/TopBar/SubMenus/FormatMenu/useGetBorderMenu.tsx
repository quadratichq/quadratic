import { ClickEvent, MenuHeader, MenuItem, SubMenu, SubMenuProps } from '@szhsin/react-menu'
import { menuItemIconStyles } from '../menuStyles';
import { BorderType } from '../../../../../core/gridDB/db';
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
import { Fragment, useCallback, useEffect, useState } from 'react';
import { ColorResult, CompactPicker } from 'react-color';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../../../../atoms/gridInteractionStateAtom';
import { PixiApp } from '../../../../../core/gridGL/pixiApp/PixiApp';
import { ChangeBorder, useBorders } from '../useBorders';
import './useGetBorderMenu.css';
import { colors } from '../../../../../theme/colors';
import { convertReactColorToString, convertTintToString } from '../../../../../helpers/convertColor';

interface Props extends SubMenuProps {
  app?: PixiApp;
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

  const { changeBorders, clearBorders } = useBorders(props.app);

  // clear border type when changing selection
  useEffect(() => {
    setBorderSelection(0);
  }, [interactionState]);

  const handleChangeBorders = useCallback((borderSelection: BorderSelection, color: string, lineStyle?: BorderType): void => {
    if (!borderSelection) return;
    const borders: ChangeBorder = {};
    if (color !== defaultColor) borders.color = color;
    if (lineStyle) borders.type = lineStyle;
    switch (borderSelection) {
      case BorderSelection.all:
        borders.borderAll = true; break;
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
        borders.borderHorizontal = true; break;
      case BorderSelection.vertical:
        borders.borderVertical = true; break;
      case BorderSelection.left:
        borders.borderLeft = true; break;
      case BorderSelection.top:
        borders.borderTop = true; break;
      case BorderSelection.right:
        borders.borderRight = true; break;
      case BorderSelection.bottom:
        borders.borderBottom = true; break;
    }
    changeBorders(borders);
  }, [changeBorders, defaultColor]);

  const handleChangeBorderColor = useCallback((change: ColorResult) => {
    const converted = convertReactColorToString(change);
    if (converted !== color) {
      setColor(converted);
    }
    handleChangeBorders(borderSelection, converted, lineStyle);
  }, [color, setColor, borderSelection, handleChangeBorders, lineStyle]);

  const handleChangeBorderType = useCallback((e: ClickEvent, change?: BorderType): void => {
    e.keepOpen = true;
    if (change !== lineStyle) {
      setLineStyle(change);
    }
    handleChangeBorders(borderSelection, color, change);
  }, [lineStyle, setLineStyle, borderSelection, color, handleChangeBorders]);

  const BorderSelectionButton = (props: { type: BorderSelection, label: JSX.Element, disabled?: boolean }): JSX.Element => {
    return (
      <div
        className={`borderMenuType ${borderSelection === props.type ? 'borderSelected' : ''} ${props.disabled ? 'borderDisabled' : ''}`}
        onClick={() => {
          if (!props.disabled) {
            setBorderSelection(props.type);
            handleChangeBorders(props.type, color);
          }
        }}
      >
        {props.label}
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
            <BorderSelectionButton type={BorderSelection.all} label={<BorderAll />} />
            <BorderSelectionButton type={BorderSelection.inner} label={<BorderInner />} disabled={!multiCursor} />
            <BorderSelectionButton type={BorderSelection.outer} label={<BorderOuter />} />
            <BorderSelectionButton type={BorderSelection.horizontal} label={<BorderHorizontal />} disabled={!multiCursor} />
            <BorderSelectionButton type={BorderSelection.vertical} label={<BorderVertical />} disabled={!multiCursor} />
          </div>
          <div className="borderMenuLine">
            <BorderSelectionButton type={BorderSelection.left} label={<BorderLeft/>} />
            <BorderSelectionButton type={BorderSelection.top} label={<BorderTop/>} />
            <BorderSelectionButton type={BorderSelection.right} label={<BorderRight/>} />
            <BorderSelectionButton type={BorderSelection.bottom} label={<BorderBottom/>} />
            <div className="borderMenuType" onClick={clearBorders}><BorderClear/></div>
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
            <MenuHeader>Border Color</MenuHeader>
            <CompactPicker onChangeComplete={handleChangeBorderColor} />
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