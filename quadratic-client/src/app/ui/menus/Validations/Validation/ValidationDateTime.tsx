/* eslint-disable @typescript-eslint/no-unused-vars */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/shadcn/ui/accordion';
import { ValidationData } from './useValidationData';
import { ValidationDropdown, ValidationInput, ValidationMoreOptions, ValidationUICheckbox } from './ValidationUI';
import { Tooltip } from '@mui/material';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useCallback, useMemo, useState } from 'react';
import { DateTimeRange, ValidationRule } from '@/app/quadratic-core-types';
import { ValidationUndefined } from './validationType';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import DeleteIcon from '@mui/icons-material/Delete';
import { Calendar } from '@/shared/shadcn/ui/calendar';
import { ValidationCalendar } from './ValidationCalendar';

interface Props {
  validationData: ValidationData;
  onEnter: () => void;
}

export const ValidationDateTime = (props: Props) => {
  const { validationData, onEnter } = props;
  const { ignoreBlank, changeIgnoreBlank, readOnly, validation, setValidation } = validationData;

  const [equalsError, setEqualsError] = useState(false);

  console.log(validation);

  //#region Require Date and Time

  const dateRequire = useMemo(() => {
    if (validation && 'rule' in validation && validation.rule && validation.rule !== 'None') {
      if ('DateTime' in validation.rule) {
        const rule = validation.rule.DateTime;
        if (rule.require_date) {
          return 'required';
        }
        if (rule.prohibit_date) {
          return 'prohibit';
        }
      }
    }
    return '';
  }, [validation]);

  const timeRequire = useMemo(() => {
    if (validation && 'rule' in validation && validation.rule && validation.rule !== 'None') {
      if ('DateTime' in validation.rule) {
        const rule = validation.rule.DateTime;
        if (rule.require_time) {
          return 'required';
        }
        if (rule.prohibit_time) {
          return 'prohibit';
        }
      }
    }
    return '';
  }, [validation]);

  const changeDateRequire = useCallback(
    (value: string) => {
      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None') {
          return;
        }
        if ('DateTime' in validation.rule) {
          const rule: ValidationRule = {
            DateTime: {
              ...validation.rule.DateTime,
              require_date: value === 'required',
              prohibit_date: value === 'prohibit',
            },
          };

          return {
            ...validation,
            rule,
          };
        }
      });
    },
    [setValidation]
  );

  const changeTimeRequire = useCallback(
    (value: string) => {
      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None') {
          return;
        }
        if ('DateTime' in validation.rule) {
          const rule: ValidationRule = {
            DateTime: {
              ...validation.rule.DateTime,
              require_time: value === 'required',
              prohibit_time: value === 'prohibit',
            },
          };
          return {
            ...validation,
            rule,
          };
        }
      });
    },
    [setValidation]
  );

  const noDate = dateRequire === 'prohibit';
  const noTime = timeRequire === 'prohibit';

  //#endregion

  //#region Equals

  const equals = useMemo(() => {
    if (validation && 'rule' in validation && validation.rule && validation.rule !== 'None') {
      if ('DateTime' in validation.rule) {
        const equals = validation.rule.DateTime.ranges.find((r) => 'DateEqual' in r);
        if (equals && 'DateEqual' in equals) {
          return equals.DateEqual;
        }
      }
    }
  }, [validation]);

  const changeEquals = useCallback(
    (values: string) => {
      debugger;
      const dates = values.split(',').flatMap((v) => {
        if (!v.trim()) {
          return [];
        } else {
          return [parseFloat(v)];
        }
      });
      if (dates.some((n) => isNaN(n))) {
        setEqualsError(true);
        return;
      }
      setEqualsError(false);

      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('Number' in validation.rule)) {
          return;
        }

        if (!dates.length) {
          return {
            ...validation,
            rule: {
              Number: {
                ...validation.rule.Number,
                ranges: [],
              },
            },
          };
        }

        const rules = validation.rule.Number.ranges.filter((m) => !('Equal' in m));
        if (values.length) {
          rules.push({
            Equal: dates,
          });
        }
        return {
          ...validation,
          rule: {
            Number: {
              ...validation.rule.Number,
              ranges: [
                {
                  Equal: dates,
                },
              ],
            },
          },
        };
      });
    },
    [setValidation]
  );

  //#endregion

  //#region Not Equals

  const notEquals = useMemo(() => {
    if (validation && 'rule' in validation && validation.rule && validation.rule !== 'None') {
      if ('Number' in validation.rule) {
        const notEquals = validation.rule.Number.ranges.find((r) => 'NotEqual' in r);
        if (notEquals && 'NotEqual' in notEquals) {
          return notEquals.NotEqual;
        }
      }
    }
  }, [validation]);

  const changeNotEquals = useCallback(
    (values: string) => {
      const numbers = values.split(',').flatMap((v) => {
        if (!v.trim()) {
          return [];
        } else {
          return [parseFloat(v)];
        }
      });
      if (numbers.some((n) => isNaN(n))) {
        setEqualsError(true);
        return;
      }
      setEqualsError(false);

      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('Number' in validation.rule)) {
          return;
        }

        if (!numbers.length) {
          return {
            ...validation,
            rule: {
              Number: {
                ...validation.rule.Number,
                ranges: [],
              },
            },
          };
        }

        const rules = validation.rule.Number.ranges.filter((m) => !('NotEqual' in m));
        if (values.length) {
          rules.push({
            NotEqual: numbers,
          });
        }
        return {
          ...validation,
          rule: {
            Number: {
              ...validation.rule.Number,
              ranges: [
                {
                  NotEqual: numbers,
                },
              ],
            },
          },
        };
      });
    },
    [setValidation]
  );

  //#endregion

  //#region Ranges

  const ranges: DateTimeRange[] = useMemo(() => {
    const ranges: DateTimeRange[] = [];
    if (validation && 'rule' in validation && validation.rule && validation.rule !== 'None') {
      if ('DateTime' in validation.rule) {
        validation.rule.DateTime.ranges.forEach((r) => {
          ranges.push(r);
        });
      }
    }

    // always add an empty range to the bottom of the list
    const last = ranges[ranges.length - 1];
    if (!last || ('DateRange' in last && (last.DateRange[0] !== null || last.DateRange[1] !== null))) {
      ranges.push({ DateRange: [null, null] });
    }
    return ranges;
  }, [validation]);

  const [rangeError, setRangeError] = useState<number[]>([]);
  const changeRange = useCallback(
    (index: number, value: string, type: 'min' | 'max') => {
      const date = new Date(value.trim()).getTime();
      setValidation((validation): ValidationUndefined => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('DateTime' in validation.rule)) {
          return;
        }
        const newRanges = [...ranges];
        const current = newRanges[index];
        if (!('DateRange' in current)) throw new Error('Expected Range in changeRange');
        if (type === 'min') {
          // check for error (min > max)
          if (current.DateRange[1] !== null && date > current.DateRange[1]) {
            setRangeError((rangeError) => {
              const r = rangeError.filter((r) => r !== index);
              r.push(index);
              return r;
            });
            return validation;
          }
          current.DateRange[0] = date ? BigInt(date) : null;
          setRangeError((rangeError) => {
            return rangeError.filter((r) => r !== index);
          });
        } else {
          // check for error (max < min)
          if (current.DateRange[0] !== null && date < current.DateRange[0]) {
            setRangeError((rangeError) => {
              const r = rangeError.filter((r) => r !== index);
              r.push(index);
              return r;
            });
            return validation;
          }
          current.DateRange[1] = date ? BigInt(date) : null;
          setRangeError((rangeError) => {
            return rangeError.filter((r) => r !== index);
          });
        }

        const filteredRanges = newRanges.filter(
          (r) => 'DateRange' in r && (r.DateRange[0] !== null || r.DateRange[1] !== null)
        );
        return {
          ...validation,
          rule: {
            DateTime: {
              ...validation.rule.DateTime,
              ranges: filteredRanges,
            },
          },
        };
      });
    },
    [setValidation, ranges]
  );

  const removeRange = useCallback(
    (index: number) => {
      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('DateTime' in validation.rule)) {
          return;
        }
        const newRanges = [...ranges];
        newRanges.splice(index, 1);
        return {
          ...validation,
          rule: {
            Number: {
              ...validation.rule.DateTime,
              ranges: newRanges,
            },
          },
        };
      });
    },
    [setValidation, ranges]
  );

  //#endregion

  const equalsOverrides = useMemo(() => {
    if (equals) {
      return (
        <Tooltip title="'Date time equals' cannot be combined with other rules">
          <InfoCircledIcon />
        </Tooltip>
      );
    }
    return null;
  }, [equals]);

  const noDateOverrides = useMemo(() => {
    if (noDate) {
      return (
        <Tooltip title="Date part is prohibited">
          <InfoCircledIcon />
        </Tooltip>
      );
    }
    return null;
  }, [noDate]);

  const noTimeOverrides = useMemo(() => {
    if (noTime) {
      return (
        <Tooltip title="Time part is prohibited">
          <InfoCircledIcon />
        </Tooltip>
      );
    }
    return null;
  }, [noTime]);

  return (
    <div className="flex w-full flex-col gap-5">
      <ValidationUICheckbox
        label="Allow blank values"
        value={ignoreBlank}
        changeValue={changeIgnoreBlank}
        readOnly={readOnly}
      />
      <div className="flex w-full gap-2">
        <ValidationDropdown
          className="w-full"
          label="Date part"
          value={dateRequire}
          onChange={changeDateRequire}
          includeBlank
          options={['required', 'prohibit']}
          readOnly={readOnly}
        />
        <ValidationDropdown
          className="w-full"
          label="Time part"
          value={timeRequire}
          onChange={changeTimeRequire}
          includeBlank
          options={['required', 'prohibit']}
          readOnly={readOnly}
        />
      </div>

      <Accordion type="single" collapsible className="w-full" defaultValue={equals ? 'date-equals' : undefined}>
        <AccordionItem value="date-equals">
          <AccordionTrigger disabled={noDate} className={noDate ? 'opacity-50' : ''}>
            <div className="flex">Date equals{noDateOverrides}</div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <div className="flex w-full flex-col gap-1">
              <ValidationInput
                placeholder="Enter dates separated by commas"
                disabled={readOnly}
                value={equals ? equals.join(', ') : ''}
                onInput={changeEquals}
                readOnly={readOnly}
                error={equalsError ? 'Please enter valid dates separated by commas' : undefined}
                onEnter={onEnter}
              />
              <ValidationCalendar
                dates={equals?.map((d) => new Date(Number(d)))}
                setDates={(dates) => changeEquals(dates.map((d) => d.getTime()).join(','))}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={notEquals ? 'date-not-equals' : undefined}
        value={equals ? '' : undefined}
      >
        <AccordionItem value="date-not-equals">
          <AccordionTrigger className={noDate ? 'opacity-50' : ''} disabled={noDate}>
            <div className="flex">Date does not equal{noDateOverrides}</div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <div className="flex w-full flex-col gap-1">
              <ValidationInput
                placeholder="Enter dates separated by commas"
                disabled={readOnly}
                value={notEquals ? notEquals.join(', ') : ''}
                onInput={changeNotEquals}
                readOnly={readOnly}
                error={equalsError ? 'Please enter valid dates separated by commas' : undefined}
                onEnter={onEnter}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={ranges.length > 1 ? 'date-range' : undefined}
        value={equals ? '' : undefined}
      >
        <AccordionItem value="date-range">
          <AccordionTrigger className={noDate ? 'opacity-50' : ''} disabled={noDate}>
            <div className="flex">Date ranges{noDateOverrides}</div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            {ranges.map((range, i) => {
              const r = 'DateRange' in range ? range.DateRange : [null, null];
              const min = r[0]?.toString() ?? '';
              const max = r[1]?.toString() ?? '';
              return (
                <div className="mb-2 flex w-full flex-col gap-1 " key={i}>
                  <div className="flex items-center gap-1">
                    <ValidationInput
                      type="number"
                      placeholder="Minimum"
                      disabled={readOnly}
                      value={min}
                      onChange={(value) => changeRange(i, value, 'min')}
                      onEnter={onEnter}
                    />
                    <ValidationInput
                      type="number"
                      placeholder="Maximum"
                      disabled={readOnly}
                      value={max}
                      onChange={(value) => changeRange(i, value, 'max')}
                      onEnter={onEnter}
                    />
                    <Button
                      className={cn('grow-0 px-2', i !== ranges.length - 1 ? '' : 'invisible')}
                      onClick={() => removeRange(i)}
                    >
                      <DeleteIcon />
                    </Button>
                  </div>
                  {rangeError.includes(i) && (
                    <div className="mb-2 text-xs text-red-500">Range minimum must be less than maximum</div>
                  )}
                </div>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <ValidationMoreOptions validationData={validationData} />
    </div>
  );
};
