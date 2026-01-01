import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface SettingsState {
  hospitalName: string;
}

interface SettingsContextValue {
  settings: SettingsState;
  refreshSettings: () => Promise<void>;
  updateHospitalName: (value: string) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<SettingsState>({ hospitalName: '' });

  const refreshSettings = async () => {
    try {
      const { data } = await axios.get('/api/settings');
      setSettings({ hospitalName: data?.hospitalName || '' });
    } catch {
      setSettings(prev => prev);
    }
  };

  const updateHospitalName = async (value: string) => {
    const { data } = await axios.put('/api/settings/hospital-name', { value });
    setSettings({ hospitalName: data?.hospitalName || value });
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const value = useMemo(
    () => ({
      settings,
      refreshSettings,
      updateHospitalName,
    }),
    [settings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
};
