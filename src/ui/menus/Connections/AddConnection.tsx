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
            {connectionSchema?.connectionFields.map((field) => {
              return (
                <TextField
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
                query: `DO $$ 
                DECLARE 
                    has_write_permission BOOLEAN := FALSE; 
                BEGIN 
                
                -- Check database-level
                IF EXISTS (
                    SELECT 1
                    FROM pg_database 
                    WHERE pg_has_database_privilege(datname, 'CREATE') 
                ) THEN 
                    has_write_permission := TRUE; 
                END IF;
                
                -- Check schema-level
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.schemata 
                    WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
                    AND ( 
                        has_schema_privilege(schema_name, 'CREATE') OR 
                        has_schema_privilege(schema_name, 'USAGE') 
                    )
                ) THEN 
                    has_write_permission := TRUE; 
                END IF;
                
                -- Check table-level
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                    AND (
                        has_table_privilege(table_name, 'INSERT') OR 
                        has_table_privilege(table_name, 'UPDATE') OR 
                        has_table_privilege(table_name, 'DELETE')
                    )
                ) THEN 
                    has_write_permission := TRUE; 
                END IF;
                
                -- Check sequences (for serial columns, etc.)
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.sequences
                    WHERE sequence_schema NOT IN ('pg_catalog', 'information_schema')
                    AND has_sequence_privilege(sequence_name, 'USAGE')
                ) THEN 
                    has_write_permission := TRUE; 
                END IF;
                
                -- Output the result
                RAISE NOTICE 'User has write permissions: %', has_write_permission;
                
                END $$ LANGUAGE plpgsql;
                `,
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
