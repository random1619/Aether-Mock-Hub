import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PracticeAlarm {
  id: string;
  title: string;
  time: string; // "HH:MM" in 24hr format e.g. "09:00"
  days: string[]; // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  mockPath?: string;
  enabled: boolean;
}

interface AlarmStoreState {
  alarms: PracticeAlarm[];
  activeFiredAlarm: PracticeAlarm | null;
  addAlarm: (alarm: Omit<PracticeAlarm, 'id'>) => void;
  toggleAlarm: (id: string) => void;
  deleteAlarm: (id: string) => void;
  setFiredAlarm: (alarm: PracticeAlarm | null) => void;
}

export const useAlarmStore = create<AlarmStoreState>()(
  persist(
    (set) => ({
      alarms: [
        {
          id: 'alarm-default-1',
          title: 'Morning SSC CGL Quant Mock',
          time: '09:00',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          enabled: true,
        },
        {
          id: 'alarm-default-2',
          title: 'Evening General Awareness Quiz',
          time: '18:00',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          enabled: true,
        },
      ],
      activeFiredAlarm: null,

      addAlarm: (alarmData) => {
        const newAlarm: PracticeAlarm = {
          ...alarmData,
          id: `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        };

        // Notify Desktop Bridge if running in Electron
        if (typeof window !== 'undefined' && (window as any).aetherDesktop?.scheduleAlarm) {
          (window as any).aetherDesktop.scheduleAlarm(newAlarm);
        }

        set((state) => ({ alarms: [...state.alarms, newAlarm] }));
      },

      toggleAlarm: (id) => {
        set((state) => {
          const updated = state.alarms.map((a) => {
            if (a.id === id) {
              const enabled = !a.enabled;
              if (typeof window !== 'undefined' && (window as any).aetherDesktop) {
                if (enabled) {
                  (window as any).aetherDesktop.scheduleAlarm({ ...a, enabled: true });
                } else {
                  (window as any).aetherDesktop.cancelAlarm(a.id);
                }
              }
              return { ...a, enabled };
            }
            return a;
          });
          return { alarms: updated };
        });
      },

      deleteAlarm: (id) => {
        if (typeof window !== 'undefined' && (window as any).aetherDesktop?.cancelAlarm) {
          (window as any).aetherDesktop.cancelAlarm(id);
        }
        set((state) => ({ alarms: state.alarms.filter((a) => a.id !== id) }));
      },

      setFiredAlarm: (alarm) => set({ activeFiredAlarm: alarm }),
    }),
    {
      name: 'aether-alarms-storage',
    }
  )
);
