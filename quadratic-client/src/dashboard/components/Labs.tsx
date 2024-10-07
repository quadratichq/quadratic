import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/shared/shadcn/ui/form';
import { Switch } from '@/shared/shadcn/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const FormSchema = z.object({
  themeDarkMode: z.boolean().default(false).optional(),
  themeAccentColor: z.boolean(),
});

export function Labs() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      themeDarkMode: false,
      themeAccentColor: false,
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    console.log(data);
  }

  // Refactor to this:
  // <AccountSection title={} description={}>{children}</AccountSection>
  // <AccountLabSetting title={} description={} checked={} onChange={}>{children}</AccountLabSetting>

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mb-4 w-full space-y-6">
        <div>
          <div className="mt-4 space-y-4">
            <FormField
              control={form.control}
              name="themeDarkMode"
              render={({ field }) => (
                <FormItem className="space-y-3 rounded-lg border p-3 shadow-sm">
                  <div className="flex w-full flex-row items-center justify-between">
                    <div className="mr-auto space-y-0.5">
                      <FormLabel>Appearance (dark mode)</FormLabel>
                      <FormDescription>Customize the app’s appearance for light, dark, or system mode.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </div>
                  {field.value && (
                    <div className="flex gap-2 border-t border-border pt-3">
                      <ThemeAppearanceModes />
                    </div>
                  )}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="themeAccentColor"
              render={({ field }) => (
                <FormItem className="space-y-3 rounded-lg border p-3 shadow-sm">
                  <div className="flex w-full flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Accent color</FormLabel>
                      <FormDescription>Customize the primary color of the app.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </div>
                  {field.value && (
                    <div className="flex flex-row items-center gap-2 border-t border-border pt-3">
                      <ThemeAccentColors />
                    </div>
                  )}
                </FormItem>
              )}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
