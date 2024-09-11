import { convertReactColorToString } from '@/app/helpers/convertColor';
import { BorderSelection, CellBorderLine } from '@/app/quadratic-core-types';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import { useBorders } from '@/app/ui/hooks/useBorders';
import {
  BorderAllIcon,
  BorderBottomIcon,
  BorderHorizontalIcon,
  BorderInnerIcon,
  BorderLeftIcon,
  BorderNoneIcon,
  BorderOuterIcon,
  BorderRightIcon,
  BorderTopIcon,
  BorderVerticalIcon,
} from '@/app/ui/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useCallback } from 'react';
import { ColorResult } from 'react-color';

export function BorderMenu(): JSX.Element | null {
  // const { color } = useRecoilValue(borderMenuAtom);
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
    (e: React.MouseEvent<HTMLDivElement>, line: CellBorderLine): void => {
      // e.keepOpen = true;
      changeBorders({ line });
    },
    [changeBorders]
  );

  if (disabled) {
    return null;
  }

  return (
    <TooltipProvider>
      <ToggleGroup.Root
        type="multiple"
        className="flex text-sm"
        onValueChange={() => {
          console.log('fired value change');
          // focusGrid();
        }}
      >
        <div className="borderMenu">
          <div className="borderMenuLines">
            <div className="borderMenuLine">
              <BorderSelectionButton
                type={'all'}
                label="All borders"
                icon={<BorderAllIcon className="h-5 w-5" />}
                onClick={handleChangeBorderSelection}
              />
              <BorderSelectionButton
                type={'inner'}
                label="Inner borders"
                icon={<BorderInnerIcon className="h-5 w-5" />}
                onClick={handleChangeBorderSelection}
              />
              <BorderSelectionButton
                type={'outer'}
                label="Outer borders"
                icon={<BorderOuterIcon className="h-5 w-5" />}
                onClick={handleChangeBorderSelection}
              />
              <BorderSelectionButton
                type={'horizontal'}
                label="Horizontal borders"
                icon={<BorderHorizontalIcon className="h-5 w-5" />}
                onClick={handleChangeBorderSelection}
              />
              <BorderSelectionButton
                type={'vertical'}
                label="Vertical borders"
                icon={<BorderVerticalIcon className="h-5 w-5" />}
                onClick={handleChangeBorderSelection}
              />
            </div>
            <div className="borderMenuLine">
              <BorderSelectionButton
                type={'left'}
                label="Left border"
                icon={<BorderLeftIcon className="h-5 w-5" />}
                onClick={handleChangeBorderSelection}
              />
              <BorderSelectionButton
                type={'top'}
                label="Top border"
                icon={<BorderTopIcon className="h-5 w-5" />}
                onClick={handleChangeBorderSelection}
              />
              <BorderSelectionButton
                type={'right'}
                label="Right border"
                icon={<BorderRightIcon className="h-5 w-5" />}
                onClick={handleChangeBorderSelection}
              />
              <BorderSelectionButton
                type={'bottom'}
                label="Bottom border"
                icon={<BorderBottomIcon className="h-5 w-5" />}
                onClick={handleChangeBorderSelection}
              />
              <BorderSelectionButton
                type={'clear'}
                label="Clear borders"
                icon={<BorderNoneIcon className="h-5 w-5" />}
                onClick={handleChangeBorderSelection}
              />
            </div>
          </div>
          <div className="borderMenuFormatting">
            <div
              className="borderSubmenu color-picker-submenu"
              id="FillBorderColorMenuID"
              // label={<BorderColorIcon className="mr-1 h-5 w-5" style={{ color }}></BorderColorIcon>}
            >
              <QColorPicker onChangeComplete={handleChangeBorderColor} />
            </div>
            <div
              id="BorderLineStyleMenuID"
              className="borderSubmenu"
              // label={<BorderStyleIcon className="mr-1 h-5 w-5" />}
            >
              <div onClick={(e) => handleChangeBorderLine(e, 'line1')}>
                <div className="lineStyleBorder normalBorder"></div>
              </div>
              <div onClick={(e) => handleChangeBorderLine(e, 'line2')}>
                <div className="lineStyleBorder doubleBorder"></div>
              </div>
              <div onClick={(e) => handleChangeBorderLine(e, 'line3')}>
                <div className="lineStyleBorder tripleBorder"></div>
              </div>
              <div onClick={(e) => handleChangeBorderLine(e, 'dashed')}>
                <div className="lineStyleBorder dashedBorder"></div>
              </div>
              <div onClick={(e) => handleChangeBorderLine(e, 'dotted')}>
                <div className="lineStyleBorder dottedBorder"></div>
              </div>
              <div onClick={(e) => handleChangeBorderLine(e, 'double')}>
                <div className="lineStyleBorder twoLineBorder"></div>
              </div>
            </div>
          </div>
        </div>
      </ToggleGroup.Root>
    </TooltipProvider>
  );
}

function BorderSelectionButton(props: {
  type: BorderSelection;
  label: string;
  icon: JSX.Element;
  disabled?: boolean;
  onClick: (type: BorderSelection) => void;
}): JSX.Element {
  const { type, label, icon, disabled, onClick } = props;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroup.Item
          value={label}
          asChild
          aria-label={label}
          onClick={() => {
            if (!disabled) onClick(type);
          }}
        >
          {icon}
        </ToggleGroup.Item>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
