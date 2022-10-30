import React from 'react';

interface FromTo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  to: any;
}

type Changes = Record<string, FromTo>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericProps = Record<string, any>;

// from https://gist.github.com/mcalthrop/034c073ed24bc421adafbaea52d670ac
// TypeScript adaptation of https://usehooks.com/useWhyDidYouUpdate/
function useWhyDidYouUpdate(name: string, props: GenericProps): void {
  // Get a mutable ref object where we can store props ...
  // ... for comparison next time this hook runs.
  const previousProps = React.useRef<GenericProps>(props);

  React.useEffect(() => {
    if (previousProps && previousProps.current) {
      // Get all keys from previous and current props
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      // Use this object to keep track of changed props
      const changes: Changes = {};
      // Iterate through keys
      allKeys.forEach((key) => {
        // If previous is different from current
        if (previousProps.current[key] !== props[key]) {
          // Add to changesObj
          changes[key] = {
            from: previousProps.current[key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changes).length) {
        console.log('[why-did-you-update]', name, changes);
      }
    }

    // Finally update previousProps with current props for next hook call
    previousProps.current = props;
  });
}

export default useWhyDidYouUpdate;
