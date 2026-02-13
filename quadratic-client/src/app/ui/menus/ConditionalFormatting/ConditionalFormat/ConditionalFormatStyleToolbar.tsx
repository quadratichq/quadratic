import { ColorPicker } from '@/app/ui/components/ColorPicker';
import type { ConditionalFormatStyle } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormat/ConditionalFormat';
import {
  FormatBoldIcon,
  FormatColorFillIcon,
  FormatColorTextIcon,
  FormatItalicIcon,
  FormatStrikethroughIcon,
  FormatUnderlinedIcon,
} from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { useState } from 'react';

interface Props {
  style: ConditionalFormatStyle;
  setStyle: (style: ConditionalFormatStyle) => void;
}

export const ConditionalFormatStyleToolbar = ({ style, setStyle }: Props) => {
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [fillColorOpen, setFillColorOpen] = useState(false);
  const toggleBold = () => {
    setStyle({ ...style, bold: style.bold === true ? undefined : true });
  };

  const toggleItalic = () => {
    setStyle({ ...style, italic: style.italic === true ? undefined : true });
  };

  const toggleUnderline = () => {
    setStyle({ ...style, underline: style.underline === true ? undefined : true });
  };

  const toggleStrikeThrough = () => {
    setStyle({ ...style, strike_through: style.strike_through === true ? undefined : true });
  };

  const setTextColor = (color: string | undefined) => {
    setStyle({ ...style, text_color: color });
  };

  const setFillColor = (color: string | undefined) => {
    setStyle({ ...style, fill_color: color });
  };

  return (
    <div className="mt-2 flex items-center gap-1 rounded-md border border-border p-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              'text-muted-foreground hover:text-foreground',
              style.bold === true && 'bg-accent text-foreground'
            )}
            onClick={toggleBold}
          >
            <FormatBoldIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Bold</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              'text-muted-foreground hover:text-foreground',
              style.italic === true && 'bg-accent text-foreground'
            )}
            onClick={toggleItalic}
          >
            <FormatItalicIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Italic</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              'text-muted-foreground hover:text-foreground',
              style.underline === true && 'bg-accent text-foreground'
            )}
            onClick={toggleUnderline}
          >
            <FormatUnderlinedIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Underline</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              'text-muted-foreground hover:text-foreground',
              style.strike_through === true && 'bg-accent text-foreground'
            )}
            onClick={toggleStrikeThrough}
          >
            <FormatStrikethroughIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Strikethrough</TooltipContent>
      </Tooltip>

      <hr className="mx-1 h-6 w-[1px] bg-border" />

      <Popover open={textColorOpen} onOpenChange={setTextColorOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn('text-muted-foreground hover:text-foreground', style.text_color && 'text-foreground')}
              >
                <div className="relative flex items-center justify-center">
                  <FormatColorTextIcon />
                  <div
                    className="absolute bottom-0 left-0.5 right-0.5 h-1 rounded-sm"
                    style={{ backgroundColor: style.text_color ?? 'currentColor' }}
                  />
                </div>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Text color</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-fit p-1">
          <ColorPicker
            color={style.text_color}
            onChangeComplete={(color) => setTextColor(color.hex)}
            onClear={() => setTextColor(undefined)}
            onClose={() => setTextColorOpen(false)}
          />
        </PopoverContent>
      </Popover>

      <Popover open={fillColorOpen} onOpenChange={setFillColorOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn('text-muted-foreground hover:text-foreground', style.fill_color && 'text-foreground')}
              >
                <div className="relative flex items-center justify-center">
                  <FormatColorFillIcon />
                  <div
                    className="absolute bottom-0 left-0.5 right-0.5 h-1 rounded-sm"
                    style={{ backgroundColor: style.fill_color ?? 'currentColor' }}
                  />
                </div>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Fill color</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-fit p-1">
          <ColorPicker
            color={style.fill_color}
            onChangeComplete={(color) => setFillColor(color.hex)}
            onClear={() => setFillColor(undefined)}
            onClose={() => setFillColorOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
