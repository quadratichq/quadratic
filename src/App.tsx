import './styles.css';
import { QuadraticApp } from './quadratic/QuadraticApp';
import { RecoilRoot } from 'recoil';
import { Link, LoaderFunctionArgs, useLoaderData } from 'react-router-dom';
import { GridFile } from './schemas';
import Empty from './dashboard/Empty';
import { QuestionMarkOutlined } from '@mui/icons-material';
import { Button } from '@mui/material';
import { v4 as uuid } from 'uuid';

type LoaderData = {
  file: GridFile;
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  // const { id } = params;
  const file: GridFile = await fetch('/examples/default.grid')
    .then((res) => {
      if (!res.ok) {
        throw new Error('Failed to fetch');
      }
      return res.json();
    })
    .then((file) => {
      return {
        ...file,
        filename: 'Deafult (example)',
        id: uuid(),
        modified: Date.now(),
      };
    });
  return { file };
};

export const Component = () => {
  const { file } = useLoaderData() as LoaderData;

  return (
    <RecoilRoot>
      <QuadraticApp file={file} />
    </RecoilRoot>
  );
};

// TODO catch 404, don't have permission for file, generic error
export const ErrorBoundary = () => {
  return (
    <div>
      <Empty
        title="File not found"
        description="This file may have been deleted, moved, or made unavailable. Try reaching out to the file owner."
        Icon={QuestionMarkOutlined}
        actions={
          <Button variant="contained" disableElevation component={Link} to="/">
            Go home
          </Button>
        }
      />
    </div>
  );
};
