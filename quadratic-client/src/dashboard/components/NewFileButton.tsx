import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { fileDragDropModalAtom } from '@/dashboard/atoms/fileDragDropModalAtom';
import { newFileDialogAtom } from '@/dashboard/atoms/newFileDialogAtom';
import { ApiIcon, ArrowDropDownIcon, CsvIcon, DatabaseIcon, DraftIcon, ExamplesIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/shadcn/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { cn } from '@/shared/shadcn/utils';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import './api-grid.css';

export default function NewFileButton({ isPrivate }: { isPrivate: boolean }) {
  const setNewFileDialogState = useSetRecoilState(newFileDialogAtom);
  const setFileDragDropState = useSetRecoilState(fileDragDropModalAtom);

  return (
    <div className="flex gap-2">
      <Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default">
              New file from… <ArrowDropDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <DraftIcon className="mr-3 h-6 w-6 text-primary" />
              <span className="flex flex-col">
                Blank
                <span className="text-xs text-muted-foreground">An empty spreadsheet</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFileDragDropState({ show: true, isPrivate })}>
              <CsvIcon className="mr-3 h-6 w-6 text-primary" />

              <span className="flex flex-col">
                Imported data
                <span className="text-xs text-muted-foreground">.csv, .xlsx, .pqt, .grid files</span>
              </span>
            </DropdownMenuItem>
            <DialogTrigger asChild>
              <DropdownMenuItem>
                <ApiIcon className="mr-3 h-6 w-6 text-primary" />

                <span className="flex flex-col">
                  API data
                  <span className="text-xs text-muted-foreground">HTTP requests from code</span>
                </span>
              </DropdownMenuItem>
            </DialogTrigger>

            <DropdownMenuItem asChild>
              <Link to="/examples" className="flex items-center">
                <ExamplesIcon className="mr-3 h-6 w-6 text-primary" />

                <span className="flex flex-col">
                  Example data
                  <span className="text-xs text-muted-foreground">Research, analysis, and modeling demos</span>
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LanguageIcon language="POSTGRES" style={{ width: '20px', height: '20px' }} className="mr-3 h-6 w-6" />
              <span className="flex flex-col">
                Quadratic (production)
                <span className="text-xs text-muted-foreground">Postgres connection</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LanguageIcon language="MYSQL" style={{ width: '20px', height: '20px' }} className="mr-3 h-6 w-6" />
              <span className="flex flex-col">
                Customer data
                <span className="text-xs text-muted-foreground">MySQL connection</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="">
              <DatabaseIcon className="mr-3 h-6 w-6 text-muted-foreground" /> See all connections...
            </DropdownMenuItem>
          </DropdownMenuContent>
          <DialogContentNewFileFromApi />
        </DropdownMenu>
      </Dialog>
      <Button
        className="hidden"
        onClick={() => {
          setNewFileDialogState({ show: true, isPrivate });
        }}
      >
        New file
      </Button>
    </div>
  );
}

function DialogContentNewFileFromApi({ children }: any) {
  const [isLoading, setIsLoading] = useState(false);
  const [json, setJson] = useState({
    id: 'R7UfaahVfFd',
    joke: 'My dog used to chase people on a bike a lot. It got so bad I had to take his bike away.',
    status: 200,
  });
  const [url, setUrl] = useState('https://icanhazdadjoke.com');
  const [activeLanguage, setActiveLanguage] = useState('Javascript');

  // TODO: needs better error handling

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setIsLoading(true);
    fetch(url, { headers: { Accept: 'application/json' } })
      .then((res) => res.json())
      .then((newJson) => {
        setJson(newJson);
        setIsLoading(false);
      });
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Fetch data from an API</DialogTitle>
        <DialogDescription>
          Example showing how to fetch data and put it on a spreadsheet. Create a file then you can tweak the code any
          way you want including custom headers, authentication, and more.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <form className="flex items-center justify-between gap-8 rounded-lg text-sm" onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 self-stretch rounded-md bg-accent p-0.5">
            {['Python', 'Javascript'].map((language) => (
              <Label
                onClick={() => setActiveLanguage(language)}
                className={`flex items-center gap-1 self-stretch rounded ${
                  activeLanguage === language ? 'bg-background shadow-sm' : ''
                } px-2`}
              >
                <LanguageIcon language={language} sx={{ fontSize: '20px' }} />
                {language}
              </Label>
            ))}
          </div>
          <div className="flex flex-grow gap-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={isLoading}>
              GET
            </Button>
          </div>
        </form>

        <div className="border-l border-r border-t border-border p-3">
          <pre className="text-xs">
            {activeLanguage === 'Javascript'
              ? `const res = await fetch(
  "${url}",
  { headers: { Accept: 'application/json' }
});
const json = await res.json();
return [
  Object.keys(json),
  Object.values(json),
];`
              : `import requests
import pandas as pd
response = requests.get('${url}')
df = pd.DataFrame(response.json())
df
`}
          </pre>
        </div>
      </div>
      <div className="-mt-8 overflow-hidden text-sm">
        <table className="mt-4 w-full max-w-full table-auto border-separate border-spacing-0 border-l border-t border-gray-200 border-b-transparent border-r-transparent">
          <thead>
            <tr>
              <TD as="th" isFirstCol={true}></TD>
              <TD as="th">A</TD>
              <TD as="th">B</TD>
              <TD as="th">C</TD>
              <TD as="th">D</TD>
              <TD as="th">E</TD>
              <TD as="th">F</TD>
              <th>G</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <TD isFirstCol>1</TD>
              {Object.keys(json).map((key) => (
                <TD className="font-bold">{key}</TD>
              ))}
              <TD></TD>
              <TD></TD>
              <TD></TD>
            </tr>
            <tr>
              <TD isFirstCol>2</TD>
              {Object.values(json).map((value) => (
                <TD>{typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value)}</TD>
              ))}
              <TD></TD>
              <TD></TD>
              <TD></TD>
            </tr>
            <tr>
              <TD isFirstCol>3</TD>
              <TD></TD>
              <TD></TD>
              <TD></TD>
              <TD></TD>
              <TD></TD>
              <TD></TD>
            </tr>
          </tbody>
        </table>
      </div>
      <DialogFooter>
        <DialogClose>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button>Start file with API request</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function TD({
  children,
  as = 'td',
  isFirstCol = false,
  className,
}: {
  children?: React.ReactNode;
  as?: 'td' | 'th';
  isFirstCol?: boolean;
  className?: string;
}) {
  const Component = as;

  return (
    <Component
      className={cn(
        'h-[20px] overflow-hidden whitespace-nowrap border-b border-r border-gray-200 leading-[20px]',
        className,
        isFirstCol
          ? 'w-[30px] min-w-[30px] max-w-[30px] text-center text-xs font-medium text-muted-foreground'
          : 'w-[100px] min-w-[100px] max-w-[100px]',
        as === 'th' ? 'text-xs font-medium text-muted-foreground' : ''
      )}
    >
      {children}
    </Component>
  );
}
