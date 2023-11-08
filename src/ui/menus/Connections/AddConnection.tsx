import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Step,
  StepButton,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { ConnectionConfiguration } from '../../../../quadratic-api/src/routes/connections/types/Base'; // TODO: fix this path
import { apiClient } from '../../../api/apiClient';
import { ApiTypes } from '../../../api/types';

export const AddConnection = (props: { show: boolean; setShow: (show: boolean) => void }) => {
  const [connectionSchema, setConnectionSchema] = useState<undefined | ConnectionConfiguration>(undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState<{ [key: string]: string }>({} as ApiTypes['/v0/connections.POST.request']);

  useEffect(() => {
    apiClient.getSupportedConnections().then((result) => {
      console.log('supported connections:', result);
      setConnectionSchema(result[0]);
    });
  }, []);

  console.log('connectionSchema:', connectionSchema);

  const handleInputChange = (name: string, value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  return (
    <Dialog open={props.show}>
      <DialogTitle>Add Connection | {connectionSchema?.name}</DialogTitle>
      <DialogContent>
        <Stepper nonLinear activeStep={0}>
          <Step key={0} completed={false}>
            <StepButton color="inherit">"Add Credentials"</StepButton>
          </Step>
          <Step key={1} completed={false}>
            <StepButton color="inherit">"Test Connection"</StepButton>
          </Step>
        </Stepper>
        <Typography>{connectionSchema?.description}</Typography>
        <form
          ref={formRef}
          onSubmit={(form) => {
            form.preventDefault();

            console.log(form);
          }}
        >
          <Box
            sx={{
              '& .MuiTextField-root': { m: 1, width: '25ch' },
            }}
          >
            <TextField
              id="connectionName"
              label="Connection Name"
              value={formData['name'] || ''} // Use the formData value
              onChange={(e) => handleInputChange('name', e.target.value)}
              required={true}
              inputProps={{ 'aria-autocomplete': 'none' }}
              InputLabelProps={{ style: { textTransform: 'capitalize' } }}
              variant="outlined"
              type="text"
            />
            {connectionSchema?.connectionFields.map((field, index) => {
              return (
                <TextField
                  key={index}
                  id={field.name}
                  label={field.name}
                  value={formData[field.name] || ''} // Use the formData value
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  required={field.required}
                  inputProps={{ autocomplete: 'off', readonly: 'true' }}
                  InputLabelProps={{ style: { textTransform: 'capitalize' } }}
                  variant="outlined"
                  onFocus={(a) => {
                    a.currentTarget.removeAttribute('readonly');
                  }}
                  type={field.sensitive === 'AWS_SECRET' ? 'password' : 'text'}
                />
              );
            })}
          </Box>
          <Button
            onClick={async () => {
              const response = await apiClient.createConnection(formData as ApiTypes['/v0/connections.POST.request']); // TODO: typecasting here is unsafe

              console.log('response:', response);

              const data = await apiClient.runConnection(response.uuid, {
                query: `SELECT 
                datname AS database_name,
                pg_get_userbyid(datdba) AS owner,
                pg_database.datistemplate,
                pg_database.datallowconn,
                datacl
            FROM 
                pg_database 
            LEFT JOIN 
                pg_namespace ON datname = nspname;`,
              });

              console.log('data:', data);
            }}
          >
            Create Connection
          </Button>
        </form>
        <DialogActions></DialogActions>
      </DialogContent>
    </Dialog>
  );
};
