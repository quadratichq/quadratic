import { Button } from '@/shadcn/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shadcn/ui/dropdown-menu';
import { CaretDownIcon } from '@radix-ui/react-icons';
import { ChangeEvent, useState } from 'react';
import { Link, useParams, useSubmit } from 'react-router-dom';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { ROUTES } from '../../constants/routes';
import { validateAndUpgradeGridFile } from '../../schemas/validateAndUpgradeGridFile';

// TODO this will need props when it becomes a button that can be used
// on the team page as well as the user's files page
export default function CreateFileButton() {
  const [open, onOpenChange] = useState<boolean>(false);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const submit = useSubmit();
  const { uuid } = useParams();
  const actionUrl = uuid ? ROUTES.CREATE_FILE_IN_TEAM(uuid) : ROUTES.CREATE_FILE;

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    console.log('handleImport');
    // If nothing was selected, just exit
    if (!e.target.files) {
      return;
    }

    // Get the file and it's contents
    const file: File = e.target.files[0];
    const contents = await file.text().catch((e) => null);

    // Ensure it's a valid Quadratic grid file
    const validFile = await validateAndUpgradeGridFile(contents);
    if (!validFile) {
      addGlobalSnackbar('Import failed: invalid `.grid` file.', { severity: 'error' });
      return;
    }

    // Upload it
    const data = {
      name: file.name ? file.name.replace('.grid', '') : 'Untitled',
      version: validFile.version,
      contents: validFile.version === '1.3' ? JSON.stringify(validFile) : validFile.contents,
    };
    submit(data, { method: 'POST', action: actionUrl, encType: 'application/json' });

    // Reset the input so we can add the same file
    e.target.value = '';
  };

  return (
    <div className="flex">
      <Button asChild className={' rounded-r-none '}>
        <Link to={actionUrl}>Create file</Link>
      </Button>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button className={'rounded-l-none border-l-0 px-2'}>
            <CaretDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            asChild
            onSelect={(e) => {
              // We have to prevent this (and handle the `open` state manually)
              // or the file input's onChange handler won't work properly
              e.preventDefault();
            }}
          >
            <label className="cursor-pointer">
              Import <span className="mx-1 font-mono">.grid</span> file
              <input
                type="file"
                name="content"
                accept=".grid"
                onChange={(e) => {
                  onOpenChange(false);
                  handleImport(e);
                }}
                hidden
              />
            </label>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
