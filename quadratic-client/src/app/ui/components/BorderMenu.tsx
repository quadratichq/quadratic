import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { borderMenuAtom } from '@/app/atoms/borderMenuAtom';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import { useBorders } from '@/app/ui/hooks/useBorders';
import { CheckSmallIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
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

export const BorderMenu = () => {
  const borders = useBorders();
  const borderColorSpec = defaultActionSpec[Action.FormatBorderColor];
  const borderMenuState = useRecoilValue(borderMenuAtom);

  return (
    <div>
      <ToggleGroup.Root type="single" className="flex flex-row border-b border-border pb-1">
        {borderActionKeys.map((actionKey, i) => {
          const Icon = 'Icon' in defaultActionSpec[actionKey] ? defaultActionSpec[actionKey].Icon : undefined;
          const run = defaultActionSpec[actionKey].run;
          return (
            <ToggleGroup.Item autoFocus={i === 0} asChild value={actionKey} key={actionKey}>
              <Button
                size="icon"
                variant="ghost"
                className="focus-visible:bg-accent"
                key={actionKey}
                onClick={() => {
                  run(borders);
                }}
              >
                {Icon && <Icon />}
              </Button>
            </ToggleGroup.Item>
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
                <CheckSmallIcon className={cn(isActive ? 'opacity-100' : 'opacity-0')} />
                <span className={className}></span>
              </ToggleGroup.Item>
            );
          })}
        </ToggleGroup.Root>

        <div className="color-picker-dropdown-menu w-1/2 border-l border-border pl-2 pt-2">
          <QColorPicker
            color={borderMenuState.color}
            onChangeComplete={(color) => {
              borderColorSpec.run({ borders, color });
            }}
            onClear={() => {
              borders.clearBorders();
            }}
          />
        </div>
      </div>
    </div>
  );
};