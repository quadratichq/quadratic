import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Step,
  StepButton,
  Stepper,
  TextField,
} from '@mui/material';

export const AddConnection = (props: { show: boolean; setShow: (show: boolean) => void }) => {
  return (
    <Dialog open={props.show}>
      <DialogTitle>Add Connection</DialogTitle>
      <DialogContent>
        <Stepper nonLinear activeStep={0}>
          <Step key={0} completed={false}>
            <StepButton color="inherit">"Add Credentials"</StepButton>
          </Step>
          <Step key={1} completed={false}>
            <StepButton color="inherit">"Test Connection"</StepButton>
          </Step>
        </Stepper>
        <TextField id="outlined-basic" label="Name" variant="outlined" />
        <TextField id="outlined-basic" label="Host" variant="outlined" />
        <TextField id="outlined-basic" label="Port" variant="outlined" />
        <TextField id="outlined-basic" label="User" variant="outlined" />
        <TextField id="outlined-basic" label="Password" variant="outlined" />
        <TextField id="outlined-basic" label="Database" variant="outlined" />

        <TextField id="outlined-basic" label="Server CA" variant="outlined" />
        <TextField id="outlined-basic" label="Client Cert" variant="outlined" />
        <TextField id="outlined-basic" label="Client Key" variant="outlined" />
        <FormControlLabel control={<Checkbox />} label="Connect via SSH Tunnel" />
        <DialogActions>
          <Button autoFocus>Test Connection</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};
