import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { borderMenuAtom } from '@/app/atoms/borderMenuAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { ColorPicker } from '@/app/ui/components/ColorPicker';
import { useBorders } from '@/app/ui/hooks/useBorders';
import { CheckSmallIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { ToggleGroup } from 'radix-ui';
import { useRecoilValue } from 'recoil';
import './borderMenuStyles.scss';

const borderActionKeys = [
  Action.FormatBorderAll,
  Action.FormatBorderOuter,
  Action.FormatBorderInner,
  Action.FormatBorderVertical,
  Action.FormatBorderHorizontal,
  Action.FormatBorderLeft,
  Action.FormatBorderRight,
  Action.FormatBorderTop,
  Action.FormatBorderBottom,
  Action.FormatBorderClear,
] as const;

const borderStyles = [
  { actionKey: Action.FormatBorderLine1, className: 'lineStyleBorder normalBorder' },
  { actionKey: Action.FormatBorderLine2, className: 'lineStyleBorder doubleBorder' },
  { actionKey: Action.FormatBorderLine3, className: 'lineStyleBorder tripleBorder' },
  { actionKey: Action.FormatBorderDashed, className: 'lineStyleBorder dashedBorder' },
  { actionKey: Action.FormatBorderDotted, className: 'lineStyleBorder dottedBorder' },
  { actionKey: Action.FormatBorderDouble, className: 'lineStyleBorder twoLineBorder' },
] as const;

interface BorderMenuProps {
  onClose?: () => void;
}

export const BorderMenu = ({ onClose }: BorderMenuProps = {}) => {
  const borders = useBorders();
  const borderColorSpec = defaultActionSpec[Action.FormatBorderColor];
  const borderMenuState = useRecoilValue(borderMenuAtom);

  // this doesn't need to be an effect since the menu is closed when the cursor
  // changes
  const singleSelection = sheets.sheet.cursor.isSingleSelection();

  return (
    <div>
      <ToggleGroup.Root type="single" className="flex flex-row border-b border-border pb-1">
        {borderActionKeys.map((actionKey) => {
          const label = defaultActionSpec[actionKey].label();
          const Icon = 'Icon' in defaultActionSpec[actionKey] ? defaultActionSpec[actionKey].Icon : undefined;
          const run = defaultActionSpec[actionKey].run;
          const disabled =
            (actionKey === Action.FormatBorderHorizontal || actionKey === Action.FormatBorderVertical) &&
            singleSelection;
          return (
            <Tooltip key={actionKey}>
              <TooltipTrigger asChild>
                <ToggleGroup.Item asChild value={actionKey} key={actionKey}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="focus-visible:bg-accent"
                    key={actionKey}
                    disabled={disabled}
                    onClick={() => run(borders)}
                  >
                    {Icon && <Icon />}
                  </Button>
                </ToggleGroup.Item>
              </TooltipTrigger>
              <TooltipContent side="bottom">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </ToggleGroup.Root>

      <div className="flex flex-row">
        <ToggleGroup.Root type="single" className="flex w-1/2 flex-col pr-2 pt-2">
          {borderStyles.map(({ actionKey, className }) => {
            const run = defaultActionSpec[actionKey].run;
            const currentLineStyle = borderMenuState.line as string;
            const isActive = actionKey.includes(currentLineStyle);

            return (
              <ToggleGroup.Item
                key={actionKey}
                value={actionKey}
                className={'inset-1 flex h-6 flex-row items-center gap-4 rounded px-2 hover:bg-accent focus:bg-accent'}
                onClick={() => {
                  run(borders);
                }}
              >
                <CheckSmallIcon className={cn(!isActive && 'invisible opacity-0')} />
                <span className={className}></span>
              </ToggleGroup.Item>
            );
          })}
        </ToggleGroup.Root>

        <div className="color-picker-dropdown-menu w-1/2 border-l border-border pl-2 pt-2">
          <ColorPicker
            color={borderMenuState.color}
            onChangeComplete={(color) => {
              borderColorSpec.run({ borders, color });
            }}
            onClear={() => {
              borders.clearBorders();
            }}
            onClose={onClose}
            removeColor
            clearLabel="Clear borders"
            showClearIcon={false}
          />
        </div>
      </div>
    </div>
  );
};
