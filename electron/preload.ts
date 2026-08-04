import { contextBridge, ipcRenderer } from 'electron';

const aetherDesktopBridge = {
  isElectron: true,

  startExam: () => ipcRenderer.send('exam:start'),
  endExam: () => ipcRenderer.send('exam:end'),

  notify: (title: string, body: string) => {
    ipcRenderer.send('desktop:notify', { title, body });
  },

  exportScorecard: async (data: any) => {
    return ipcRenderer.invoke('desktop:exportScorecard', data);
  },

  scheduleAlarm: (alarm: { id: string; title: string; time: string; mockPath?: string }) => {
    ipcRenderer.send('alarm:schedule', alarm);
  },

  cancelAlarm: (alarmId: string) => {
    ipcRenderer.send('alarm:cancel', alarmId);
  },

  onAlarmFired: (callback: (alarm: any) => void) => {
    const handler = (_event: any, alarm: any) => callback(alarm);
    ipcRenderer.on('alarm:fired', handler);
    return () => ipcRenderer.removeListener('alarm:fired', handler);
  },
};

contextBridge.exposeInMainWorld('aetherDesktop', aetherDesktopBridge);
