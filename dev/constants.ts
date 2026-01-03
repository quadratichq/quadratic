export const COMPONENTS = {
  client: { color: "magenta", dark: "cyan", name: "React", shortcut: "r" },
  api: { color: "blue", dark: "white", name: "API", shortcut: "a" },
  core: { color: "cyan", dark: "cyan", name: "Core", shortcut: "c" },
  rustRenderer: {
    color: "yellowBright",
    dark: "yellowBright",
    name: "RustRenderer",
    shortcut: "e",
  },
  rustLayout: {
    color: "yellow",
    dark: "yellow",
    name: "RustLayout",
    shortcut: "e", // same shortcut as rustRenderer - controlled together (hidden from UI)
    hide: true, // hidden from status bar - combined with rustRenderer in UI
  },
  rustClient: {
    color: "cyanBright",
    dark: "cyanBright",
    name: "RustClient",
    shortcut: "i",
  },
  multiplayer: {
    color: "green",
    dark: "green",
    name: "Multiplayer",
    shortcut: "m",
  },
  files: { color: "yellow", dark: "yellow", name: "Files", shortcut: "f" },
  connection: {
    color: "blue",
    dark: "blue",
    name: "Connection",
    shortcut: "n",
  },
  python: {
    color: "blueBright",
    dark: "blueBright",
    name: "Python",
    shortcut: "y",
  },
  types: { color: "magenta", dark: "cyan", name: "Types", shortcut: "t" },
  db: {
    color: "gray",
    dark: "gray",
    name: "Database",
    shortcut: "d",
    hide: true,
  },
  npm: {
    color: "gray",
    dark: "gray",
    name: "npm install",
    shortcut: "n",
    hide: true,
  },
  rust: {
    color: "gray",
    dark: "gray",
    name: "rustup upgrade",
    shortcut: "r",
    hide: true,
  },
  postgres: {
    color: "gray",
    dark: "gray",
    name: "Postgres",
  },
  redis: {
    color: "gray",
    dark: "gray",
    name: "Redis",
  },
  shared: {
    color: "gray",
    dark: "gray",
    shortcut: "s",
    name: "Shared",
  },
  cloudController: {
    color: "magentaBright",
    dark: "magentaBright",
    name: "CloudController",
    shortcut: "o",
  },
};

export const SPACE = "     ";
export const DONE = "✓";
export const BROKEN = "✗";
export const KILLED = "☠";
export const ANIMATE_STATUS = ["◐", "◓", "◑", "◒"];
export const WATCH = "👀";
export const NO_LOGS = "🙈"; // AI picked this awesome character
export const PERF = "🚀";
export const FUNCTION_TIMER = "🕒";

export const ANIMATION_INTERVAL = 100;
