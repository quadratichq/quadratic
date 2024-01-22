import { CLI } from "./cli.js";
import { Control } from "./control.js";
import { UI } from "./ui.js";

const cli = new CLI();
const control = new Control(cli);
const ui = new UI(cli, control);

control.start(ui);
