import useLocalStorage from '@/shared/hooks/useLocalStorage';

const DEFAULT_CURRENCY_KEY = 'defaultCurrency';
const DEFAULT_CURRENCY_VALUE = '$';

export function useDefaultCurrency(): [string, (currency: string) => void] {
  const [defaultCurrency, setDefaultCurrency] = useLocalStorage<string>(DEFAULT_CURRENCY_KEY, DEFAULT_CURRENCY_VALUE);
  return [defaultCurrency, setDefaultCurrency];
}
