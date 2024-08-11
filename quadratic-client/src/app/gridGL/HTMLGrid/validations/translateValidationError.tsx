import { Validation } from '@/app/quadratic-core-types';

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
                  <span className={listClassName}>{r.Exactly.CaseSensitive.join(', ')}</span> (case sensitive).
                </div>
              );
            } else {
              return (
                <div key={i}>
                  Text {verb} be one of these values:{' '}
                  <span className={listClassName}>{r.Exactly.CaseInsensitive.join(', ')}</span>.
                </div>
              );
            }
          }

          if ('Contains' in r) {
            if ('CaseSensitive' in r.Contains) {
              return (
                <div key={i}>
                  Text {verb} contain one of these values:{' '}
                  <span className={listClassName}>{r.Contains.CaseSensitive.join(', ')}</span> (case sensitive).
                </div>
              );
            } else {
              return (
                <div key={i}>
                  Text {verb} contain one of these values:{' '}
                  <span className={listClassName}>{r.Contains.CaseInsensitive.join(', ')}</span>.
                </div>
              );
            }
          }

          if ('NotContains' in r) {
            if ('CaseSensitive' in r.NotContains) {
              return (
                <div key={i}>
                  Text {verb} not contain any of these values:{' '}
                  <span className={listClassName}>{r.NotContains.CaseSensitive.join(', ')}</span> (case sensitive).
                </div>
              );
            } else {
              return (
                <div key={i}>
                  Text {verb} <span className="underline">not</span> contain any of these values:{' '}
                  <span className={listClassName}>{r.NotContains.CaseInsensitive.join(', ')}</span>.
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
                Number {verb} be equal to <span className={listClassName}>{r.Equal.join(', ')}</span>.
              </div>
            );
          }

          if ('NotEqual' in r) {
            return (
              <div key={i}>
                Number {verb} <span className="underline">not</span> be equal to{' '}
                <span className={listClassName}>{r.NotEqual.join(', ')}</span>.
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

  return null;
};
