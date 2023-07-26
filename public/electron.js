const path = require('path');
const url = require('url');

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
require('update-electron-app')();

let editorHasUnsavedChanges = false;

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 600,
    height: 600,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 10 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // maximize when first opened
  win.maximize();

  // and load the index.html of the app.
  // win.loadFile("index.html");
  const startUrl = !app.isPackaged
    ? 'http://localhost:3000'
    : url.format({
        pathname: path.join(__dirname, '../build/index.html'),
        protocol: 'file',
        slashes: true,
      });
  win.loadURL(startUrl);

  win.webContents.on('will-prevent-unload', (event) => {
    if (!editorHasUnsavedChanges) return;
    const options = {
      type: 'question',
      buttons: ['Cancel', 'Leave'],
      message: 'Leave Site?',
      detail: 'Changes that you made may not be saved.',
    };
    const response = dialog.showMessageBoxSync(null, options);
    if (response === 1) event.preventDefault();
  });

  // Open the DevTools.
  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Command to maximize the window from app
ipcMain.on('maximize-current-window', (event) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);

  // Toggle maximize
  if (!win.isMaximized()) {
    win.maximize();
  } else {
    win.unmaximize();
  }
});

ipcMain.on('has-unsaved-changes', (_, hasUnsavedChanges) => {
  editorHasUnsavedChanges = hasUnsavedChanges;
});
