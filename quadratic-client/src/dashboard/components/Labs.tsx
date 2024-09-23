import { themes, useTheme } from '@/shared/hooks/useTheme';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { CONTACT_URL } from '@/shared/constants/urls';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/shared/shadcn/ui/form';
import { Switch } from '@/shared/shadcn/ui/switch';

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

  const [theme, setTheme] = useTheme();

  // Refactor to this:
  // <AccountSection title={} description={}>{children}</AccountSection>
  // <LabSetting title={} description={} checked={} onChange={}>{children}</LabSetting>

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mb-4 w-full space-y-6">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-medium">
            Labs <Badge variant="secondary">Beta</Badge>
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Test drive beta features. Don’t like them? Turn them off and{' '}
            <a href={CONTACT_URL} className="underline hover:text-primary">
              gives us feedback
            </a>
            .
          </p>
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
                    <div className="flex flex-row items-center gap-4 border-t border-border pt-3">
                      {/* <Type variant="body2" className="font-medium">
                        Theme
                      </Type> */}
                      <div className="inline-flex items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
                        {themes.map((t) => (
                          <Button
                            key={t}
                            className={
                              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow'
                            }
                            data-state={theme === t ? 'active' : 'inactive'}
                            variant={null}
                            onClick={() => {
                              setTheme(t);
                            }}
                          >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="themeAccentColor"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Accent color</FormLabel>
                    <FormDescription>Customize the primary color of the app.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
