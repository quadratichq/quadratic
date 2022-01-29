import React from "react";
import {
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Card,
  CardContent,
} from "@mui/material";
import TextField from "@mui/material/TextField";
import { useNavigate } from "react-router-dom";

import "./styles.css";

const CELL_TYPE_OPTIONS = [
  {
    key: 0,
    name: "Text",
    short: "Aa",
    slug: "text",
    description: "Input any text or numerical data.",
    disabled: false,
  },
  {
    key: 10,
    name: "Formula",
    short: "=",
    slug: "formula",
    description: "Familiar Excel-like formulas.",
    disabled: true,
  },
  {
    key: 20,
    name: "Python",
    short: "Py",
    slug: "python",
    description: "Write Python to quickly compute with data.",
    disabled: false,
  },
  {
    key: 30,
    name: "JavaScript",
    short: "Js",
    slug: "javascript",
    description: "Write JavaScript to quickly compute with data.",
    disabled: true,
  },
  {
    key: 40,
    name: "SQL Query",
    short: "DB",
    slug: "sql",
    description: "Query your data using SQL.",
    disabled: true,
  },
];

export default function CellTypeMenu() {
  let navigate = useNavigate();
  const [value, setValue] = React.useState<string>("");
  const [selected_value, setSelectedValue] = React.useState<string | undefined>(
    "text"
  );
  const [filtered_cell_type_list, setFilteredCellTypeList] =
    React.useState<any>(CELL_TYPE_OPTIONS);

  const update_filter = (value: string) => {
    const filtered_cell_type_list = CELL_TYPE_OPTIONS.filter((cell_type) => {
      return cell_type.slug.includes(value.toLowerCase());
    });

    const selected_value = filtered_cell_type_list[0]?.slug;

    setSelectedValue(selected_value);
    setFilteredCellTypeList(filtered_cell_type_list);
    setValue(value);
  };

  return (
    <Card elevation={1} className="container">
      <CardContent>
        <TextField
          value={value}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            update_filter(event.target.value);
          }}
          onKeyUp={(event) => {
            if (event.key === "Escape") {
              navigate(-1);
            }
            if (event.key === "Enter") {
              navigate("/code-editor");
            }
          }}
          fullWidth
          variant="standard"
          label="Select Cell Type"
          autoFocus
        />
        <List dense={true} style={{ height: 350, width: 300 }}>
          <ListItem></ListItem>
          <Divider variant="fullWidth" />
          {filtered_cell_type_list.map((e: any) => {
            return (
              <ListItemButton
                key={e.key}
                selected={selected_value === e.slug}
                disabled={e.disabled}
                style={{ width: "100%" }}
              >
                <ListItemIcon>
                  <Typography>{e.short}</Typography>
                </ListItemIcon>
                <ListItemText primary={e.name} secondary={e.description} />
              </ListItemButton>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
}
