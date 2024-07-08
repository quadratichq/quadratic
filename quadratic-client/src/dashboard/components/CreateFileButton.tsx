import { getExtension, isCsv, isExcel, isGrid, isParquet, stripExtension } from '@/app/helpers/files';
import { validateAndUpgradeGridFile } from '@/app/schemas/validateAndUpgradeGridFile';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { CaretDownIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { ChangeEvent, useState } from 'react';
import { Link, useParams, useSubmit } from 'react-router-dom';

export type UploadFileType = 'grid' | 'excel' | 'csv' | 'parquet';

const getFileType = (file: File): UploadFileType => {
  if (isGrid(file)) return 'grid';
  if (isExcel(file)) return 'excel';
  if (isCsv(file)) return 'csv';
  if (isParquet(file)) return 'parquet';

  throw new Error(`Unsupported file type: ${getExtension(file.name)}`);
};

export default function CreateFileButton({ isPrivate }: { isPrivate?: boolean }) {
  const [open, onOpenChange] = useState<boolean>(false);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const submit = useSubmit();
  const { teamUuid } = useParams() as { teamUuid: string };
  const actionUrl = isPrivate ? ROUTES.CREATE_FILE_PRIVATE(teamUuid) : ROUTES.CREATE_FILE(teamUuid);

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    // If nothing was selected, just exit
    if (!e.target.files) return;

    // need to make sure quadratiCore's worker is initialized to call the Rust functions
    quadraticCore.initWorker();

    try {
      // Get the file and it's contents
      const file: File = e.target.files[0];
      let data: { name: string; version: string; contents: string } | undefined;

      switch (getFileType(file)) {
        case 'grid':
          mixpanel.track('[Files].importGrid', { fileName: file.name });
          const contents = await file.text().catch((e) => null);

          // Ensure it's a valid Quadratic grid file
          const validFile = await validateAndUpgradeGridFile(contents);
          if (!validFile) {
            addGlobalSnackbar('Import failed: invalid `.grid` file.', { severity: 'error' });
            return;
          }

          data = {
            name: file.name ? stripExtension(file.name) : 'Untitled',
            version: validFile.version,
            contents: validFile.version === '1.3' ? JSON.stringify(validFile) : validFile.contents,
          };
          break;

        case 'excel':
          mixpanel.track('[Files].importExcel', { fileName: file.name });
          const importedFile = await quadraticCore.importExcel(file);

          if (importedFile?.error) {
            addGlobalSnackbar(importedFile.error, { severity: 'warning' });
            return;
          }
          if (importedFile?.version && importedFile?.contents) {
            data = {
              name: file.name ? stripExtension(file.name) : 'Untitled',
              version: importedFile.version,
              contents: importedFile.contents,
            };
          }
          break;

        // TODO(ddimaira): implement these
        case 'csv':
        case 'parquet':
        default:
          addGlobalSnackbar('Import failed: unsupported file type.', { severity: 'warning' });
      }

      // Upload it
      if (data) {
        submit(data, { method: 'POST', action: actionUrl, encType: 'application/json' });
      }
    } catch (e) {
      if (e instanceof Error) addGlobalSnackbar(e.message, { severity: 'warning' });
    }

    // Reset the input so we can add the same file
    e.target.value = '';
  };

  const DropDownButton = (props: { extension: string; name: string }): JSX.Element => {
    const { name, extension } = props;

    return (
      <DropdownMenuItem
        asChild
        onSelect={(e) => {
          // We have to prevent this (and handle the `open` state manually)
          // or the file input's onChange handler won't work properly
          e.preventDefault();
        }}
      >
        <label className="flex cursor-pointer justify-between gap-4">
          {name} <span className="mx-1 font-mono text-xs text-muted-foreground">.{extension}</span>
          <input
            type="file"
            name="content"
            accept={`.${extension}`}
            onChange={(e) => {
              onOpenChange(false);
              handleImport(e);
            }}
            hidden
          />
        </label>
      </DropdownMenuItem>
    );
  };

  return (
    <div className="flex gap-2">
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            Import file <CaretDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropDownButton name="Quadratic" extension="grid" />
          <DropDownButton name="Excel" extension="xlsx" />
        </DropdownMenuContent>
      </DropdownMenu>
      <Button asChild>
        <Link to={actionUrl}>Create file</Link>
      </Button>
    </div>
  );
}
