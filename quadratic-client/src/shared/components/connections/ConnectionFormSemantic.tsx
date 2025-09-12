import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { type UseFormReturn } from 'react-hook-form';

interface ConnectionFormSemanticProps {
  form: UseFormReturn<any>;
  semanticDescription?: string;
}

// Change the component signature to use the new props type
export const ConnectionFormSemantic = ({ form, semanticDescription }: ConnectionFormSemanticProps) => {
  return (
    <FormField
      control={form.control}
      name="semanticDescription"
      defaultValue={semanticDescription}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Semantic description (optional)</FormLabel>
          <FormControl>
            <Textarea
              autoComplete="off"
              className="h-48"
              placeholder="Information put here will be used by AI to better understand your database. Example: 

table: widget-sales
purpose: all the historical sales for all widgets sold in North America.
columns:
  - column_name: 158394
    description: this column contains the regions in which sales can occur 
  - column_name: sales_accounting
    description: number of total sales in corresponding region"
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
