import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/shadcn/ui/accordion';
import { ValidationData } from './useValidationData';
import { ValidationInput, ValidationMoreOptions, ValidationUICheckbox } from './ValidationUI';
import { useMemo } from 'react';

interface Props {
  validationData: ValidationData;
}

export const ValidationNumber = (props: Props) => {
  const { ignoreBlank, changeIgnoreBlank, readOnly, validation } = props.validationData;

  const equals = useMemo(() => {
    if (validation && 'rule' in validation && validation.rule && validation.rule !== 'None') {
      if ('Number' in validation.rule) {
        return validation.rule.Number.ranges.find((r) => 'Equal' in r);
      }
    }
  }, [validation]);

  return (
    <div className="flex flex-col gap-5">
      <ValidationUICheckbox
        label="Allow blank values"
        value={ignoreBlank}
        changeValue={changeIgnoreBlank}
        readOnly={readOnly}
      />
      <Accordion type="single" collapsible className="w-full" defaultValue={'number-equals'}>
        <AccordionItem value="number-equals">
          <AccordionTrigger>Number equals</AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <div className="flex w-full flex-col gap-1">
              <ValidationInput
                placeholder="Enter numbers separated by commas"
                disabled={readOnly}
                value={equals?.join(', ')}
                onChange={() => {}}
                readOnly={readOnly}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <ValidationMoreOptions validationData={props.validationData} />
    </div>
  );
};
