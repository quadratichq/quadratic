import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

// See: https://usehooks-ts.com/react-hook/use-event-listener
import useEventListener from '@/shared/hooks/useEventListener';

declare global {
  interface WindowEventMap {
    'local-storage': StorageEvent;
    'run-editor-action': CustomEvent;
  }
}

export type SetValue<T> = Dispatch<SetStateAction<T>>;

function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  const initialValueRef = useRef(initialValue);

  // source https://usehooks-ts.com/react-hook/use-local-storage
  // Get from local storage then
  // parse stored json or return initialValue
  const readValue = useCallback((): T => {
    // Prevent build error "window is undefined" but keep keep working
    if (typeof window === 'undefined') {
      return initialValueRef.current;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (parseJSON(item) as T) : initialValueRef.current;
    } catch (error) {
      throw new Error(`Error reading localStorage key “${key}”`);
    }
  }, [key]);

  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue: SetValue<T> = useCallback(
    (value) => {
      // Prevent build error "window is undefined" but keeps working
      if (typeof window == 'undefined') {
        throw new Error(`Tried setting localStorage key “${key}” even though environment is not a client`);
      }

      try {
        // Save state
        setStoredValue((oldValue) => {
          // Allow value to be a function so we have the same API as useState
          const newValue = value instanceof Function ? value(oldValue) : value;
          const newValueString = JSON.stringify(newValue);

          const oldValueString = window.localStorage.getItem(key);

          if (newValueString !== oldValueString) {
            // Save to local storage
            window.localStorage.setItem(key, newValueString);

            // Defer the event so other components' setState runs in a separate tick.
            // Dispatching synchronously here would update other components (e.g. UpgradeDialog)
            // while still inside this setState updater, causing a React "setState during render" warning.
            const event = new StorageEvent('local-storage', {
              key,
              newValue: newValueString,
              oldValue: oldValueString,
            });
            queueMicrotask(() => window.dispatchEvent(event));
          }

          return newValue;
        });
      } catch (error) {
        throw new Error(`Error setting localStorage key “${key}”`);
      }
    },
    [key]
  );

  useEffect(() => {
    if (window.localStorage.getItem(key) === null) {
      setValue(initialValue);
    }
  }, [initialValue, key, setValue]);

  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  const handleStorageChange = useCallback(
    (e: StorageEvent) => {
      if (e.key === key) {
        setStoredValue(readValue());
      }
    },
    [readValue, key]
  );

  // this only works for other documents, not the current one
  useEventListener('storage', handleStorageChange);

  // this is a custom event, triggered in writeValueToLocalStorage
  // See: useLocalStorage()
  useEventListener('local-storage', handleStorageChange);

  return [storedValue, setValue];
}

export default useLocalStorage;

// A wrapper for "JSON.parse()"" to support "undefined" value
function parseJSON<T>(value: string | null): T | undefined {
  try {
    return value === 'undefined' ? undefined : JSON.parse(value ?? '');
  } catch (error) {
    console.log('parsing error on', { value });
    return undefined;
  }
}
