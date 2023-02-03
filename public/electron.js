const path = require('path');

const { app, BrowserWindow, dialog, ipcMain, remote } = require('electron');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');
require('update-electron-app')();

// const server = 'https://quadratichq.com';
// const url = `${server}/update/${process.platform}/${app.getVersion()}`;
const CHECK_FOR_UPDATES_FROM_FEED_INTERVAL = // in milliseconds
  1000 * // milliseconds per second
  60 * // seconds per minute
  1; // check every 1 minutes

// autoUpdater.setFeedURL({ url });

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    icon: path.join(__dirname, 'favicon.ico'),
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
  win.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`);
  // Open the DevTools.
  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.once('ready-to-show', () => {
    win.webContents.executeJavaScript('console.log("checking for updates...")');
    autoUpdater.checkForUpdatesAndNotify();
  });

  setInterval(() => {
    win.webContents.executeJavaScript('console.log("checking for updates...")');
    autoUpdater.checkForUpdatesAndNotify();
  }, CHECK_FOR_UPDATES_FROM_FEED_INTERVAL);

  autoUpdater.on('update-available', (_event, releaseNotes, releaseName) => {
    win.webContents.executeJavaScript('console.log("update available...")');
    win.webContents.send('update_available', releaseNotes, releaseName);
  });

  autoUpdater.on('update-downloaded', (_event, releaseNotes, releaseName) => {
    win.webContents.executeJavaScript('console.log("update downloaded...")');
    win.webContents.send('update_downloaded', releaseNotes, releaseName);
  });

  autoUpdater.on('error', (message) => {
    console.error('There was a problem updating the application');
    console.error(message);
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
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

ipcMain.on('update_available', (event, releaseNotes, releaseName) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  win.webContents.executeJavaScript('console.log("prompting update availability...")');
  ipcMain.removeAllListeners('update_available');
  const dialogOpts = {
    type: 'info',
    buttons: ['Ok'],
    title: 'Application Update',
    message: process.platform === 'win32' ? releaseNotes : releaseName,
    detail: 'A new version is available and is downloading in the background...',
  };

  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) {
      win.webContents.executeJavaScript('console.log("acknowledged availability...")');
    }
  });
});

ipcMain.on('update_downloaded', (event, releaseNotes, releaseName) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  win.webContents.executeJavaScript('console.log("prompting update downloaded...")');
  ipcMain.removeAllListeners('update_downloaded');
  const dialogOpts = {
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Application Update',
    message: process.platform === 'win32' ? releaseNotes : releaseName,
    detail: 'A new version has been downloaded. Restart the application to apply the updates.',
  };

  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) {
      autoUpdater.quitAndInstall();
      win.webContents.executeJavaScript('console.log("restarting...")');
    }
  });
});
