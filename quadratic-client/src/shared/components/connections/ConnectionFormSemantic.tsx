import { FormControl, FormField, FormItem, FormMessage } from '@/shared/shadcn/ui/form';
import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { useEffect, useRef, useState } from 'react';
import { type UseFormReturn } from 'react-hook-form';

interface ConnectionFormSemanticProps {
  form: UseFormReturn<any>;
}

const NAME = 'semanticDescription';

// Change the component signature to use the new props type
export const ConnectionFormSemantic = ({ form }: ConnectionFormSemanticProps) => {
  // Only show the semantic description if the user has checked the checkbox
  const value = form.getValues(NAME);
  const [checked, setChecked] = useState(Boolean(value));
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // When the box is checked, focus the textarea and reset the value
    // to whatever the current value is (from the DB)
    if (checked) {
      ref.current?.focus();
      form.resetField(NAME);
      // Otherwise, set the value to empty (equivalent to removing the value)
    } else {
      form.setValue(NAME, '');
    }
  }, [checked, form]);

  return (
    <>
      <div className="flex items-center gap-2 py-1">
        <Switch
          id="semantic-description-checkbox"
          checked={checked}
          onCheckedChange={(checked) => setChecked(!!checked)}
          className=""
        />
        <Label htmlFor="semantic-description-checkbox">Include a semantic description</Label>
      </div>
      {checked && (
        <FormField
          control={form.control}
          name={NAME}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea autoComplete="off" className="h-48" placeholder="" {...field} ref={ref} />
              </FormControl>
              <FormMessage />
              <p className="mb-0 text-sm text-muted-foreground">
                Information put here will be used by AI to better understand your database. Example:
              </p>
              <pre className="overflow-x-auto rounded font-sans text-sm text-muted-foreground">{`table: widget-sales
purpose: all the historical sales for all widgets sold in North America.
columns:
  - column_name: 158394
    description: this column contains the regions in which sales can occur 
  - column_name: sales_accounting
    description: number of total sales in corresponding region`}</pre>
            </FormItem>
          )}
        />
      )}
    </>
  );
};
