import { AIIcon, FileIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/shadcn/ui/card';
import { Cross2Icon, UploadIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export function OnboardingFileImportTip() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isVisible, setIsVisible] = useState(false);

  // Check if we should show the tip
  useEffect(() => {
    const showTip = searchParams.get('onboarding-file-import') === 'true';
    if (showTip) {
      setIsVisible(true);
      // Remove the param from URL without navigation
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('onboarding-file-import');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
      <Card className="pointer-events-auto relative w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8"
          onClick={handleClose}
          aria-label="Close"
        >
          <Cross2Icon className="h-4 w-4" />
        </Button>

        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileIcon className="text-primary" />
            Import your files
          </CardTitle>
          <CardDescription>Here's how you can add files to your spreadsheet:</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-start gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <AIIcon className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Use AI to import</h3>
              <p className="text-sm text-muted-foreground">
                Open the AI panel and click the{' '}
                <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-xs font-medium">
                  <UploadIcon className="h-3 w-3" /> Attach
                </span>{' '}
                button to upload files. AI will help you analyze and work with your data.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <UploadIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Drag and drop</h3>
              <p className="text-sm text-muted-foreground">
                Simply drag any Excel, CSV, PDF, or Parquet file directly onto the sheet. The data will be imported
                automatically.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleClose}>Got it!</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
