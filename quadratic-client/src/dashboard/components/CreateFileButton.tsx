import { isCsv, isExcel, isGrid, isParquet, stripExtension } from '@/helpers/files';
import { Button } from '@/shadcn/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shadcn/ui/dropdown-menu';
import { CaretDownIcon } from '@radix-ui/react-icons';
import { ChangeEvent, useState } from 'react';
import { Link, useParams, useSubmit } from 'react-router-dom';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { ROUTES } from '../../constants/routes';
import { importExcel } from '../../grid/controller/Grid';
import { validateAndUpgradeGridFile } from '../../schemas/validateAndUpgradeGridFile';

export type UploadFileType = 'grid' | 'excel' | 'csv' | 'parquet';

const getFileType = (file: File): UploadFileType => {
  if (isGrid(file)) return 'grid';
  if (isExcel(file)) return 'excel';
  if (isCsv(file)) return 'csv';
  if (isParquet(file)) return 'parquet';

  throw new Error(`Unsupported file type: ${file}`);
};

// TODO this will need props when it becomes a button that can be used
// on the team page as well as the user's files page
export default function CreateFileButton() {
  const [open, onOpenChange] = useState<boolean>(false);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const submit = useSubmit();
  const { uuid } = useParams();
  const actionUrl = uuid ? ROUTES.CREATE_FILE_IN_TEAM(uuid) : ROUTES.CREATE_FILE;

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    // If nothing was selected, just exit
    if (!e.target.files) return;

    try {
      // Get the file and it's contents
      const file: File = e.target.files[0];
      let data;

      switch (getFileType(file)) {
        case 'grid':
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
          const importedFile = await importExcel(file, addGlobalSnackbar);

          if (importedFile) {
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

  const DropDownButton = (props: { extension: string }): JSX.Element => {
    let { extension } = props;

    return (
      <DropdownMenuItem
        asChild
        onSelect={(e) => {
          // We have to prevent this (and handle the `open` state manually)
          // or the file input's onChange handler won't work properly
          e.preventDefault();
        }}
      >
        <label className="cursor-pointer">
          Import <span className="mx-1 font-mono">.{extension}</span> file
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
    <div className="flex">
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="mr-2 flex items-center gap-2 pl-2 pr-2">
            <label className="cursor-pointer">Import file</label>
            <CaretDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropDownButton extension="grid" />
          <DropDownButton extension="xlsx" />
        </DropdownMenuContent>
      </DropdownMenu>
      <Button asChild>
        <Link to={actionUrl}>Create file</Link>
      </Button>
    </div>
  );
}
