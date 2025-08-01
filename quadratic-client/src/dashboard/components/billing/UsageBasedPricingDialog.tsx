import { formatToFractionalDollars, parseInputForNumber } from '@/dashboard/components/billing/utils';
import { ArrowForwardIcon, SpinnerIcon } from '@/shared/components/Icons';
import { CONTACT_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/shadcn/ui/dialog';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

const OPTION_CUSTOM = 'Custom amount';
const OPTIONS = ['20', '50', '100', '200', OPTION_CUSTOM];
const OPTION_DEFAULT = OPTIONS[0];
const MAX_CUSTOM_LIMIT = 500;

export function UsageBasedPricingDialog({
  currentLimitNumber,
  handleChange,
  children,
}: {
  currentLimitNumber: number;
  // TODO: figure out how we want to handle this, as it's probably a fetcher
  // since we're using it from multiple places both in the dashboard and in the app
  // Or: maybe we do the fetcher here and keep track of it all internally, since it should
  // know how to update itself.
  handleChange: (value: number) => Promise<boolean>;
  children: React.ReactNode; // Trigger
}) {
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isOpen, setIsOpen] = useState(false);
  const [newLimit, setNewLimit] = useState(OPTION_DEFAULT);
  const [customLimit, setCustomLimit] = useState('');

  const newLimitNumber =
    newLimit === OPTION_CUSTOM ? Number(customLimit === '' ? 0 : customLimit) : currentLimitNumber + Number(newLimit);
  const change = newLimitNumber - currentLimitNumber;
  const changeSign = Math.sign(change);
  const changeType = changeSign === -1 ? 'less' : changeSign === 0 ? 'same' : 'more';

  const hasCustomLimitThatsTooHigh = newLimitNumber > MAX_CUSTOM_LIMIT;
  const disabled =
    currentLimitNumber === newLimitNumber ||
    (newLimit === OPTION_CUSTOM && customLimit === '') ||
    hasCustomLimitThatsTooHigh;
  const isLoading = loadState === 'loading';

  useEffect(() => {
    // Reset the form when the dialog is closed
    if (isOpen === false) {
      setNewLimit(OPTION_DEFAULT);
      setCustomLimit('');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set usage-based credits limit</DialogTitle>
          <DialogDescription>
            Use AI beyond your monthly credit allottment by setting a limit on usage-based pricing.{' '}
            <a href="TODO:" target="_blank" rel="noreferrer" className="underline hover:text-primary">
              Learn more in the docs.
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Your monthly limit</p>

          <form className="flex flex-col gap-2">
            <div className={`grid grid-cols-6 gap-2`}>
              {OPTIONS.map((value, i) => (
                <label
                  className={cn(
                    `flex h-9 items-center justify-center gap-0.5 rounded-md border border-border px-2 text-sm shadow-sm has-[:checked]:border-primary has-[:checked]:bg-accent`,
                    value === OPTION_CUSTOM && 'col-span-2'
                  )}
                  key={value}
                >
                  {value === OPTION_CUSTOM ? value : `+$${value}`}
                  <input
                    disabled={isLoading}
                    type="radio"
                    name="usage-based-pricing"
                    value={value}
                    className="sr-only"
                    checked={newLimit === value}
                    onChange={(e) => {
                      setNewLimit(e.target.value);
                      setCustomLimit('');
                    }}
                  />
                </label>
              ))}
            </div>

            {newLimit === OPTION_CUSTOM && (
              <div className={`relative col-span-6`}>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  disabled={isLoading}
                  autoFocus={true}
                  type="text"
                  placeholder="Custom amount, e.g. 250"
                  className={cn('pl-8')}
                  onChange={(e) => {
                    const value = parseInputForNumber(e.target.value);
                    setCustomLimit(value);
                  }}
                  maxLength={100000}
                  value={customLimit}
                />
              </div>
            )}
          </form>

          <div className="hidden rounded bg-accent px-4 py-2 text-sm">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-1 text-right font-normal text-muted-foreground">Current</th>

                  <th className="pb-1 text-right font-normal text-muted-foreground">Change</th>
                  <th className="pb-1 text-right font-normal text-muted-foreground">New</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pt-1 text-right font-semibold">{formatToFractionalDollars(currentLimitNumber)}</td>

                  <td
                    className={cn(
                      'pt-1 text-right font-medium',
                      changeType === 'less' && 'text-destructive',
                      changeType === 'more' && 'text-green-600'
                    )}
                  >
                    {changeType === 'more' && '+'}
                    {formatToFractionalDollars(change)}
                  </td>
                  <td className="pt-1 text-right font-semibold">{formatToFractionalDollars(newLimitNumber)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 items-center rounded bg-accent p-2">
            <p className="flex flex-col text-sm text-muted-foreground">
              <span className="text-xs text-muted-foreground">Current monthly limit</span>
              <span className="font-semibold text-foreground">{formatToFractionalDollars(currentLimitNumber)}</span>
            </p>
            <ArrowForwardIcon className="justify-self-center text-muted-foreground opacity-50" />
            <p className="flex flex-col text-right text-sm text-muted-foreground">
              <span className="text-xs text-muted-foreground">New monthly limit</span>
              <span className="font-semibold text-foreground">{formatToFractionalDollars(newLimitNumber)}</span>
            </p>
          </div>
          {hasCustomLimitThatsTooHigh && (
            <p className="text-sm text-destructive">
              <Link to={CONTACT_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
                Contact us
              </Link>{' '}
              for limits over {formatToFractionalDollars(MAX_CUSTOM_LIMIT)}.
            </p>
          )}
        </div>
        <DialogFooter>
          {isLoading && (
            <div className="flex items-center justify-center">
              <SpinnerIcon className="text-primary" />
            </div>
          )}
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={isLoading || disabled}
            onClick={() => {
              setLoadState('loading');
              handleChange(newLimitNumber)
                .then(() => {
                  setLoadState('success');
                  setIsOpen(false);
                })
                .catch(() => {
                  setLoadState('error');
                });
            }}
          >
            Set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
