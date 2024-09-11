import { borderMenuAtom } from '@/app/atoms/borderMenuAtom';
import { convertReactColorToString } from '@/app/helpers/convertColor';
import { BorderSelection, CellBorderLine } from '@/app/quadratic-core-types';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { useBorders } from '@/app/ui/hooks/useBorders';
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
import { IconButton, Tooltip } from '@mui/material';
import { ClickEvent, Menu, MenuItem, SubMenu } from '@szhsin/react-menu';
import { useCallback } from 'react';
import { ColorResult } from 'react-color';
import { useRecoilValue } from 'recoil';
import './BorderMenu.css';

export function BorderMenu(): JSX.Element | null {
  const { color } = useRecoilValue(borderMenuAtom);
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
    <Menu
      menuButton={
        <div>
          <TooltipHint title="Borders">
            <span>
              <IconButton size="small" sx={{ borderRadius: '2px' }}>
                <BorderAllIcon fontSize={'small'} />
              </IconButton>
            </span>
          </TooltipHint>
        </div>
      }
    >
      <div className="borderMenu">
        <div className="borderMenuLines">
          <div className="borderMenuLine">
            <BorderSelectionButton
              type={'all'}
              title="All borders"
              icon={<BorderAllIcon className="h-5 w-5" />}
              onClick={handleChangeBorderSelection}
            />
            <BorderSelectionButton
              type={'inner'}
              title="Inner borders"
              icon={<BorderInnerIcon className="h-5 w-5" />}
              onClick={handleChangeBorderSelection}
            />
            <BorderSelectionButton
              type={'outer'}
              title="Outer borders"
              icon={<BorderOuterIcon className="h-5 w-5" />}
              onClick={handleChangeBorderSelection}
            />
            <BorderSelectionButton
              type={'horizontal'}
              title="Horizontal borders"
              icon={<BorderHorizontalIcon className="h-5 w-5" />}
              onClick={handleChangeBorderSelection}
            />
            <BorderSelectionButton
              type={'vertical'}
              title="Vertical borders"
              icon={<BorderVerticalIcon className="h-5 w-5" />}
              onClick={handleChangeBorderSelection}
            />
          </div>
          <div className="borderMenuLine">
            <BorderSelectionButton
              type={'left'}
              title="Left border"
              icon={<BorderLeftIcon className="h-5 w-5" />}
              onClick={handleChangeBorderSelection}
            />
            <BorderSelectionButton
              type={'top'}
              title="Top border"
              icon={<BorderTopIcon className="h-5 w-5" />}
              onClick={handleChangeBorderSelection}
            />
            <BorderSelectionButton
              type={'right'}
              title="Right border"
              icon={<BorderRightIcon className="h-5 w-5" />}
              onClick={handleChangeBorderSelection}
            />
            <BorderSelectionButton
              type={'bottom'}
              title="Bottom border"
              icon={<BorderBottomIcon className="h-5 w-5" />}
              onClick={handleChangeBorderSelection}
            />
            <BorderSelectionButton
              type={'clear'}
              title="Clear borders"
              icon={<BorderNoneIcon className="h-5 w-5" />}
              onClick={handleChangeBorderSelection}
            />
          </div>
        </div>
        <div className="borderMenuFormatting">
          <SubMenu
            className="borderSubmenu color-picker-submenu"
            id="FillBorderColorMenuID"
            label={<BorderColorIcon className="mr-1 h-5 w-5" style={{ color }}></BorderColorIcon>}
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
    </Menu>
  );
}

function BorderSelectionButton(props: {
  type: BorderSelection;
  title: string;
  icon: JSX.Element;
  disabled?: boolean;
  onClick: (type: BorderSelection) => void;
}): JSX.Element {
  const { type, title, icon, disabled, onClick } = props;
  return (
    <div
      className={`borderMenuType ${disabled ? 'borderDisabled' : ''}`}
      onClick={() => {
        if (!disabled) onClick(type);
      }}
    >
      <Tooltip title={title} arrow disableInteractive>
        {icon}
      </Tooltip>
    </div>
  );
}
