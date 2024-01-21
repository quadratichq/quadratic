import chalk from "chalk";
import { Command } from "commander";
import killPortOriginal from "kill-port";
import { spawn } from "node:child_process";

const program = new Command();

const killPort = async (port) => {
  try {
    await killPortOriginal(port);
  } catch (e) {}
};

program
  .name("node dev")
  .description(
    "Runs the Quadratic dev server. By default, only React runs in watch mode."
  )
  .option("-p, --api", "Watch the quadratic-api directory")
  .option("-c, --core", "Watch the quadratic-core directory")
  .option("-m, --multiplayer", "Watch the quadratic-multiplayer directory")
  .option("-f, --files", "Watch the quadratic-files directory")
  .option("-s, --skipTypes", "Skip WASM types compilation")
  .option("-a, --all", "Watch all directories")
  .option(
    "-p, --perf",
    "Run quadratic-core in perf mode (slower linking but faster runtime)"
  )
  .showHelpAfterError();

program.parse();
const options = program.opts();

if (options.all) {
  options.api = true;
  options.core = true;
  options.multiplayer = true;
  options.files = true;
}

const printOutput = (command, name, color, callback) => {
  command.stdout.on("data", (data) => {
    process.stdout.write(`[${chalk[color](name)}] ${chalk[color](data)}`);
    if (callback) {
      callback(data);
    }
  });
  command.stderr.on("data", (data) =>
    process.stdout.write(`[${chalk[color](name)}] ${chalk.red(data)}`)
  );
};

const runClient = () => {
  const client = spawn("npm", ["start", "--workspace=quadratic-client"]);
  printOutput(client, "Client", "magenta");
};

const runTypes = async () => {
  return new Promise((resolve) => {
    if (!options.skipTypes) {
      const types = spawn("npm", ["run", "build:wasm:types"]);
      printOutput(types, "WASM Types", "magenta");
      types.on("exit", resolve);
    } else {
      resolve();
    }
  });
};

const runAPI = async () => {
  await killPort(8000);
  const api = spawn("npm", [
    "run",
    options.api ? "start" : "start-no-watch",
    "--workspace=quadratic-api",
  ]);
  printOutput(api, "API", "blue");
};

const runCore = () => {
  return new Promise((resolve) => {
    if (options.core) {
      const core = spawn("npm", [
        "run",
        options.perf ? "watch:wasm:perf:javascript" : "watch:wasm:javascript",
      ]);
      printOutput(core, "Core", "cyan", (data) => {
        if (data.toString() === "[Finished running. Exit status: 0]\n") {
          runClient();
          resolve();
        }
      });
    } else {
      const core = spawn("npm", [
        "run",
        options.perf ? "build:wasm:perf:javascript" : "build:wasm:javascript",
      ]);
      printOutput(core, "Core", "magenta");
      core.on("exit", () => {
        runClient();
        resolve();
      });
    }
  });
};

const runMultiplayer = () => {
  return new Promise(async (resolve) => {
    await killPort(3001);
    const multiplayer = spawn("npm", [
      "run",
      options.multiplayer ? "dev" : "start",
      "--workspace=quadratic-multiplayer",
    ]);
    printOutput(multiplayer, "Multiplayer", "green", (data) => {
      if (data.toString().includes("listening on")) {
        resolve();
      }
    });
  });
};

const runFiles = () => {
  return new Promise(async (resolve) => {
    killPort(3002);
    const files = spawn("npm", [
      "run",
      options.files ? "dev" : "start",
      "--workspace=quadratic-files",
    ]);
    printOutput(files, "Files", "yellow", (data) => {
      if (data.toString().includes("listening on")) {
        resolve();
      }
    });
  });
};

const startAsync = async () => {
  runAPI();
  await runTypes();
  await runCore();
  await runMultiplayer();
  await runFiles();
};

startAsync();
