import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../context/SettingsContext';

type UnitType = 'FLOOR' | 'SERVICE';

export const AdminPage = () => {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const { settings, updateHospitalName } = useSettings();
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [unitName, setUnitName] = useState('');
  const [unitType, setUnitType] = useState<UnitType>('FLOOR');
  const [roomName, setRoomName] = useState('');
  const [bedCode, setBedCode] = useState('');
  const [hospitalName, setHospitalName] = useState('');

  const canManage = user && (user.role === 'COORDINATOR' || user.role === 'ADMIN');

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === selectedUnitId),
    [units, selectedUnitId],
  );
  const selectedRoom = useMemo(
    () => selectedUnit?.rooms?.find((room: any) => room.id === selectedRoomId),
    [selectedUnit, selectedRoomId],
  );

  const loadStructure = async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const { data } = await axios.get('/api/beds/structure');
      setUnits(Array.isArray(data) ? data : []);
    } catch (e: any) {
      enqueueSnackbar(t('errors.loadBeds'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStructure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setHospitalName(settings.hospitalName || '');
  }, [settings.hospitalName]);

  useEffect(() => {
    if (selectedUnitId && !units.some((unit) => unit.id === selectedUnitId)) {
      setSelectedUnitId('');
    }
  }, [units, selectedUnitId]);

  useEffect(() => {
    if (!selectedUnit?.rooms?.some((room: any) => room.id === selectedRoomId)) {
      setSelectedRoomId('');
    }
  }, [selectedUnit, selectedRoomId]);

  const handleCreateUnit = async () => {
    if (!unitName.trim()) {
      enqueueSnackbar(t('notifications.nameRequired'), { variant: 'warning' });
      return;
    }
    try {
      await axios.post('/api/beds/units', { name: unitName, type: unitType });
      setUnitName('');
      await loadStructure();
      enqueueSnackbar(t('admin.createUnit'), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.message || t('errors.saveError'), { variant: 'error' });
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!window.confirm(`${t('admin.deleteUnit')}?`)) return;
    try {
      await axios.delete(`/api/beds/units/${unitId}`);
      await loadStructure();
      enqueueSnackbar(t('admin.deleteUnit'), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.message || t('errors.saveError'), { variant: 'error' });
    }
  };

  const handleCreateRoom = async () => {
    if (!selectedUnitId) {
      enqueueSnackbar(t('admin.units'), { variant: 'warning' });
      return;
    }
    if (!roomName.trim()) {
      enqueueSnackbar(t('notifications.nameRequired'), { variant: 'warning' });
      return;
    }
    try {
      await axios.post('/api/beds/rooms', { unitId: selectedUnitId, name: roomName });
      setRoomName('');
      await loadStructure();
      enqueueSnackbar(t('admin.createRoom'), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.message || t('errors.saveError'), { variant: 'error' });
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm(`${t('admin.deleteRoom')}?`)) return;
    try {
      await axios.delete(`/api/beds/rooms/${roomId}`);
      await loadStructure();
      enqueueSnackbar(t('admin.deleteRoom'), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.message || t('errors.saveError'), { variant: 'error' });
    }
  };

  const handleCreateBed = async () => {
    if (!selectedRoomId) {
      enqueueSnackbar(t('admin.rooms'), { variant: 'warning' });
      return;
    }
    if (!bedCode.trim()) {
      enqueueSnackbar(t('notifications.nameRequired'), { variant: 'warning' });
      return;
    }
    try {
      await axios.post(`/api/beds/rooms/${selectedRoomId}/beds`, { code: bedCode });
      setBedCode('');
      await loadStructure();
      enqueueSnackbar(t('admin.createBed'), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.message || t('errors.saveError'), { variant: 'error' });
    }
  };

  const handleSaveHospitalName = async () => {
    if (!hospitalName.trim()) {
      enqueueSnackbar(t('notifications.nameRequired'), { variant: 'warning' });
      return;
    }
    try {
      await updateHospitalName(hospitalName.trim());
      enqueueSnackbar(t('admin.hospitalSaved'), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.message || t('errors.saveError'), { variant: 'error' });
    }
  };

  const handleDeleteBed = async (bedId: string) => {
    if (!window.confirm(`${t('admin.deleteBed')}?`)) return;
    try {
      await axios.delete(`/api/beds/${bedId}`);
      await loadStructure();
      enqueueSnackbar(t('admin.deleteBed'), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e.response?.data?.message || t('errors.saveError'), { variant: 'error' });
    }
  };

  if (!canManage) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6">{t('audits.noPermission')}</Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t('admin.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('admin.subtitle')}
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('admin.hospitalTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('admin.hospitalSubtitle')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            label={t('admin.hospitalName')}
            value={hospitalName}
            onChange={(e) => setHospitalName(e.target.value)}
            size="small"
            fullWidth
          />
          <Button variant="contained" onClick={handleSaveHospitalName}>
            {t('admin.saveHospital')}
          </Button>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t('admin.units')}
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label={t('admin.unitName')}
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  select
                  label={t('admin.unitType')}
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value as UnitType)}
                  size="small"
                  fullWidth
                >
                  <MenuItem value="FLOOR">{t('admin.floor')}</MenuItem>
                  <MenuItem value="SERVICE">{t('admin.service')}</MenuItem>
                </TextField>
                <Button
                  variant="contained"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={handleCreateUnit}
                >
                  {t('admin.createUnit')}
                </Button>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <List dense>
                {units.map((unit) => (
                  <ListItem
                    key={unit.id}
                    secondaryAction={(
                      <Tooltip title={t('admin.deleteUnit')}>
                        <IconButton edge="end" size="small" onClick={() => handleDeleteUnit(unit.id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    onClick={() => setSelectedUnitId(unit.id)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: unit.id === selectedUnitId ? 'rgba(0,92,138,0.1)' : 'transparent',
                      borderRadius: 1,
                    }}
                  >
                  <ListItemText
                    primary={unit.name}
                    secondary={unit.type === 'SERVICE' ? t('admin.service') : t('admin.floor')}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t('admin.rooms')}
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label={t('admin.roomName')}
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!selectedUnitId}
                />
                <Button
                  variant="contained"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={handleCreateRoom}
                  disabled={!selectedUnitId}
                >
                  {t('admin.createRoom')}
                </Button>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <List dense>
                {(selectedUnit?.rooms || []).map((room: any) => (
                  <ListItem
                    key={room.id}
                    secondaryAction={(
                      <Tooltip title={t('admin.deleteRoom')}>
                        <IconButton edge="end" size="small" onClick={() => handleDeleteRoom(room.id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    onClick={() => setSelectedRoomId(room.id)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: room.id === selectedRoomId ? 'rgba(0,92,138,0.1)' : 'transparent',
                      borderRadius: 1,
                    }}
                  >
                    <ListItemText primary={room.name} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t('admin.beds')}
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label={t('admin.bedCode')}
                  value={bedCode}
                  onChange={(e) => setBedCode(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!selectedRoomId}
                />
                <Button
                  variant="contained"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={handleCreateBed}
                  disabled={!selectedRoomId}
                >
                  {t('admin.createBed')}
                </Button>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <List dense>
                {(selectedRoom?.beds || []).map((bed: any) => (
                  <ListItem
                    key={bed.id}
                    secondaryAction={(
                      <Tooltip title={t('admin.deleteBed')}>
                        <IconButton edge="end" size="small" onClick={() => handleDeleteBed(bed.id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  >
                    <ListItemText primary={bed.code} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};
