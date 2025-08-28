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
    <>
      <FormField
        control={form.control}
        name="semanticDescription"
        defaultValue={semanticDescription}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tell us about your data</FormLabel>
            <FormControl>
              <Textarea autoComplete="off" className="h-48" placeholder="Semantic placeholder copy here" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};
