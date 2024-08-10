import { useCallback, useMemo } from 'react';
import { ValidationData } from './useValidationData';
import { ValidationInput, ValidationMoreOptions, ValidationUICheckbox } from './ValidationUI';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/shadcn/ui/accordion';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Tooltip } from '@mui/material';

interface Props {
  validationData: ValidationData;
}

export const ValidationText = (props: Props) => {
  const { ignoreBlank, changeIgnoreBlank, readOnly, validation, setValidation } = props.validationData;

  //#region Exactly

  const [exactly, exactlyCaseSensitive] = useMemo(() => {
    if (validation && 'rule' in validation && validation.rule && validation.rule !== 'None') {
      if ('Text' in validation.rule) {
        const exactly = validation.rule.Text.text_match.find((m) => 'Exactly' in m);
        if (exactly && 'Exactly' in exactly) {
          if ('CaseSensitive' in exactly.Exactly) {
            return [exactly.Exactly.CaseSensitive, true];
          } else if ('CaseInsensitive' in exactly.Exactly) {
            return [exactly.Exactly.CaseInsensitive, false];
          }
        }
      }
    }
    return [undefined, false];
  }, [validation]);

  // Note: Enabling exactly will remove all other text rules (since you can't have
  // exactly and another rule at the same time)
  const changeExactly = useCallback(
    (value: string) => {
      const values = value.split(',').map((v) => v.trim());

      // don't allow empty strings
      if (values.length === 1 && values[0] === '') {
        values.pop();
      }
      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('Text' in validation.rule)) {
          return;
        }
        let rules = validation.rule.Text.text_match.filter((m) => !('Exactly' in m));
        if (values.length) {
          rules = [
            {
              Exactly: exactlyCaseSensitive ? { CaseSensitive: values } : { CaseInsensitive: values },
            },
          ];
        } else {
          rules = [];
        }
        return {
          ...validation,
          rule: {
            ...validation.rule,
            Text: {
              ...validation.rule.Text,
              text_match: rules,
            },
          },
        };
      });
    },
    [exactlyCaseSensitive, setValidation]
  );

  const changeExactlyCaseSensitive = useCallback(
    (checked: boolean) => {
      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('Text' in validation.rule)) {
          return;
        }
        const rules = validation.rule.Text.text_match.filter((m) => !('Exactly' in m));
        if (exactly) {
          rules.push({
            Exactly: checked ? { CaseSensitive: exactly } : { CaseInsensitive: exactly },
          });
        }
        return {
          ...validation,
          rule: {
            ...validation.rule,
            Text: {
              ...validation.rule.Text,
              text_match: rules,
            },
          },
        };
      });
    },
    [exactly, setValidation]
  );

  //#endregion

  //#region Contains

  const [contains, containsCaseSensitive] = useMemo(() => {
    if (validation && 'rule' in validation && validation.rule && validation.rule !== 'None') {
      if ('Text' in validation.rule) {
        const contains = validation.rule.Text.text_match.find((m) => 'Contains' in m);
        if (contains && 'Contains' in contains) {
          if ('CaseSensitive' in contains.Contains) {
            return [contains.Contains.CaseSensitive, true];
          } else if ('CaseInsensitive' in contains.Contains) {
            return [contains.Contains.CaseInsensitive, false];
          }
        }
      }
    }
    return [undefined, false];
  }, [validation]);

  const changeContains = useCallback(
    (value: string) => {
      const values = value.split(',').map((v) => v.trim());

      // don't allow empty strings
      if (values.length === 1 && values[0] === '') {
        values.pop();
      }
      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('Text' in validation.rule)) {
          return;
        }
        const rules = validation.rule.Text.text_match.filter((m) => !('Contains' in m));
        if (values.length) {
          rules.push({
            Contains: containsCaseSensitive ? { CaseSensitive: values } : { CaseInsensitive: values },
          });
        }
        return {
          ...validation,
          rule: {
            ...validation.rule,
            Text: {
              ...validation.rule.Text,
              text_match: rules,
            },
          },
        };
      });
    },
    [containsCaseSensitive, setValidation]
  );

  const changeContainsCaseSensitive = useCallback(
    (checked: boolean) => {
      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('Text' in validation.rule)) {
          return;
        }
        const rules = validation.rule.Text.text_match.filter((m) => !('Contains' in m));
        if (contains) {
          rules.push({
            Contains: checked ? { CaseSensitive: contains } : { CaseInsensitive: contains },
          });
        }
        return {
          ...validation,
          rule: {
            ...validation.rule,
            Text: {
              ...validation.rule.Text,
              text_match: rules,
            },
          },
        };
      });
    },
    [contains, setValidation]
  );

  //#endregion

  //#region NotContains

  const [notContains, notContainsCaseSensitive] = useMemo(() => {
    if (validation && 'rule' in validation && validation.rule && validation.rule !== 'None') {
      if ('Text' in validation.rule) {
        const notContains = validation.rule.Text.text_match.find((m) => 'NotContains' in m);
        if (notContains && 'NotContains' in notContains) {
          if ('CaseSensitive' in notContains.NotContains) {
            return [notContains.NotContains.CaseSensitive, true];
          } else if ('CaseInsensitive' in notContains.NotContains) {
            return [notContains.NotContains.CaseInsensitive, false];
          }
        }
      }
    }
    return [undefined, false];
  }, [validation]);

  const changeNotContains = useCallback(
    (value: string) => {
      const values = value.split(',').map((v) => v.trim());

      // don't allow empty strings
      if (values.length === 1 && values[0] === '') {
        values.pop();
      }
      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('Text' in validation.rule)) {
          return;
        }
        const rules = validation.rule.Text.text_match.filter((m) => !('NotContains' in m));
        if (values.length) {
          rules.push({
            NotContains: notContainsCaseSensitive ? { CaseSensitive: values } : { CaseInsensitive: values },
          });
        }
        return {
          ...validation,
          rule: {
            ...validation.rule,
            Text: {
              ...validation.rule.Text,
              text_match: rules,
            },
          },
        };
      });
    },
    [notContainsCaseSensitive, setValidation]
  );

  const changeNotContainsCaseSensitive = useCallback(
    (checked: boolean) => {
      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('Text' in validation.rule)) {
          return;
        }
        const rules = validation.rule.Text.text_match.filter((m) => !('NotContains' in m));
        if (notContains) {
          rules.push({
            NotContains: checked ? { CaseSensitive: notContains } : { CaseInsensitive: notContains },
          });
        }
        return {
          ...validation,
          rule: {
            ...validation.rule,
            Text: {
              ...validation.rule.Text,
              text_match: rules,
            },
          },
        };
      });
    },
    [notContains, setValidation]
  );

  //#endregion

  //#region Length

  const [minLength, maxLength] = useMemo(() => {
    if (validation && 'rule' in validation && validation.rule && validation.rule !== 'None') {
      if ('Text' in validation.rule) {
        const text = validation.rule.Text.text_match.find((m) => 'TextLength' in m);
        if (text && 'TextLength' in text) {
          const textLength = text.TextLength;
          return [textLength.min, textLength.max];
        }
      }
    }
    return [undefined, undefined];
  }, [validation]);

  const changeMinLength = useCallback(
    (value: string) => {
      const num = parseInt(value, 10);
      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('Text' in validation.rule)) {
          return;
        }
        const rules = validation.rule.Text.text_match.filter((m) => !('TextLength' in m));
        if (!isNaN(num) && num >= 0) {
          rules.push({
            TextLength: {
              min: num,
              max: maxLength ?? null,
            },
          });
        } else if (maxLength) {
          rules.push({
            TextLength: {
              min: null,
              max: maxLength,
            },
          });
        }
        return {
          ...validation,
          rule: {
            ...validation.rule,
            Text: {
              ...validation.rule.Text,
              text_match: rules,
            },
          },
        };
      });
    },
    [maxLength, setValidation]
  );

  const changeMaxLength = useCallback(
    (value: string) => {
      const num = parseInt(value, 10);
      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('Text' in validation.rule)) {
          return;
        }
        const rules = validation.rule.Text.text_match.filter((m) => !('TextLength' in m));
        if (!isNaN(num) && num >= 0) {
          rules.push({
            TextLength: {
              min: minLength ?? null,
              max: num,
            },
          });
        } else if (minLength) {
          rules.push({
            TextLength: {
              min: minLength,
              max: null,
            },
          });
        }
        return {
          ...validation,
          rule: {
            ...validation.rule,
            Text: {
              ...validation.rule.Text,
              text_match: rules,
            },
          },
        };
      });
    },
    [minLength, setValidation]
  );

  //#endregion

  const exactlyOverrides = useMemo(() => {
    if (exactly) {
      return (
        <Tooltip title="'Text exactly' cannot be combined with other rules">
          <InfoCircledIcon />
        </Tooltip>
      );
    }
    return null;
  }, [exactly]);

  return (
    <div className="flex flex-col gap-5">
      <ValidationUICheckbox
        label="Allow blank values"
        value={ignoreBlank}
        changeValue={changeIgnoreBlank}
        readOnly={readOnly}
      />
      <Accordion type="single" collapsible className="w-full" defaultValue={exactly ? 'text-exactly' : ''}>
        <AccordionItem value="text-exactly">
          <AccordionTrigger>Text exactly matches</AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <div className="flex w-full flex-col gap-1">
              <ValidationInput
                placeholder="Enter text separated by commas"
                disabled={readOnly}
                value={exactly?.join(', ') ?? ''}
                onChange={changeExactly}
                readOnly={readOnly}
              />
              <ValidationUICheckbox
                label="Case sensitive"
                value={exactlyCaseSensitive}
                readOnly={readOnly}
                changeValue={changeExactlyCaseSensitive}
                className="ml-auto mr-0"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={contains ? 'text-contains' : ''}
        value={exactly ? '' : undefined}
      >
        <AccordionItem value="text-contains">
          <AccordionTrigger className={exactly ? 'opacity-50' : ''} disabled={!!exactly}>
            <div className="flex">Text contains{exactlyOverrides}</div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <div className="flex w-full flex-col gap-1">
              <ValidationInput
                placeholder="Enter text separated by commas"
                disabled={readOnly}
                value={contains ? contains.join(', ') : ''}
                onChange={changeContains}
                readOnly={readOnly}
              />
              <ValidationUICheckbox
                label="Case sensitive"
                value={containsCaseSensitive}
                readOnly={readOnly}
                changeValue={changeContainsCaseSensitive}
                className="ml-auto mr-0"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={notContains ? 'text-not-contains' : ''}
        value={exactly ? '' : undefined}
      >
        <AccordionItem value="text-not-contains">
          <AccordionTrigger className={exactly ? 'opacity-50' : ''} disabled={!!exactly}>
            <div className="flex">Text does not contain{exactlyOverrides}</div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <div className="flex w-full flex-col gap-1">
              <ValidationInput
                placeholder="Enter text separated by commas"
                disabled={readOnly}
                value={notContains ? notContains.join(', ') : ''}
                onChange={changeNotContains}
              />
              <ValidationUICheckbox
                label="Case sensitive"
                value={notContainsCaseSensitive}
                readOnly={readOnly}
                changeValue={changeNotContainsCaseSensitive}
                className="ml-auto mr-0"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={(minLength && !isNaN(minLength)) || (maxLength && !isNaN(maxLength)) ? 'text-length' : ''}
        value={exactly ? '' : undefined}
      >
        <AccordionItem value="text-length">
          <AccordionTrigger className={exactly ? 'opacity-50' : ''} disabled={!!exactly}>
            <div className="flex">Text length{exactlyOverrides}</div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <div className="flex gap-1">
              <ValidationInput
                placeholder="Minimum length"
                disabled={readOnly}
                value={minLength?.toString() ?? ''}
                onChange={changeMinLength}
              />
              <ValidationInput
                placeholder="Maximum length"
                disabled={readOnly}
                value={maxLength?.toString() ?? ''}
                onChange={changeMaxLength}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <ValidationMoreOptions validationData={props.validationData} />
    </div>
  );
};
