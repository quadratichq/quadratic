import { ButtonBase } from '@mui/material';
import { EXAMPLE_FILES } from 'constants/app';
import { Form } from 'react-router-dom';
import File from 'shared/dashboard/FileListItem';
import Header from 'shared/dashboard/Header';

export const Component = () => {
  return (
    <>
      <Header title="Examples" />
      {EXAMPLE_FILES.map(({ name, description, file }) => (
        <Form key={file} method="POST" action="/files/create">
          <input type="hidden" name="action" value="clone-example" />
          <input type="hidden" name="file" value={file} />
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="description" value={description} />
          <ButtonBase type="submit" sx={{ width: '100%', display: 'block' }} disableRipple>
            <File key={file} name={name} description={description} />
          </ButtonBase>
        </Form>
      ))}
    </>
  );
};
