import * as Sentry from '@sentry/react';
import { debugShowRustTime } from '../../debugFlags';

export const GridPerformanceProxy = <T extends object>(object: T): T => {
  return new Proxy(object, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (typeof original === 'function') {
        return function (...args: any[]) {
          const start = performance.now();
          let result = Sentry.startSpan({ name: `Grid.${String(prop)}`, op: 'function' }, () => {
            // Call function
            return Reflect.apply(original, receiver, args);
          });
          const end = performance.now();
          if (debugShowRustTime) console.log(`Grid.${String(prop)} took ${end - start}ms`);
          return result;
        };
      }
      return original;
    },
  });
};
