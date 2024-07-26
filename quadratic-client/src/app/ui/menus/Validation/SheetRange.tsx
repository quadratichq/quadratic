import { TooltipHint } from '../../components/TooltipHint';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useState } from 'react';
import { getSelectionRange, parseSelectionRange } from '@/app/grid/sheet/selection';
import { sheets } from '@/app/grid/controller/Sheets';
import { ValidationInput } from './ValidationUI';

interface Props {
  label?: string;
  initial?: string;
  onChangeRange: (range: string) => void;
}

export const SheetRange = (props: Props) => {
  const { onChangeRange, label, initial } = props;

  const [range, setRange] = useState(initial);
  const onInsert = useCallback(() => {
    setRange(getSelectionRange(sheets.sheet.cursor));
  }, []);

  const onChange = useCallback(
    (value: string) => {
      setRange(value);
      const validate = parseSelectionRange(value);
      if (Array.isArray(validate)) {
      } else {
        onChangeRange(value);
      }
    },
    [onChangeRange]
  );

  return (
    <div>
      <div className="flex w-full items-center space-x-2">
        <ValidationInput label={label} value={range || ''} onChange={onChange} width="100%" />
        <TooltipHint title={'Insert current selection'} placement="bottom">
          <Button size="sm" onClick={onInsert}>
            <HighlightAltIcon fontSize="small" />
          </Button>
        </TooltipHint>
      </div>
    </div>
  );
};
