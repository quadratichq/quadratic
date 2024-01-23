import chalk from "chalk";
import { createScreen } from "./terminal.js";
const SPACE = "     ";
const DONE = chalk.green(" ✓");
const BROKEN = chalk.red(" ✗");
const WORKING_CHARACTERS = ["◐", "◓", "◑", "◒"];
const WATCH = chalk.gray(" 👀");
const ANIMATION_INTERVAL = 100;
const COMPONENTS = {
    client: { color: "magenta", name: "React", shortcut: "r" },
    api: { color: "blue", name: "API", shortcut: "a" },
    core: { color: "cyan", name: "Core", shortcut: "c" },
    multiplayer: { color: "green", name: "Multiplayer", shortcut: "m" },
    files: { color: "yellow", name: "Files", shortcut: "f" },
    types: { color: "magenta", name: "Types", shortcut: "t" },
    db: { color: "gray", name: "Database", shortcut: "d" },
    npm: { color: "gray", name: "npm install", shortcut: "n" },
    rust: { color: "gray", name: "rustup upgrade", shortcut: "r" },
};
export class UI {
    cli;
    control;
    spin = 0;
    showing = 0;
    help = false;
    constructor(cli, control) {
        this.cli = cli;
        this.control = control;
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (key) => {
            switch (key.toString()) {
                case "q":
                    control.quit();
                    break;
                case "\u0003":
                    control.quit();
                    break; // ctrl + x
                case "h": // help
                    this.showHelp();
                    break;
                case "t": // toggle types
                    control.restartTypes();
                    break;
                case "c": // toggle core
                    control.restartCore();
                    break;
                case "m": // toggle multiplayer
                    control.restartMultiplayer();
                    break;
                case "f": // toggle files
                    control.restartFiles();
                    break;
                case "p":
                    control.togglePerf();
                    break;
                case "a": // toggle API
                    control.restartApi();
                    break;
            }
        });
        setInterval(() => {
            this.spin = (this.spin + 1) % WORKING_CHARACTERS.length;
            if (this.showing) {
                this.clear();
                this.prompt();
            }
        }, ANIMATION_INTERVAL);
        createScreen();
    }
    clear() {
        if (this.showing) {
            const width = process.stdout.getWindowSize()[0];
            const lines = Math.floor(this.showing / width);
            for (let i = 0; i < Math.max(lines, 1); i++) {
                process.stdout.clearLine(0);
                process.stdout.moveCursor(0, -1);
            }
            process.stdout.cursorTo(0);
            this.showing = 0;
        }
    }
    write(text, color) {
        process.stdout.write(color ? chalk[color](text) : text);
        return text.length;
    }
    statusItem(component, alwaysWatch) {
        let status = "";
        if (this.control.status[component] === "x") {
            status = BROKEN + SPACE;
        }
        else if (!this.control.status[component]) {
            status = chalk.gray(" " + WORKING_CHARACTERS[this.spin]) + SPACE;
        }
        else if (this.cli.options[component] || alwaysWatch) {
            status = WATCH + SPACE;
        }
        else {
            status = DONE + SPACE;
        }
        const error = this.control.status[component] === "x";
        const { name, color } = COMPONENTS[component];
        return this.write(name + status, error ? "red" : color);
    }
    print(component, text = "starting...") {
        this.clear();
        const { name, color } = COMPONENTS[component];
        process.stdout.write(`[${chalk[color](name)}] ${text}\n`);
        this.prompt();
    }
    prompt() {
        this.clear();
        this.write("\n");
        let characters = this.write("Quadratic Dev", "underline") +
            this.write(SPACE) +
            this.statusItem("client", true) +
            this.statusItem("api") +
            this.statusItem("core") +
            this.statusItem("multiplayer") +
            this.statusItem("files") +
            this.statusItem("types") +
            this.statusItem("npm") +
            this.statusItem("db") +
            this.statusItem("rust");
        if (this.help) {
            this.write("\n");
            characters += process.stdout.getWindowSize()[0] - 1;
            characters += this.write("(press t to toggle types | c to (un)watch core | a to (un)watch API | m to (un)watch multiplayer | f to (un)watch files | p to toggle perf for core | h to toggle help | q to quit)");
        }
        else {
            characters += this.write(` (press h for help | q to quit)`);
        }
        this.showing = characters;
    }
    printOutput(name, callback) {
        const command = this.control[name];
        const { color, hide } = COMPONENTS[name];
        command.stdout.on("data", (data) => {
            if (hide) {
                if (callback) {
                    callback(data);
                }
            }
            else {
                this.clear();
                process.stdout.write(`[${chalk[color](name)}] ${chalk[color](data)}`);
                this.prompt();
                if (callback) {
                    this.clear();
                    callback(data);
                    this.prompt();
                }
            }
        });
        command.stderr.on("data", (data) => {
            if (hide) {
                if (callback) {
                    callback(data);
                }
            }
            else {
                this.clear();
                process.stdout.write(`[${chalk[color](name)}] ${chalk.red(data)}`);
                this.prompt();
                if (callback) {
                    this.clear();
                    callback(data);
                    this.prompt();
                }
            }
        });
    }
    showHelp() {
        this.help = !this.help;
        this.clear();
        this.prompt();
    }
}
