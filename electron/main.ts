import { app, BrowserWindow, ipcMain, Notification, powerSaveBlocker, Tray, Menu, globalShortcut, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let powerBlockerId: number | null = null;

interface AlarmItem {
  id: string;
  title: string;
  time: string; // "HH:MM" format
  mockPath?: string;
  enabled: boolean;
}

const scheduledAlarms: Map<string, AlarmItem> = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: 'Aether Mocks Dashboard',
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Load static dist in production or localhost in development
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../public/v2/index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      mainWindow.loadURL('http://localhost:4173/v2/');
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup System Tray
function setupTray() {
  try {
    const iconPath = path.join(__dirname, '../public/v2/favicon.ico');
    tray = new Tray(fs.existsSync(iconPath) ? iconPath : path.join(__dirname, 'icon.png'));
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '⚡ Open Aether Mocks',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      {
        label: '⏰ Scheduled Mock Alarms',
        click: () => {
          mainWindow?.show();
          mainWindow?.webContents.send('alarm:openManager');
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Aether Mocks Dashboard');
    tray.setContextMenu(contextMenu);
  } catch (e) {
    console.log('Tray setup bypassed:', e);
  }
}

// Background Alarm Monitoring Loop
function startAlarmMonitor() {
  setInterval(() => {
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const currentSeconds = now.getSeconds();

    // Trigger on the 0th second of every minute
    if (currentSeconds < 10) {
      for (const [id, alarm] of scheduledAlarms.entries()) {
        if (alarm.enabled && alarm.time === currentTimeStr) {
          fireAlarm(alarm);
        }
      }
    }
  }, 10000);
}

function fireAlarm(alarm: AlarmItem) {
  // 1. Send desktop notification
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: '⏰ Mock Practice Alarm!',
      body: `${alarm.title} — Time to start your practice test!`,
      urgency: 'critical',
    });
    notification.show();
    notification.on('click', () => {
      mainWindow?.show();
      mainWindow?.focus();
      if (alarm.mockPath) {
        mainWindow?.webContents.send('alarm:navigate', alarm.mockPath);
      }
    });
  }

  // 2. Notify Renderer Process
  mainWindow?.webContents.send('alarm:fired', alarm);
  mainWindow?.show();
  mainWindow?.focus();
}

// Register IPC Listeners
function setupIPC() {
  ipcMain.on('exam:start', () => {
    if (!powerBlockerId) {
      powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    }
  });

  ipcMain.on('exam:end', () => {
    if (powerBlockerId !== null) {
      powerSaveBlocker.stop(powerBlockerId);
      powerBlockerId = null;
    }
  });

  ipcMain.on('desktop:notify', (_event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  ipcMain.on('alarm:schedule', (_event, alarm: AlarmItem) => {
    scheduledAlarms.set(alarm.id, { ...alarm, enabled: true });
  });

  ipcMain.on('alarm:cancel', (_event, alarmId: string) => {
    scheduledAlarms.delete(alarmId);
  });

  ipcMain.handle('desktop:exportScorecard', async (_event, data) => {
    if (!mainWindow) return { success: false };
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Scorecard Report',
      defaultPath: `Aether_Scorecard_${Date.now()}.html`,
      filters: [{ name: 'HTML Report', extensions: ['html'] }],
    });

    if (filePath) {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><title>${data.title || 'Scorecard'}</title></head>
        <body style="font-family: system-ui; padding: 2rem;">
          <h1>${data.title || 'Mock Scorecard'}</h1>
          <p>Score: <strong>${data.score}</strong> / ${data.totalMarks}</p>
          <p>Accuracy: <strong>${data.accuracy}%</strong></p>
          <p>Date: ${new Date().toLocaleDateString()}</p>
        </body>
        </html>
      `;
      fs.writeFileSync(filePath, htmlContent, 'utf-8');
      return { success: true, filePath };
    }
    return { success: false };
  });
}

// App Lifecycle
app.whenReady().then(() => {
  createWindow();
  setupTray();
  setupIPC();
  startAlarmMonitor();

  // Register Cmd+Alt+M global shortcut
  try {
    globalShortcut.register('CommandOrControl+Alt+M', () => {
      if (mainWindow?.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow?.show();
      }
    });
  } catch (e) {
    console.log('Shortcut registration bypassed');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
