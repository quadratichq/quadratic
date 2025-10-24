import chalk from "chalk";
import { ANIMATE_STATUS, ANIMATION_INTERVAL, BROKEN, COMPONENTS, DONE, FUNCTION_TIMER, KILLED, NO_LOGS, PERF, SPACE, WATCH, } from "./constants.js";
import { helpCLI, helpKeyboard } from "./help.js";
import { logo } from "./logo.js";
export class UI {
    cli;
    control;
    spin = 0;
    help = false;
    // keep track of cursor when drawing the menu
    showing = false;
    characters = 0;
    lines = 0;
    interval;
    constructor(cli, control) {
        this.cli = cli;
        this.control = control;
        console.log(logo);
        this.interval = setInterval(() => {
            this.spin = (this.spin + 1) % ANIMATE_STATUS.length;
            if (this.showing) {
                this.clear();
                this.prompt();
            }
        }, ANIMATION_INTERVAL);
    }
    quit() {
        this.clear();
        clearInterval(this.interval);
        process.stdin.pause();
    }
    clear() {
        if (this.showing) {
            // reset the current line
            process.stdout.clearLine(0);
            this.characters = 0;
            for (let i = 0; i < this.lines; i++) {
                process.stdout.moveCursor(0, -1);
                process.stdout.clearLine(0);
            }
            this.lines = 0;
            // move cursor to start of line
            process.stdout.cursorTo(0);
            this.showing = false;
        }
    }
    writeWarning(text, highlight) {
        if (highlight) {
            process.stdout.write(chalk.yellow.bgRed(text));
        }
        else {
            process.stdout.write(chalk.red(text));
        }
        this.trackPromptTextSize(text);
    }
    write(text, color, underline) {
        if (underline) {
            process.stdout.write(color ? chalk[color].underline(text) : chalk.underline(text));
        }
        else {
            process.stdout.write(color ? chalk[color](text) : text);
        }
        this.trackPromptTextSize(text);
    }
    trackPromptTextSize(text) {
        const width = process.stdout.getWindowSize()[0];
        // keep track of the cursor and wraps to remove the menu bar when writing logs
        // use an array to turn utf8 characters into 1 character
        for (const char of [...text]) {
            if (char === "\n") {
                this.lines++;
                this.characters = 0;
            }
            else {
                this.characters++;
            }
            if (this.characters > width) {
                this.lines++;
                this.characters = 0;
            }
        }
    }
    statusItem(component) {
        const error = this.control.status[component] === "error";
        const { name, color, dark, shortcut } = COMPONENTS[component];
        const index = name.toLowerCase().indexOf(shortcut.toLowerCase());
        const writeColor = error ? "red" : this.cli.options.dark ? dark : color;
        this.write(name.substring(0, index), writeColor);
        this.write(name[index], writeColor, true);
        this.write(name.substring(index + 1), writeColor);
        if (this.getHideOption(component)) {
            this.write(" " + NO_LOGS);
        }
        if (this.control.status[component] === "error") {
            this.write(" " + BROKEN, "red");
        }
        else if (this.control.status[component] === "killed") {
            this.write(" " + KILLED);
        }
        else if (!this.control.status[component]) {
            this.write(" " + ANIMATE_STATUS[this.spin], "gray");
        }
        else if (this.cli.options[component]) {
            this.write(" " + WATCH, "gray");
        }
        else {
            this.write(" " + DONE, "green");
        }
        if (component === "core" && this.cli.options.perf) {
            this.write(PERF);
        }
        if (component === "core" && this.cli.options.functionTimer) {
            this.write(FUNCTION_TIMER);
        }
        this.write(SPACE);
    }
    print(component, text = "starting...", textColor) {
        if (this.getHideOption(component))
            return;
        this.clear();
        const { name, color, dark } = COMPONENTS[component];
        const displayColor = this.cli.options.dark ? dark : color;
        process.stdout.write(`[${chalk[displayColor](name)}] `);
        process.stdout.write(textColor ? chalk[textColor](text) : text);
        process.stdout.write("\n");
        this.prompt();
    }
    promptExternal() {
        const postgres = this.control.status.postgres;
        const redis = this.control.status.redis;
        if (postgres !== true || redis !== true) {
            let s = "\n\n ";
            if (postgres === "error") {
                s += "postgres is NOT running";
            }
            else if (postgres === "killed") {
                s += "pg_isready not found in path";
            }
            if (redis) {
                s += SPACE;
            }
            if (redis === "error") {
                s += "redis is NOT running";
            }
            else if (redis === "killed") {
                s += "redis-server not found in path";
            }
            this.writeWarning(s, postgres === "error" || redis === "error");
        }
    }
    prompt() {
        this.clear();
        this.write("\n");
        this.statusItem("client");
        this.statusItem("api");
        if (!this.cli.options.noRust) {
            this.statusItem("core");
        }
        this.statusItem("multiplayer");
        this.statusItem("files");
        this.statusItem("connection");
        this.statusItem("types");
        this.statusItem("python");
        this.statusItem("shared");
        if (this.help === "cli") {
            this.write(helpCLI);
        }
        else if (this.help) {
            this.write(helpKeyboard);
        }
        this.promptExternal();
        this.showing = true;
    }
    getHideOption(name) {
        if (name === "client")
            name = "react";
        if (name === "api")
            name = "API";
        const option = `hide${name[0].toUpperCase() + name.substring(1)}`;
        return !!this.cli.options[option];
    }
    printOutput(name, callback) {
        const command = this.control[name];
        const component = COMPONENTS[name];
        const color = this.cli.options.dark ? component.dark : component.color;
        const displayName = component.name;
        command.stdout.on("data", (data) => {
            const hide = COMPONENTS[name].hide || this.getHideOption(name);
            if (hide) {
                if (callback) {
                    callback(data);
                }
            }
            else {
                this.clear();
                process.stdout.write(`[${chalk[color](displayName)}] ${chalk[color](data)}`);
                this.prompt();
                if (callback) {
                    this.clear();
                    callback(data);
                    this.prompt();
                }
            }
        });
        command.stderr.on("data", (data) => {
            const hide = COMPONENTS[name].hide || this.getHideOption(name);
            if (hide) {
                if (callback) {
                    callback(data);
                }
            }
            else {
                this.clear();
                if (data.includes("[ESLint] Found 0 error and 0 warning") ||
                    data.includes("[TypeScript] Found 0 errors. Watching for file changes.")) {
                    process.stdout.write(`[${chalk[color](displayName)}] ${chalk[color](data)}`);
                }
                else {
                    let dataColor = this.cli.options.dark ? "white" : "red";
                    process.stdout.write(`[${chalk[color](displayName)}] ${chalk[dataColor](data)}`);
                }
                this.prompt();
                if (callback) {
                    this.clear();
                    callback(data);
                    this.prompt();
                }
            }
        });
    }
    showHelp(cli) {
        if (cli) {
            this.help = "cli";
        }
        else {
            this.help = !this.help;
        }
        this.clear();
        this.prompt();
    }
}
