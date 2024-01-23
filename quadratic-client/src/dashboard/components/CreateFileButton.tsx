import { Button } from '@/shadcn/ui/button';
import * as React from 'react';
import { Link, useSubmit } from 'react-router-dom';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { ROUTES } from '../../constants/routes';
import { validateAndUpgradeGridFile } from '../../schemas/validateAndUpgradeGridFile';

export const useInitGridImportJs = () => {
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const submit = useSubmit();

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // If nothing was selected, just exit
    if (!e.target.files) {
      return;
    }

    // Get the file and it's contents
    const file: File = e.target.files[0];
    const contents = await file.text().catch((e) => null);

    // check file extension
    const extension = file.name?.split('.')?.pop() ?? "unknown";
    if (extension !== "grid") {
      const message = `Whoops! Unsupported file format '.${extension}'. Please pick a file with a '.grid' extension. 😊`
      addGlobalSnackbar(message, { severity: 'warning' });
      return;
    }

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
    submit(data, { method: 'POST', action: ROUTES.CREATE_FILE, encType: 'application/json' });
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.name = 'content';
  input.accept = '.grid';
  input.onchange = handleImport as any;

  return (e: React.MouseEvent<HTMLElement>) => {
    input.click();
    e.preventDefault()
  };
}

// TODO this will need props when it becomes a button that can be used
// on the team page as well as the user's files page
export default function CreateFileButton() {
  const importGrid = useInitGridImportJs();

  return (
    <div className="flex gap-2">
      <Button onClick={importGrid} asChild variant="outline">
        <label className="cursor-pointer">
          Import file
        </label>
      </Button>
      <Button asChild>
        <Link to={ROUTES.CREATE_FILE}>Create file</Link>
      </Button>
    </div >
  );
}
