import { ArrowRightIcon, CheckBoxEmptyIcon, CheckBoxIcon } from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useRef } from 'react';

const CONTROL_BASE =
  'group relative select-none rounded border border-border font-medium shadow-sm hover:border-primary hover:shadow-md has-[input:checked]:border-primary has-[input:checked]:bg-accent has-[input:checked]:shadow-lg has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-ring cursor-pointer';
const CONTROL_INLINE =
  'flex items-center gap-2 rounded-lg border border-border px-4 py-4 font-medium shadow-sm hover:border-primary active:bg-accent';
const CONTROL_STACKED =
  'flex flex-col items-center gap-1 rounded-lg border border-border px-4 py-8 font-medium shadow-sm hover:border-primary active:bg-accent';

export function ControlLinkInline(props: { children: React.ReactNode }) {
  return (
    <div className={cn(CONTROL_BASE, CONTROL_INLINE)}>
      {props.children}
      <ArrowRightIcon className="ml-auto opacity-20 group-hover:text-primary group-hover:opacity-100" />
    </div>
  );
}

export function ControlLinkStacked(props: { children: React.ReactNode }) {
  return <div className={cn(CONTROL_BASE, CONTROL_STACKED)}>{props.children}</div>;
}

function ControlCheckbox(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    children: React.ReactNode;
  }
) {
  const { children, className, ...rest } = props;

  return (
    <label className={cn(CONTROL_BASE, className)}>
      <input type="checkbox" className="peer sr-only" {...rest} />
      {children}
    </label>
  );
}

export function ControlCheckboxInline(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    children: React.ReactNode;
  }
) {
  const { children, ...rest } = props;
  const iconClassName = 'absolute right-4 top-1/2 -translate-y-1/2';
  const defaultClassName = 'flex items-center gap-2 rounded-lg p-4 peer';
  return (
    <ControlCheckbox className={defaultClassName} {...rest}>
      {children}
      <CheckBoxEmptyIcon
        className={cn(iconClassName, 'text-border opacity-100 group-hover:text-primary peer-checked:opacity-0')}
      />
      <CheckBoxIcon className={cn(iconClassName, 'text-primary opacity-0 peer-checked:opacity-100')} />
    </ControlCheckbox>
  );
}

export function ControlCheckboxStacked(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    children: React.ReactNode;
  }
) {
  const { children, className, ...rest } = props;
  const iconClassName = 'absolute right-2 top-2';

  return (
    <ControlCheckbox className={CONTROL_STACKED} {...rest}>
      {props.children}
      <CheckBoxEmptyIcon className={cn(iconClassName, 'text-border opacity-100 peer-checked:opacity-0')} />
      <CheckBoxIcon className={cn(iconClassName, 'text-primary opacity-0 peer-checked:opacity-100')} />
    </ControlCheckbox>
  );
}

export function ControlCheckboxInputOther(props: {
  children: React.ReactNode;
  id: string;
  value: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  stacked?: boolean;
}) {
  const { children, id, value, checked, onChange } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  // Control the functionality of the input based on the checked state
  useEffect(() => {
    if (checked) {
      inputRef.current?.focus();
    } else if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [checked]);

  const ControlCheckbox = props.stacked ? ControlCheckboxStacked : ControlCheckboxInline;

  return (
    <>
      <ControlCheckbox checked={checked} id={id} name={id} value={value} onChange={(e) => onChange(e.target.checked)}>
        {children}
      </ControlCheckbox>

      {checked && (
        <input
          type="text"
          ref={inputRef}
          name={`${id}-other`}
          placeholder="Please elaborate…"
          className="text-md col-span-full w-full rounded-lg border border-border px-4 py-4 font-medium peer-has-[input:checked]:border-primary peer-has-[input:checked]:bg-accent peer-has-[input:checked]:shadow-lg"
        />
      )}
    </>
  );
}
