import { borderMenuAtom } from '@/app/atoms/borderMenuAtom';
import { convertReactColorToString } from '@/app/helpers/convertColor';
import { BorderSelection, CellBorderLine } from '@/app/quadratic-core-types';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
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
import { useBorders } from '@/app/ui/menus/TopBar/SubMenus/useBorders';
import { Tooltip } from '@mui/material';
import { ClickEvent, MenuItem, SubMenu } from '@szhsin/react-menu';
import { useCallback } from 'react';
import { ColorResult } from 'react-color';
import { useRecoilValue } from 'recoil';
import './useGetBorderMenu.css';

export function useGetBorderMenu(): JSX.Element | null {
  const borderMenuState = useRecoilValue(borderMenuAtom);
  const { disabled, changeBorders } = useBorders();

  const handleChangeBorderSelection = useCallback(
    (selection: BorderSelection) => {
      changeBorders({ selection });
    },
    [changeBorders]
  );

  const handleChangeBorderColor = useCallback(
    (pickedColor: ColorResult) => {
      const color = convertReactColorToString(pickedColor);
      changeBorders({ color });
    },
    [changeBorders]
  );

  const handleChangeBorderLine = useCallback(
    (e: ClickEvent, line: CellBorderLine): void => {
      e.keepOpen = true;
      changeBorders({ line });
    },
    [changeBorders]
  );

  if (disabled) {
    return null;
  }

  return (
    <div className="borderMenu">
      <div className="borderMenuLines">
        <div className="borderMenuLine">
          <BorderSelectionButton
            type={'all'}
            title="All borders"
            label={<BorderAllIcon className="h-5 w-5" />}
            onClick={handleChangeBorderSelection}
          />
          <BorderSelectionButton
            type={'inner'}
            title="Inner borders"
            label={<BorderInnerIcon className="h-5 w-5" />}
            onClick={handleChangeBorderSelection}
          />
          <BorderSelectionButton
            type={'outer'}
            title="Outer borders"
            label={<BorderOuterIcon className="h-5 w-5" />}
            onClick={handleChangeBorderSelection}
          />
          <BorderSelectionButton
            type={'horizontal'}
            title="Horizontal borders"
            label={<BorderHorizontalIcon className="h-5 w-5" />}
            onClick={handleChangeBorderSelection}
          />
          <BorderSelectionButton
            type={'vertical'}
            title="Vertical borders"
            label={<BorderVerticalIcon className="h-5 w-5" />}
            onClick={handleChangeBorderSelection}
          />
        </div>
        <div className="borderMenuLine">
          <BorderSelectionButton
            type={'left'}
            title="Left border"
            label={<BorderLeftIcon className="h-5 w-5" />}
            onClick={handleChangeBorderSelection}
          />
          <BorderSelectionButton
            type={'top'}
            title="Top border"
            label={<BorderTopIcon className="h-5 w-5" />}
            onClick={handleChangeBorderSelection}
          />
          <BorderSelectionButton
            type={'right'}
            title="Right border"
            label={<BorderRightIcon className="h-5 w-5" />}
            onClick={handleChangeBorderSelection}
          />
          <BorderSelectionButton
            type={'bottom'}
            title="Bottom border"
            label={<BorderBottomIcon className="h-5 w-5" />}
            onClick={handleChangeBorderSelection}
          />
          <BorderSelectionButton
            type={'clear'}
            title="Clear borders"
            label={<BorderNoneIcon className="h-5 w-5" />}
            onClick={handleChangeBorderSelection}
          />
        </div>
      </div>
      <div className="borderMenuFormatting">
        <SubMenu
          className="borderSubmenu color-picker-submenu"
          id="FillBorderColorMenuID"
          label={<BorderColorIcon className="mr-1 h-5 w-5" style={{ color: borderMenuState.color }}></BorderColorIcon>}
        >
          <QColorPicker onChangeComplete={handleChangeBorderColor} />
        </SubMenu>
        <SubMenu
          id="BorderLineStyleMenuID"
          className="borderSubmenu"
          label={<BorderStyleIcon className="mr-1 h-5 w-5" />}
        >
          <MenuItem onClick={(e) => handleChangeBorderLine(e, 'line1')}>
            <div className="lineStyleBorder normalBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderLine(e, 'line2')}>
            <div className="lineStyleBorder doubleBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderLine(e, 'line3')}>
            <div className="lineStyleBorder tripleBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderLine(e, 'dashed')}>
            <div className="lineStyleBorder dashedBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderLine(e, 'dotted')}>
            <div className="lineStyleBorder dottedBorder"></div>
          </MenuItem>
          <MenuItem onClick={(e) => handleChangeBorderLine(e, 'double')}>
            <div className="lineStyleBorder twoLineBorder"></div>
          </MenuItem>
        </SubMenu>
      </div>
    </div>
  );
}

function BorderSelectionButton(props: {
  type: BorderSelection;
  title: string;
  label: JSX.Element;
  disabled?: boolean;
  onClick: (type: BorderSelection) => void;
}): JSX.Element {
  const { type, title, label, disabled, onClick } = props;
  return (
    <div
      className={`borderMenuType ${disabled ? 'borderDisabled' : ''}`}
      onClick={() => {
        if (!disabled) onClick(type);
      }}
    >
      <Tooltip title={title} arrow disableInteractive>
        {label}
      </Tooltip>
    </div>
  );
}
