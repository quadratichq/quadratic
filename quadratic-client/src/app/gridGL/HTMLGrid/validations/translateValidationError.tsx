import { sheets } from '@/app/grid/controller/Sheets';
import type { Validation } from '@/app/quadratic-core-types';
import { numberToDate, numberToTime } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { JoinWithOr } from '@/shared/components/JoinWithOr';
import { isNotUndefinedOrNull } from '@/shared/utils/undefined';
import type { JSX } from 'react';

export const translateValidationError = async (
  validation: Validation,
  column: number,
  row: number
): Promise<JSX.Element | null> => {
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
                  <JoinWithOr arr={r.Exactly.CaseSensitive} className={listClassName} /> (case sensitive).
                </div>
              );
            } else {
              return (
                <div key={i}>
                  Text {verb} be one of these values:{' '}
                  <JoinWithOr arr={r.Exactly.CaseInsensitive} className={listClassName} />.
                </div>
              );
            }
          }

          if ('Contains' in r) {
            if ('CaseSensitive' in r.Contains) {
              return (
                <div key={i}>
                  Text {verb} contain one of these values:{' '}
                  <JoinWithOr arr={r.Contains.CaseSensitive} className={listClassName} /> (case sensitive).
                </div>
              );
            } else {
              return (
                <div key={i}>
                  Text {verb} contain one of these values:{' '}
                  <JoinWithOr arr={r.Contains.CaseInsensitive} className={listClassName} />.
                </div>
              );
            }
          }

          if ('NotContains' in r) {
            if ('CaseSensitive' in r.NotContains) {
              return (
                <div key={i}>
                  Text {verb} not contain any of these values:{' '}
                  <JoinWithOr arr={r.NotContains.CaseSensitive} className={listClassName} /> (case sensitive).
                </div>
              );
            } else {
              return (
                <div key={i}>
                  Text {verb} <span className="underline">not</span> contain any of these values:{' '}
                  <JoinWithOr arr={r.NotContains.CaseInsensitive} className={listClassName} />.
                </div>
              );
            }
          }

          if ('TextLength' in r) {
            return (
              <div key={i}>
                {isNotUndefinedOrNull(r.TextLength.min) && isNotUndefinedOrNull(r.TextLength.max) && (
                  <>
                    Text {verb} be between <span className={listClassName}>{r.TextLength.min}</span> and{' '}
                    <span className={listClassName}>{r.TextLength.max}</span> characters long.
                  </>
                )}
                {isNotUndefinedOrNull(r.TextLength.min) && !isNotUndefinedOrNull(r.TextLength.max) && (
                  <>
                    Text {verb} be at least <span className={listClassName}>{r.TextLength.min}</span> characters long.
                  </>
                )}
                {!isNotUndefinedOrNull(r.TextLength.min) && isNotUndefinedOrNull(r.TextLength.max) && (
                  <>
                    Text {verb} be at most <span className={listClassName}>{r.TextLength.max}</span> characters long.
                  </>
                )}
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
                {isNotUndefinedOrNull(r.Range[0]) && isNotUndefinedOrNull(r.Range[1]) && (
                  <>
                    Number {verb} be between{' '}
                    <span className={listClassName}>
                      {r.Range[0]} and {r.Range[1]}
                    </span>
                    .
                  </>
                )}
                {isNotUndefinedOrNull(r.Range[0]) && !isNotUndefinedOrNull(r.Range[1]) && (
                  <>
                    Number {verb} be greater than or equal to <span className={listClassName}>{r.Range[0]}</span>.
                  </>
                )}
                {!isNotUndefinedOrNull(r.Range[0]) && isNotUndefinedOrNull(r.Range[1]) && (
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
                Number {verb} be equal to <JoinWithOr arr={r.Equal} className={listClassName} />.
              </div>
            );
          }

          if ('NotEqual' in r) {
            return (
              <div key={i}>
                Number {verb} <span className="underline">not</span> be equal to{' '}
                <JoinWithOr arr={r.NotEqual} className={listClassName} />.
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
          <JoinWithOr arr={validation.rule.List.source.List} className={listClassName} />.
        </div>
      );
    } else if ('Selection' in validation.rule.List.source) {
      const cells = await quadraticCore.getValidationList(sheets.current, column, row);
      return (
        <div className="whitespace-normal">
          {cells ? (
            <>
              Value {verb} be one of these values: <JoinWithOr arr={cells} className={listClassName} />.
            </>
          ) : (
            <>
              Value {verb} be one of the values in the selected range{' '}
              <span className={listClassName}>
                {sheets.A1SelectionToA1String(validation.rule.List.source.Selection, sheets.current)}.
              </span>
            </>
          )}
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
                {r.DateRange[0] && r.DateRange[1] && (
                  <>
                    Date {verb} be between{' '}
                    <span className={listClassName}>
                      {numberToDate(BigInt(r.DateRange[0]))} and {numberToDate(BigInt(r.DateRange[1]))}
                    </span>
                    .
                  </>
                )}
                {r.DateRange[0] && !r.DateRange[1] && (
                  <>
                    Date {verb} be on or after{' '}
                    <span className={listClassName}>{numberToDate(BigInt(r.DateRange[0]))}</span>.
                  </>
                )}
                {!r.DateRange[0] && r.DateRange[1] && (
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
                <JoinWithOr
                  arr={r.DateEqual.map((n) => numberToDate(BigInt(n))).filter((n): n is string =>
                    isNotUndefinedOrNull(n)
                  )}
                  className={listClassName}
                />
                .
              </div>
            );
          }

          if ('DateNotEqual' in r) {
            return (
              <div key={i}>
                Date {verb} <span className="underline">not</span> be{' '}
                <JoinWithOr
                  arr={r.DateNotEqual.map((n) => numberToDate(BigInt(n))).filter((n): n is string =>
                    isNotUndefinedOrNull(n)
                  )}
                  className={listClassName}
                />
                .
              </div>
            );
          }

          if ('TimeRange' in r) {
            return (
              <div key={i}>
                {isNotUndefinedOrNull(r.TimeRange[0]) && isNotUndefinedOrNull(r.TimeRange[1]) && (
                  <>
                    Time {verb} be between{' '}
                    <span className={listClassName}>
                      {numberToTime(r.TimeRange[0]!)} and {numberToTime(r.TimeRange[1]!)}
                    </span>
                    .
                  </>
                )}
                {isNotUndefinedOrNull(r.TimeRange[0]) && !isNotUndefinedOrNull(r.TimeRange[1]) && (
                  <>
                    Time {verb} be on or before <span className={listClassName}>{numberToTime(r.TimeRange[0]!)}</span>.
                  </>
                )}
                {!isNotUndefinedOrNull(r.TimeRange[0]) && isNotUndefinedOrNull(r.TimeRange[1]) && (
                  <>
                    Time {verb} be on or after <span className={listClassName}>{numberToTime(r.TimeRange[1]!)}</span>.
                  </>
                )}
              </div>
            );
          }

          if ('TimeEqual' in r) {
            return (
              <div key={i}>
                Time {verb} be{' '}
                <JoinWithOr
                  arr={r.TimeEqual.map((n) => numberToTime(n)).filter((n): n is string => isNotUndefinedOrNull(n))}
                  className={listClassName}
                />
                .
              </div>
            );
          }

          if ('TimeNotEqual' in r) {
            return (
              <div key={i}>
                Time {verb} <span className="underline">not</span> be{' '}
                <JoinWithOr
                  arr={r.TimeNotEqual.map((n) => numberToTime(n)).filter((n): n is string => isNotUndefinedOrNull(n))}
                  className={listClassName}
                />
                .
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
