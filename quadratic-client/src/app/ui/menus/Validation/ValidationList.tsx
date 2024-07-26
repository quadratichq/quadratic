import { SheetRange } from './SheetRange';
import { ValidationData } from './useValidationData';

interface Props {
  validationData: ValidationData;
}

export const ValidationList = (props: Props) => {
  return (
    <div>
      <SheetRange label="Source" />
    </div>
  );
};
