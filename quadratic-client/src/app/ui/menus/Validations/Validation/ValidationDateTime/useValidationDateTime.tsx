import type { ValidationDateTime } from '@/app/quadratic-core-types';
import { numberToDate, numberToTime } from '@/app/quadratic-rust-client/quadratic_rust_client';
import type { ValidationData } from '@/app/ui/menus/Validations/Validation/useValidationData';
import { Tooltip } from '@mui/material';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useMemo } from 'react';

export interface ValidationDateTimeData {
  validationDateTime: ValidationDateTime;
  setValidationDateTime: (validationDateTime: ValidationDateTime) => void;
  timeRequire: 'required' | 'prohibit' | '';
  dateRequire: 'required' | 'prohibit' | '';
  equals: string[];
  readOnly: boolean;
  noTimeHelp: JSX.Element | null;
  noDateHelp: JSX.Element | null;
  equalsSetHelp: JSX.Element | null;

  timeEquals: string[];
  timeEqualsSetHelp: JSX.Element | null;
}

export const useValidationDateTimeData = (validationData: ValidationData): ValidationDateTimeData => {
  const { validation, setValidation } = validationData;

  const validationDateTime = useMemo((): ValidationDateTime => {
    if (
      validation &&
      'rule' in validation &&
      validation.rule &&
      validation.rule !== 'None' &&
      'DateTime' in validation.rule
    ) {
      return validation.rule.DateTime;
    }
    return {
      require_date: false,
      prohibit_date: false,
      require_time: false,
      prohibit_time: false,
      ignore_blank: true,
      ranges: [],
    };
  }, [validation]);

  const setValidationDateTime = (newValidationDateTime: ValidationDateTime) => {
    setValidation((validation) => {
      if (!validation) {
        return;
      }

      return {
        ...validation,
        rule: {
          DateTime: newValidationDateTime,
        },
      };
    });
  };

  const dateRequire = useMemo(() => {
    if (validationDateTime.require_date) {
      return 'required';
    }
    if (validationDateTime.prohibit_date) {
      return 'prohibit';
    }
    return '';
  }, [validationDateTime]);

  const timeRequire = useMemo(() => {
    if (validationDateTime.require_time) {
      return 'required';
    }
    if (validationDateTime.prohibit_time) {
      return 'prohibit';
    }
    return '';
  }, [validationDateTime]);

  const equals = useMemo(() => {
    const equals = validationDateTime.ranges.find((r) => 'DateEqual' in r);
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
  }, [validationDateTime]);

  const noDateHelp = useMemo(() => {
    if (dateRequire === 'prohibit') {
      return (
        <Tooltip title="Date part is prohibited">
          <InfoCircledIcon />
        </Tooltip>
      );
    }
    return null;
  }, [dateRequire]);

  const noTimeHelp = useMemo(() => {
    if (timeRequire === 'prohibit') {
      return (
        <Tooltip title="Time part is prohibited">
          <InfoCircledIcon />
        </Tooltip>
      );
    }
    return null;
  }, [timeRequire]);

  const equalsSetHelp = useMemo(() => {
    if (equals?.length) {
      return (
        <Tooltip title="'Date time equals' cannot be combined with other rules">
          <InfoCircledIcon />
        </Tooltip>
      );
    }
    return null;
  }, [equals]);

  const timeEquals = useMemo(() => {
    const timeEquals = validationDateTime.ranges.find((r) => 'TimeEqual' in r);
    if (timeEquals && 'TimeEqual' in timeEquals) {
      return timeEquals.TimeEqual.flatMap((t) => {
        const time = numberToTime(t);
        if (time) {
          return [time];
        } else {
          return [];
        }
      });
    } else {
      return [];
    }
  }, [validationDateTime.ranges]);

  const timeEqualsSetHelp = useMemo(() => {
    if (timeEquals.length) {
      return (
        <Tooltip title="'Time equals' cannot be combined with other rules">
          <InfoCircledIcon />
        </Tooltip>
      );
    }
    return null;
  }, [timeEquals]);

  return {
    validationDateTime,
    setValidationDateTime,
    timeRequire,
    dateRequire,
    equals,
    readOnly: validationData.readOnly,
    noDateHelp,
    noTimeHelp,
    equalsSetHelp,
    timeEquals,
    timeEqualsSetHelp,
  };
};
