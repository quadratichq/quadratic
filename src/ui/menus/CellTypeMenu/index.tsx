import { Component } from "react";
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

import "./styles.css";

interface CellTypeMenuState {
  visible: boolean;
  value: string;
  selected_value: string | undefined;
  filtered_cell_type_list: any;
}

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

class CellTypeMenu extends Component<{}, CellTypeMenuState> {
  constructor(props: any) {
    super(props);
    // Don't call this.setState() here!
    this.state = {
      visible: false,
      value: "",
      selected_value: "text",
      filtered_cell_type_list: CELL_TYPE_OPTIONS,
    };
  }

  open() {
    this.setState({ visible: true, value: "", selected_value: "text" });
  }

  get_value() {
    return this.state.value;
  }

  update_filter(value: string) {
    const filtered_cell_type_list = CELL_TYPE_OPTIONS.filter((cell_type) => {
      return cell_type.slug.includes(value.toLowerCase());
    });

    const selected_value = filtered_cell_type_list[0]?.slug;

    this.setState({ selected_value, filtered_cell_type_list, value });
  }

  render() {
    if (!this.state.visible) {
      return null;
    }

    return (
      <Card elevation={1} className="container">
        <CardContent>
          <TextField
            value={this.state.value}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              this.update_filter(event.target.value);
            }}
            onKeyUp={(event) => {
              if (event.key === "Escape") {
                this.setState({ visible: false });
              }
              if (event.key === "Enter") {
                this.setState({ visible: false });
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
            {this.state.filtered_cell_type_list.map((e: any) => {
              return (
                <ListItemButton
                  key={e.key}
                  selected={this.state.selected_value === e.slug}
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
}

export default CellTypeMenu;
