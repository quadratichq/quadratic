import { ChevronLeftIcon } from '@/shared/components/Icons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Button } from '@/shared/shadcn/ui/button';
import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/shared/constants/routes';
import { sanityClient } from 'quadratic-shared/sanityClient';
import type { FilesListExampleFile } from '@/dashboard/components/FilesList';
import { FilesListItemExampleFile } from '@/dashboard/components/FilesListItem';
import { FilesListItems } from '@/dashboard/components/FilesListItem';
import { Layout } from '@/dashboard/components/FilesListViewControlsDropdown';

interface TemplateSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamUuid: string;
  isPrivate: boolean;
  onSelectTemplate: (publicFileUrlInProduction: string) => void;
  onBack?: () => void;
}

export function TemplateSelectorDialog({
  open,
  onOpenChange,
  teamUuid,
  isPrivate,
  onSelectTemplate,
  onBack,
}: TemplateSelectorDialogProps) {
  const [examples, setExamples] = useState<Awaited<ReturnType<typeof sanityClient.examples.list>>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterValue, setFilterValue] = useState('');

  useEffect(() => {
    if (open && examples.length === 0) {
      setIsLoading(true);
      sanityClient.examples.list().then((loadedExamples) => {
        setExamples(loadedExamples);
        setIsLoading(false);
      });
    }
  }, [open, examples.length]);

  const files: FilesListExampleFile[] = useMemo(
    () =>
      examples.map(({ name, description, thumbnail, url }) => ({
        description,
        href: ROUTES.CREATE_FILE_EXAMPLE({
          teamUuid,
          publicFileUrlInProduction: url,
          additionalParams: '',
        }),
        name,
        thumbnail: thumbnail + '?w=800&h=450&fit=crop&auto=format',
      })),
    [examples, teamUuid]
  );

  const filesToRender = filterValue
    ? files.filter(({ name }) => name.toLowerCase().includes(filterValue.toLowerCase()))
    : files;

  const handleSelect = (href: string) => {
    // Extract the example URL from the href
    const url = new URL(href, window.location.origin);
    const exampleUrl = url.searchParams.get('example');
    if (exampleUrl) {
      onSelectTemplate(decodeURIComponent(exampleUrl));
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-4xl flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {onBack && (
              <Button type="button" variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                <ChevronLeftIcon />
              </Button>
            )}
            <div className="flex-1">
              <DialogTitle className="text-center text-2xl font-bold">Select a template</DialogTitle>
              <DialogDescription className="text-center">Choose a template to get started with AI</DialogDescription>
            </div>
            {onBack && <div className="w-8"></div>}
          </div>
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-hidden py-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search templates..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Loading templates...</p>
              </div>
            ) : filesToRender.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">{filterValue ? 'No templates found' : 'No templates available'}</p>
              </div>
            ) : (
              <FilesListItems viewPreferences={{ layout: Layout.Grid }}>
                {filesToRender.map((file, i) => {
                  const lazyLoad = i > 12;
                  return (
                    <div key={file.href} onClick={() => handleSelect(file.href)} className="cursor-pointer">
                      <FilesListItemExampleFile
                        file={file}
                        filterValue={filterValue}
                        lazyLoad={lazyLoad}
                        viewPreferences={{ layout: Layout.Grid }}
                      />
                    </div>
                  );
                })}
              </FilesListItems>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
