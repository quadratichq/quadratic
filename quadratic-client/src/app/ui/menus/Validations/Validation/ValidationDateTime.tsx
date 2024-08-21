/* eslint-disable @typescript-eslint/no-unused-vars */
import { DateTimeRange, ValidationRule } from '@/app/quadratic-core-types';
import { numberToDate, userDateToNumber } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/shadcn/ui/accordion';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import DeleteIcon from '@mui/icons-material/Delete';
import { Tooltip } from '@mui/material';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useCallback, useMemo, useState } from 'react';
import { ValidationData } from './useValidationData';
import { ValidationCalendar } from './ValidationCalendar';
import { ValidationUndefined } from './validationType';
import { ValidationDropdown, ValidationInput, ValidationMoreOptions, ValidationUICheckbox } from './ValidationUI';

interface Props {
  validationData: ValidationData;
  onEnter: () => void;
}

export const ValidationDateTime = (props: Props) => {
  const { validationData, onEnter } = props;
  const { ignoreBlank, changeIgnoreBlank, readOnly, validation, setValidation } = validationData;

  const [equalsError, setEqualsError] = useState(false);

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
          return equals.DateEqual.flatMap((d) => {
            const date = numberToDate(BigInt(d));
            if (date) {
              return [date];
            } else {
              return [];
            }
          });
        } else {
          return [];
        }
      }
    }
  }, [validation]);

  const dateEqualsSet = !!equals?.length;

  const datesStringToNumber = (date: string): bigint[] | undefined => {
    const split = date.split(',');
    const dates: bigint[] = [];
    for (const v of split) {
      if (v.trim()) {
        const parsed = userDateToNumber(v.trim());
        if (parsed) {
          dates.push(parsed);
        } else {
          return;
        }
      }
    }
    return dates;
  };

  const changeEquals = useCallback(
    (values: string) => {
      const dates = datesStringToNumber(values);
      if (!dates) {
        setEqualsError(true);
        return;
      }

      setValidation((validation: ValidationUndefined) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('DateTime' in validation.rule)) {
          return;
        }

        setEqualsError(false);

        if (!dates.length) {
          return {
            ...validation,
            rule: {
              DateTime: {
                ...validation.rule.DateTime,
                ranges: [],
              },
            },
          };
        }

        // DateEqual can only exist with other time rules; not with other date rules
        const rules: DateTimeRange[] = validation.rule.DateTime.ranges.filter(
          (m) => 'TimeEqual' in m || 'TimeNotEqual' in m || 'TimeRange' in m
        );
        if (values.length) {
          rules.push({
            DateEqual: dates,
          });
        }
        return {
          ...validation,
          rule: {
            DateTime: {
              ...validation.rule.DateTime,
              ranges: rules,
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
      if ('DateTime' in validation.rule) {
        const notEquals = validation.rule.DateTime.ranges.find((r) => 'DateNotEqual' in r);
        if (notEquals && 'DateNotEqual' in notEquals) {
          return notEquals.DateNotEqual.map((d) => numberToDate(BigInt(d)));
        } else {
          return [];
        }
      }
    }
  }, [validation]);

  const changeNotEquals = useCallback(
    (values: string) => {
      const dates = datesStringToNumber(values);
      if (!dates) {
        setEqualsError(true);
        return;
      }
      setEqualsError(false);

      setValidation((validation) => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('DateTime' in validation.rule)) {
          return;
        }

        if (!dates.length) {
          return {
            ...validation,
            rule: {
              Number: {
                ...validation.rule.DateTime,
                ranges: [],
              },
            },
          };
        }

        const rules = validation.rule.DateTime.ranges.filter((m) => !('NotEqual' in m));
        if (values.length) {
          rules.push({
            DateNotEqual: dates,
          });
        }
        return {
          ...validation,
          rule: {
            DateTime: {
              ...validation.rule.DateTime,
              ranges: [
                {
                  DateNotEqual: dates,
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
          if ('DateRange' in r) {
            ranges.push(r);
          }
        });
      }
    }

    // always add an empty range to the bottom of the list
    const dateRange = ranges.find((r) => 'DateRange' in r);
    if (
      !dateRange ||
      ('DateRange' in dateRange && (dateRange.DateRange[0] !== null || dateRange.DateRange[1] !== null))
    ) {
      ranges.push({ DateRange: [null, null] });
    }
    return ranges;
  }, [validation]);

  const [rangeError, setRangeError] = useState<number[]>([]);
  const changeRange = useCallback(
    (index: number, value: string, type: 'start' | 'end') => {
      const date = userDateToNumber(value) ?? null;

      setValidation((validation): ValidationUndefined => {
        if (!validation || !('rule' in validation) || validation.rule === 'None' || !('DateTime' in validation.rule)) {
          return;
        }

        let current: DateTimeRange;
        if (index === -1) {
          current = { DateRange: [null, null] };
        } else {
          current = validation.rule.DateTime.ranges[index];
        }
        if (!('DateRange' in current)) throw new Error('Expected Range in changeRange');

        if (type === 'start') {
          // check for error (min > max)
          if (current.DateRange[1] !== null && date && date > current.DateRange[1]) {
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
          if (current.DateRange[0] !== null && date && date < current.DateRange[0]) {
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

        const filteredRanges = validation.rule.DateTime.ranges.filter((_, i) => i !== index);
        filteredRanges.push(current);

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
    [setValidation]
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
            DateTime: {
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
    if (equals?.length) {
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

  const findRangeIndex = (range: DateTimeRange): number => {
    if (!validation || !('rule' in validation) || validation.rule === 'None' || !('DateTime' in validation.rule)) {
      throw new Error('Unexpected in findRangeIndex in ValidationDateTime');
    }

    // return if we're adding a new range
    if (!('DateRange' in range) || (range.DateRange[0] === null && range.DateRange[1] === null)) return -1;

    const i = validation.rule.DateTime.ranges.findIndex((r: DateTimeRange) => {
      if (!('DateRange' in range) || !('DateRange' in r)) return false;

      return r.DateRange[0] === range.DateRange[0] && r.DateRange[1] === range.DateRange[1];
    });
    if (i === -1) {
      throw new Error('Range not found in findRangeIndex in ValidationDateTime');
    }
    return i;
  };

  return (
    // tabIndex allows the calendar to close when clicking outside it
    <div className="flex w-full flex-col gap-5" tabIndex={0}>
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

      <Accordion type="single" collapsible className="w-full" defaultValue={equals?.length ? 'date-equals' : undefined}>
        <AccordionItem value="date-equals">
          <AccordionTrigger disabled={noDate} className={noDate ? 'opacity-50' : ''}>
            <div className="flex">Date equals{noDateOverrides}</div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <ValidationInput
              placeholder="Enter dates separated by commas"
              disabled={readOnly}
              value={equals ? equals.join(', ') : ''}
              onChange={changeEquals}
              readOnly={readOnly}
              error={equalsError ? 'Please enter valid dates separated by commas' : undefined}
              onEnter={onEnter}
              showOnFocus={
                <ValidationCalendar
                  dates={equals?.map((d) => new Date(d))}
                  setDates={(dates) => {
                    changeEquals(dates);
                    return false;
                  }}
                />
              }
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={notEquals?.length ? 'date-not-equals' : undefined}
        value={equals?.length ? '' : undefined}
      >
        <AccordionItem value="date-not-equals">
          <AccordionTrigger className={noDate || dateEqualsSet ? 'opacity-50' : ''} disabled={noDate || dateEqualsSet}>
            <div className="flex">
              Date does not equal{noDateOverrides}
              {equalsOverrides}
            </div>
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
                showOnFocus={
                  <ValidationCalendar
                    dates={equals?.map((d) => new Date(d))}
                    setDates={(dates) => {
                      changeNotEquals(dates);
                      return false;
                    }}
                  />
                }
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
        value={equals?.length ? '' : undefined}
      >
        <AccordionItem value="date-range">
          <AccordionTrigger className={noDate || dateEqualsSet ? 'opacity-50' : ''} disabled={noDate || dateEqualsSet}>
            {' '}
            <div className="flex">
              Date ranges{noDateOverrides}
              {equalsOverrides}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            {ranges.map((range) => {
              const i = findRangeIndex(range);
              const r = 'DateRange' in range ? range.DateRange : [null, null];
              const start = r[0] ? numberToDate(BigInt(r[0])) : undefined;
              const end = r[1] ? numberToDate(BigInt(r[1])) : undefined;
              return (
                <div className="flex w-full flex-col" key={i}>
                  <div className="mb-6 flex w-full items-center gap-2">
                    <div className="flex w-full flex-col gap-2">
                      <ValidationInput
                        className="w-full"
                        placeholder="Start Date"
                        disabled={readOnly}
                        value={start}
                        onChange={(value) => changeRange(i, value, 'start')}
                        onEnter={onEnter}
                        showOnFocus={
                          <ValidationCalendar
                            singleDate
                            dates={start ? [new Date(start)] : []}
                            setDates={(dates) => {
                              changeRange(i, dates, 'start');
                              return true;
                            }}
                            fallbackMonth={end ? new Date(end) : undefined}
                          />
                        }
                      />
                      <ValidationInput
                        placeholder="End Date"
                        disabled={readOnly}
                        value={end}
                        onChange={(value) => changeRange(i, value, 'end')}
                        onEnter={onEnter}
                        showOnFocus={
                          <ValidationCalendar
                            singleDate
                            dates={end ? [new Date(end)] : undefined}
                            fallbackMonth={start ? new Date(start) : undefined}
                            setDates={(dates) => {
                              changeRange(i, dates, 'end');
                              return true;
                            }}
                          />
                        }
                      />
                    </div>
                    <Button className={cn('grow-0 px-2', i !== -1 ? '' : 'invisible')} onClick={() => removeRange(i)}>
                      <DeleteIcon />
                    </Button>
                  </div>
                  {rangeError.includes(i) && (
                    <div className="mb-2 text-xs text-red-500">Range start must be before end</div>
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
