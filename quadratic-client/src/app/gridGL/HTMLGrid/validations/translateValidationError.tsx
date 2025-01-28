import { sheets } from '@/app/grid/controller/Sheets';
import type { Validation } from '@/app/quadratic-core-types';
import { numberToDate, numberToTime } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { joinWithOr } from '@/shared/utils/text';

export const translateValidationError = (validation: Validation): JSX.Element | null => {
  if (validation.rule === 'None') {
    return null;
  }

  const verb = validation.error.style === 'Stop' ? 'must' : 'should';
  const listClassName = 'font-bold';

  if ('Text' in validation.rule && validation.rule.Text.text_match) {
    return (
      <div className="flex flex-col gap-2 whitespace-normal">
        {validation.rule.Text.text_match.map((r, i) => {
          if ('Exactly' in r) {
            if ('CaseSensitive' in r.Exactly) {
              return (
                <div key={i}>
                  Text {verb} be one of these values:{' '}
                  <span className={listClassName}>{joinWithOr(r.Exactly.CaseSensitive)}</span> (case sensitive).
                </div>
              );
            } else {
              return (
                <div key={i}>
                  Text {verb} be one of these values:{' '}
                  <span className={listClassName}>{joinWithOr(r.Exactly.CaseInsensitive)}</span>.
                </div>
              );
            }
          }

          if ('Contains' in r) {
            if ('CaseSensitive' in r.Contains) {
              return (
                <div key={i}>
                  Text {verb} contain one of these values:{' '}
                  <span className={listClassName}>{joinWithOr(r.Contains.CaseSensitive)}</span> (case sensitive).
                </div>
              );
            } else {
              return (
                <div key={i}>
                  Text {verb} contain one of these values:{' '}
                  <span className={listClassName}>{joinWithOr(r.Contains.CaseInsensitive)}</span>.
                </div>
              );
            }
          }

          if ('NotContains' in r) {
            if ('CaseSensitive' in r.NotContains) {
              return (
                <div key={i}>
                  Text {verb} not contain any of these values:{' '}
                  <span className={listClassName}>{joinWithOr(r.NotContains.CaseSensitive)}</span> (case sensitive).
                </div>
              );
            } else {
              return (
                <div key={i}>
                  Text {verb} <span className="underline">not</span> contain any of these values:{' '}
                  <span className={listClassName}>{joinWithOr(r.NotContains.CaseInsensitive)}</span>.
                </div>
              );
            }
          }

          if ('TextLength' in r) {
            return (
              <div key={i}>
                Text {verb} be between {r.TextLength.min !== null ? r.TextLength.min : '0'} and{' '}
                {r.TextLength.max !== null ? r.TextLength.max : '∞'} characters long.
              </div>
            );
          }

          return <div key={i}></div>;
        })}
      </div>
    );
  }

  if ('Number' in validation.rule && validation.rule.Number.ranges) {
    return (
      <div className="flex flex-col gap-2 whitespace-normal">
        {validation.rule.Number.ranges.map((r, i) => {
          if ('Range' in r) {
            return (
              <div key={i}>
                {r.Range[0] !== null && r.Range[1] !== null && (
                  <>
                    Number {verb} be between{' '}
                    <span className={listClassName}>
                      {r.Range[0]} and {r.Range[1]}
                    </span>
                    .
                  </>
                )}
                {r.Range[0] !== null && r.Range[1] === null && (
                  <>
                    Number {verb} be greater than or equal to <span className={listClassName}>{r.Range[0]}</span>.
                  </>
                )}
                {r.Range[0] === null && r.Range[1] !== null && (
                  <>
                    Number {verb} be less than or equal to <span className={listClassName}>{r.Range[1]}</span>.
                  </>
                )}
              </div>
            );
          }

          if ('Equal' in r) {
            return (
              <div key={i}>
                Number {verb} be equal to <span className={listClassName}>{joinWithOr(r.Equal)}</span>.
              </div>
            );
          }

          if ('NotEqual' in r) {
            return (
              <div key={i}>
                Number {verb} <span className="underline">not</span> be equal to{' '}
                <span className={listClassName}>{joinWithOr(r.NotEqual)}</span>.
              </div>
            );
          }

          return <div key={i}></div>;
        })}
      </div>
    );
  }

  if ('Logical' in validation.rule && validation.rule.Logical) {
    return (
      <div>
        Value {verb} be <span className={listClassName}>true</span> or <span className={listClassName}>false</span>.
      </div>
    );
  }

  if ('List' in validation.rule && validation.rule.List) {
    if ('List' in validation.rule.List.source) {
      return (
        <div className="whitespace-normal">
          Value {verb} be one of these values:{' '}
          <span className={listClassName}>{joinWithOr(validation.rule.List.source.List)}</span>.
        </div>
      );
    } else if ('Selection' in validation.rule.List.source) {
      return (
        <div className="whitespace-normal">
          Value {verb} be one of the values in the selected range{' '}
          <span className={listClassName}>{sheets.sheet.cursor.toA1String()}</span>.
        </div>
      );
    }
  }

  if ('DateTime' in validation.rule && validation.rule.DateTime) {
    return (
      <div className="flex flex-col gap-2 whitespace-normal">
        {validation.rule.DateTime.ranges.map((r, i) => {
          if ('DateRange' in r) {
            return (
              <div key={i}>
                {r.DateRange[0] !== null && r.DateRange[1] !== null && (
                  <>
                    Date {verb} be between{' '}
                    <span className={listClassName}>
                      {numberToDate(BigInt(r.DateRange[0]))} and {numberToDate(BigInt(r.DateRange[1]))}
                    </span>
                    .
                  </>
                )}
                {r.DateRange[0] !== null && r.DateRange[1] === null && (
                  <>
                    Date {verb} be on or after{' '}
                    <span className={listClassName}>{numberToDate(BigInt(r.DateRange[0]))}</span>.
                  </>
                )}
                {r.DateRange[0] === null && r.DateRange[1] !== null && (
                  <>
                    Date {verb} be on or before{' '}
                    <span className={listClassName}>{numberToDate(BigInt(r.DateRange[1]))}</span>.
                  </>
                )}
              </div>
            );
          }

          if ('DateEqual' in r) {
            return (
              <div key={i}>
                Date {verb} be{' '}
                <span className={listClassName}>{joinWithOr(r.DateEqual.map((n) => numberToDate(BigInt(n))))}</span>.
              </div>
            );
          }

          if ('DateNotEqual' in r) {
            return (
              <div key={i}>
                Date {verb} <span className="underline">not</span> be{' '}
                <span className={listClassName}>{joinWithOr(r.DateNotEqual.map((n) => numberToDate(BigInt(n))))}</span>.
              </div>
            );
          }

          if ('TimeRange' in r) {
            return (
              <div key={i}>
                {r.TimeRange[0] !== null && r.TimeRange[1] !== null && (
                  <>
                    Time {verb} be between{' '}
                    <span className={listClassName}>
                      {numberToTime(r.TimeRange[0])} and {numberToTime(r.TimeRange[1])}
                    </span>
                    .
                  </>
                )}
                {r.TimeRange[0] !== null && r.TimeRange[1] === null && (
                  <>
                    Time {verb} be on or before <span className={listClassName}>{numberToTime(r.TimeRange[0])}</span>.
                  </>
                )}
                {r.TimeRange[0] === null && r.TimeRange[1] !== null && (
                  <>
                    Time {verb} be on or after <span className={listClassName}>{numberToTime(r.TimeRange[1])}</span>.
                  </>
                )}
              </div>
            );
          }

          if ('TimeEqual' in r) {
            return (
              <div key={i}>
                Time {verb} be{' '}
                <span className={listClassName}>{joinWithOr(r.TimeEqual.map((n) => numberToTime(n)))}</span>.
              </div>
            );
          }

          if ('TimeNotEqual' in r) {
            return (
              <div key={i}>
                Time {verb} <span className="underline">not</span> be{' '}
                <span className={listClassName}>{joinWithOr(r.TimeNotEqual.map((n) => numberToTime(n)))}</span>.
              </div>
            );
          }

          return <div key={i}></div>;
        })}
      </div>
    );
  }

  return null;
};
