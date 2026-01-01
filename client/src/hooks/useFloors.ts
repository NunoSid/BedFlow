import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

export const useFloors = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const [floors, setFloors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFloors = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/beds/floors');
      setFloors(Array.isArray(data) ? data : []);
    } catch {
      enqueueSnackbar(t('errors.loadBeds'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchFloors();
  }, [fetchFloors]);

  return { floors, loading, refreshFloors: fetchFloors };
};
