import {
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Card,
  Typography,
  CardContent,
} from "@mui/material";

import "./styles.css";

export function CellTypeSelector() {
  return (
    <Card elevation={1} className="container">
      {/* <CardHeader title="Select Cell Type"></CardHeader> */}
      <CardContent>
        <List dense={true}>
          <ListItem>
            <ListItemText primary="Select Cell Type" />
          </ListItem>
          <Divider variant="fullWidth" />
          <ListItemButton>
            <ListItemIcon>
              <Typography>Aa</Typography>
            </ListItemIcon>
            <ListItemText
              primary="Text"
              secondary="Start typing for plain text."
            />
          </ListItemButton>
          <ListItemButton disabled>
            <ListItemIcon>
              <Typography>=</Typography>
            </ListItemIcon>
            <ListItemText
              primary="Formula"
              secondary="Familiar Excel-like formulas."
            />
          </ListItemButton>
          <ListItemButton>
            <ListItemIcon>
              <Typography>PY</Typography>
            </ListItemIcon>
            <ListItemText
              primary="Python"
              secondary="Write Python to quickly compute with data."
            />
          </ListItemButton>
          <ListItemButton disabled>
            <ListItemIcon>
              <Typography>JS</Typography>
            </ListItemIcon>
            <ListItemText
              primary="JavaScript"
              secondary="Write JavaScript to quickly compute with data."
            />
          </ListItemButton>
          <ListItemButton disabled>
            <ListItemIcon>
              <Typography>DB</Typography>
            </ListItemIcon>
            <ListItemText
              primary="SQL Query"
              secondary="Query your data using SQL."
            />
          </ListItemButton>
        </List>
      </CardContent>
    </Card>
  );
}
