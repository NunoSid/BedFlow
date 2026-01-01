import { useEffect, useState, ReactNode } from 'react';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  TextField,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ButtonGroup,
  CircularProgress,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Stack,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import EditNoteIcon from '@mui/icons-material/EditNote';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LockResetIcon from '@mui/icons-material/LockReset';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import axios from 'axios';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import { useAuth } from '../context/AuthContext';
import { SelectChangeEvent } from '@mui/material/Select';
import { useFloors } from '../hooks/useFloors';
import { useTranslation } from 'react-i18next';
import { getSpecialtyOptions, getSexOptions, getSubsystemOptions, specialtyColors } from '../constants/clinicalOptions';
import { useSettings } from '../context/SettingsContext';
import { loadLogoDataUrl } from '../utils/pdfLogo';

const styles = {
  headerCell: {
    fontWeight: 700,
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#0f3a5d',
    backgroundColor: '#eef6fb',
    borderBottom: '2px solid #d0e3f1',
    borderRight: '1px solid #dde7f0',
    padding: '8px 4px',
    textAlign: 'center'
  },
  dataCell: {
    fontSize: '0.85rem',
    padding: '6px 8px',
    borderRight: '1px solid #eff3f6',
    borderBottom: '1px solid #eff3f6',
    cursor: 'pointer',
    transition: 'background 0.2s, box-shadow 0.2s',
    backgroundColor: '#fff',
    '&:hover': {
      backgroundColor: 'rgba(74,196,198,0.15)',
      boxShadow: 'inset 0 0 0 1px rgba(74,196,198,0.5)'
    }
  },
  lockedRow: {
    backgroundColor: '#e0e0e0',
    opacity: 0.6
  },
  floorHeader: {
    background: 'linear-gradient(135deg, #005c8a 0%, #0b7db0 100%)',
    color: '#fff',
    padding: '16px 24px',
    borderRadius: '12px 12px 0 0',
    fontWeight: 600,
    letterSpacing: '0.6px'
  }
};

const clinicalFieldKeys = [
  'output_obs',
  'urination_obs',
  'dressings_location',
  'dressings_type',
  'dressings_status',
  'dressings_obs',
];

const compareBedCodes = (codeA: string, codeB: string) => {
  const segments = (code: string) => code.split(/[\.\-]/).filter(Boolean);
  const segA = segments(codeA);
  const segB = segments(codeB);
  const len = Math.max(segA.length, segB.length);
  for (let i = 0; i < len; i++) {
    const a = segA[i];
    const b = segB[i];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    const isNumA = /^\d+$/.test(a);
    const isNumB = /^\d+$/.test(b);
    if (isNumA && isNumB) {
      const numDiff = parseInt(a, 10) - parseInt(b, 10);
      if (numDiff !== 0) return numDiff;
      continue;
    }
    if (isNumA) return -1;
    if (isNumB) return 1;
    const strA = a.toUpperCase();
    const strB = b.toUpperCase();
    const weightA = strA === 'QP' ? 9999 : strA.charCodeAt(0);
    const weightB = strB === 'QP' ? 9999 : strB.charCodeAt(0);
    if (weightA !== weightB) return weightA - weightB;
    const cmp = strA.localeCompare(strB);
    if (cmp !== 0) return cmp;
  }
  return 0;
};

type EditingContext = {
  bed: any;
  field: string;
  kind: 'clinical' | 'admin';
  label: string;
  multiline?: boolean;
  inputType?: 'text' | 'number' | 'select' | 'date';
  options?: { value: string; label: string }[];
};

export const Dashboard = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const hospitalName = settings.hospitalName || t('app.name');
  const { floors, refreshFloors, loading: floorsLoading } = useFloors();
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const specialtyOptions = getSpecialtyOptions(t);
  const sexOptions = getSexOptions(t);
  const subsystemOptions = getSubsystemOptions(t);
  const subsystemAllowed = new Set(subsystemOptions.map(option => option.value));
  const sanitizeSubsystem = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.toUpperCase().trim();
    return subsystemAllowed.has(normalized) ? normalized : null;
  };
  const clinicalFieldLabels: Record<string, string> = {
    output_obs: t('clinical.output_obs'),
    urination_obs: t('clinical.urination_obs'),
    dressings_location: t('clinical.dressings_location'),
    dressings_type: t('clinical.dressings_type'),
    dressings_status: t('clinical.dressings_status'),
    dressings_obs: t('clinical.dressings_obs'),
  };
  const clinicalBooleanLabels: Record<string, string> = {
    cvp_exists: t('clinical.cvp_exists'),
    therapy_exists: t('clinical.therapy_exists'),
    dib_exists: t('clinical.dib_exists'),
    output_exists: t('clinical.output_exists'),
    urination_exists: t('clinical.urination_exists'),
  };

  const createEmptyAdmit = () => ({
    name: ''
  });

  const createEmptyDrain = () => ({
    location: '',
    bottleVolume: '',
    totalVolume: '',
  });

  const createEmptyDressing = () => ({
    location: '',
    type: '',
    status: '',
    obs: ''
  });

  const createAdminForm = () => ({
    name: '',
    processNumber: '',
    birthDate: '',
    surgeon: '',
    surgery: '',
    specialty: '',
    subsystem: '',
    dischargeDate: '',
    observations: '',
    allergies: ''
  });

  const createDetailForm = () => ({
    name: '',
    processNumber: '',
    ageYears: '',
    sex: '',
    surgeon: '',
    surgery: '',
    specialty: '',
    subsystem: '',
    observations: '',
    allergies: '',
    entryDate: '',
    dischargeDate: '',
  });

  const parseDrainField = (value?: string | null) => {
    if (!value) return [];
    return value
      .split('\n')
      .map(entry => entry.replace(/^D?\d+[:\-]?\s*/i, '').trim())
      .filter(Boolean);
  };

  const getDrainRows = (bed: any) => {
    const state = bed?.clinicalState || {};
    const locations = parseDrainField(state.drains_location);
    const bottleVolumes = parseDrainField(state.drains_volume);
    const totalVolumes = parseDrainField(state.drains_aspect);
    const maxRows = Math.max(locations.length, bottleVolumes.length, totalVolumes.length, 1);
    return Array.from({ length: Math.min(maxRows, 5) }).map((_, idx) => ({
      location: locations[idx] || '',
      bottleVolume: bottleVolumes[idx] || '',
      totalVolume: totalVolumes[idx] || '',
    }));
  };

  const parseDressingField = (value?: string | null) => {
    if (!value) return [];
    return value
      .split('\n')
      .map(entry => entry.replace(/^P?\d+[:\-]?\s*/i, '').trim())
      .filter(Boolean);
  };

  const getDressingRows = (bed: any) => {
    const state = bed?.clinicalState || {};
    const locations = parseDressingField(state.dressings_location);
    const types = parseDressingField(state.dressings_type);
    const status = parseDressingField(state.dressings_status);
    const observations = parseDressingField(state.dressings_obs);
    const maxRows = Math.max(locations.length, types.length, status.length, observations.length, 1);
    return Array.from({ length: Math.min(maxRows, 5) }).map((_, idx) => ({
      location: locations[idx] || '',
      type: types[idx] || '',
      status: status[idx] || '',
      obs: observations[idx] || '',
    }));
  };

  const booleanMark = (value?: boolean | null) => (value ? 'V' : 'X');

  const abbreviateSex = (value?: string | null) => {
    if (!value) return '';
    const normalized = value.toUpperCase();
    if (normalized.startsWith('M')) return 'M';
    if (normalized.startsWith('F')) return 'F';
    return normalized.slice(0, 1);
  };

  const hasAnyDrains = (state: any) =>
    !!(state?.drains_location || state?.drains_volume || state?.drains_aspect);

  const hasAnyDressings = (state: any) =>
    !!(state?.dressings_location || state?.dressings_type || state?.dressings_status || state?.dressings_obs);

  const [editingCell, setEditingCell] = useState<EditingContext | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [admittingBed, setAdmittingBed] = useState<any>(null);
  const [admitData, setAdmitData] = useState(createEmptyAdmit());
  const [drainsModalBed, setDrainsModalBed] = useState<any>(null);
  const [drainsForm, setDrainsForm] = useState<any[]>([createEmptyDrain()]);
  const [dressingsModalBed, setDressingsModalBed] = useState<any>(null);
  const [dressingsForm, setDressingsForm] = useState<any[]>([createEmptyDressing()]);
  const [adminModalBed, setAdminModalBed] = useState<any>(null);
  const [adminForm, setAdminForm] = useState(createAdminForm());
  const [adminReason, setAdminReason] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [auditModalBed, setAuditModalBed] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userForm, setUserForm] = useState({ username: '', fullName: '', password: '', role: 'NURSE' });
  const [usersLoading, setUsersLoading] = useState(false);
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<any | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordSaving, setResetPasswordSaving] = useState(false);
  const [detailBed, setDetailBed] = useState<any>(null);
  const [detailForm, setDetailForm] = useState(createDetailForm());
  const [detailReason, setDetailReason] = useState('');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [clearedFloors, setClearedFloors] = useState<Record<string, boolean>>({});
  const today = new Date();
  const todayLabel = format(today, 'dd/MM/yyyy');
  const exporterName = user?.fullName || user?.username || t('app.authenticatedUser');

  const isAdmin = user?.role === 'ADMIN';
  const isCoordinator = user?.role === 'COORDINATOR' || isAdmin;

  const toDateInputValue = (value?: string | null) => {
    if (!value) return '';
    try {
      return new Date(value).toISOString().substring(0, 10);
    } catch {
      return value;
    }
  };

  const fetchUsersList = async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const { data } = await axios.get('/api/auth/users');
      setUsersList(Array.isArray(data) ? data : []);
    } catch {
      enqueueSnackbar(t('notifications.usersFetchError'), { variant: 'error' });
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedFloor || selectedFloor === 'ALL') return;
    const exists = floors.some(f => f.id === selectedFloor);
    if (!exists) setSelectedFloor('');
  }, [floors, selectedFloor]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsersList();
  }, [isAdmin]);

  const handleClinicalEdit = (bed: any, field: string, value: any) => {
    if (bed.isLocked && user?.role !== 'ADMIN') {
      enqueueSnackbar(t('dashboard.bedLocked'), { variant: 'warning' });
      return;
    }
    setEditingCell({
      bed,
      field,
      kind: 'clinical',
      label: clinicalFieldLabels[field] || t('dashboard.clinicalFieldDefault'),
      multiline: false,
      inputType: 'text',
    });
    setEditValue(value ?? '');
    setEditReason('');
  };

  const handleAdminField = (
    bed: any,
    field: string,
    label: string,
    value: any,
    options?: { multiline?: boolean; type?: 'text' | 'number' | 'select' | 'date'; choices?: { value: string; label: string }[] }
  ) => {
    const hasAdmission = bed.admissions?.length > 0;
    if (!hasAdmission) {
      enqueueSnackbar(t('dashboard.noActivePatient'), { variant: 'warning' });
      return;
    }
    if (bed.isLocked && user?.role !== 'ADMIN') {
      enqueueSnackbar(t('dashboard.bedLocked'), { variant: 'warning' });
      return;
    }
    setEditingCell({
      bed,
      field,
      kind: 'admin',
      label,
      multiline: !!options?.multiline,
      inputType: options?.type || 'text',
      options: options?.choices,
    });
    setEditValue(value !== null && value !== undefined ? String(value) : '');
    setEditReason('');
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    try {
      if (editingCell.kind === 'clinical') {
        await axios.patch(`/api/beds/${editingCell.bed.id}/clinical`, {
          field: editingCell.field,
          value: editValue,
          reason: editReason
        });
        enqueueSnackbar(t('notifications.clinicalUpdated'), { variant: 'success' });
      } else {
        let formattedValue: any = editValue;
        if (editingCell.inputType === 'number') {
          formattedValue = editValue === '' ? null : Number(editValue);
        } else if (editingCell.inputType === 'date') {
          formattedValue = editValue || null;
        } else if (editingCell.inputType === 'select') {
          formattedValue = editValue || null;
        } else if (typeof editValue === 'string') {
          formattedValue = editValue.trim() || null;
        }
        const payload: any = { reason: editReason || undefined };
        payload[editingCell.field] = formattedValue;
        await axios.patch(`/api/beds/${editingCell.bed.id}/admin`, payload);
        enqueueSnackbar(t('notifications.adminUpdated'), { variant: 'success' });
      }
      setEditingCell(null);
      refreshFloors();
    } catch (e: any) {
      enqueueSnackbar(`${t('notifications.saveError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    }
  };

  const handleAdmitClick = (bed: any) => {
    setAdmittingBed(bed);
    setAdmitData(createEmptyAdmit());
  };

  const saveAdmit = async () => {
    if (!admitData.name) return enqueueSnackbar(t('notifications.nameRequired'), { variant: 'warning' });
    try {
      await axios.post(`/api/beds/${admittingBed.id}/admit`, { name: admitData.name.trim() });
      enqueueSnackbar(t('notifications.admissionCreated'), { variant: 'success' });
      setAdmittingBed(null);
      setAdmitData(createEmptyAdmit());
      refreshFloors();
    } catch (e: any) {
      enqueueSnackbar(`${t('notifications.saveError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    }
  };

  const handleDischarge = async (bed: any) => {
    if (!window.confirm(t('prompts.confirmDischarge'))) return;
    try {
      await axios.post(`/api/beds/${bed.id}/discharge`, { reason: t('dashboard.dischargeAction') });
      enqueueSnackbar(t('notifications.dischargeDone'), { variant: 'success' });
      refreshFloors();
    } catch {
      enqueueSnackbar(t('notifications.dischargeError'), { variant: 'error' });
    }
  };

  const toggleLock = async (bed: any) => {
    const actionKey = bed.isLocked ? 'unlock' : 'lock';
    const actionLabel = t(`actions.${actionKey}`);
    const reason = window.prompt(t('prompts.lockReason', { action: actionLabel, code: bed.code }), '') || undefined;
    try {
      await axios.post(`/api/beds/${bed.id}/lock`, { reason: reason?.trim() || undefined });
      enqueueSnackbar(
        actionKey === 'lock' ? t('dashboard.bedLocked') : t('dashboard.bedUnlocked'),
        { variant: 'success' },
      );
      refreshFloors();
    } catch {
      enqueueSnackbar(t('notifications.lockError'), { variant: 'error' });
    }
  };

  const handleDrainsEdit = (bed: any) => {
    if (!bed.admissions?.length) {
      enqueueSnackbar(t('dashboard.noActivePatient'), { variant: 'warning' });
      return;
    }
    if (bed.isLocked && user?.role !== 'ADMIN') {
      enqueueSnackbar(t('dashboard.bedLocked'), { variant: 'warning' });
      return;
    }
    setDrainsModalBed(bed);
    const rows = getDrainRows(bed);
    setDrainsForm(rows.length ? rows : [createEmptyDrain()]);
  };

  const updateDrainField = (index: number, field: string, value: string) => {
    setDrainsForm(prev => prev.map((drain, idx) => idx === index ? { ...drain, [field]: value } : drain));
  };

  const addDrainRow = () => {
    setDrainsForm(prev => prev.length >= 5 ? prev : [...prev, createEmptyDrain()]);
  };

  const removeDrainRow = (index: number) => {
    setDrainsForm(prev => {
      if (prev.length === 1) return [createEmptyDrain()];
      const next = [...prev];
      next.splice(index, 1);
      return next.length ? next : [createEmptyDrain()];
    });
  };

  const closeDrainsModal = () => {
    setDrainsModalBed(null);
    setDrainsForm([createEmptyDrain()]);
  };

  const saveDrains = async () => {
    if (!drainsModalBed) return;
    const buildValue = (field: keyof ReturnType<typeof createEmptyDrain>) =>
      drainsForm
        .map((drain, idx) => (drain[field]?.trim() ? `D${idx + 1}: ${drain[field].trim()}` : ''))
        .filter(Boolean)
        .join('\n');
    try {
      const updates = [
        { field: 'drains_location', value: buildValue('location') },
        { field: 'drains_volume', value: buildValue('bottleVolume') },
        { field: 'drains_aspect', value: buildValue('totalVolume') },
        { field: 'drains_obs', value: '' },
      ];
      for (const update of updates) {
        await axios.patch(`/api/beds/${drainsModalBed.id}/clinical`, {
          field: update.field,
          value: update.value,
          reason: t('reasons.drainsEditor')
        });
      }
      enqueueSnackbar(t('notifications.drainsUpdated'), { variant: 'success' });
      closeDrainsModal();
      refreshFloors();
    } catch (e: any) {
      enqueueSnackbar(`${t('notifications.drainsError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    }
  };

  const handleDressingsEdit = (bed: any) => {
    if (!bed.admissions?.length) {
      enqueueSnackbar(t('dashboard.noActivePatient'), { variant: 'warning' });
      return;
    }
    if (bed.isLocked && user?.role !== 'ADMIN') {
      enqueueSnackbar(t('dashboard.bedLocked'), { variant: 'warning' });
      return;
    }
    setDressingsModalBed(bed);
    const rows = getDressingRows(bed);
    setDressingsForm(rows.length ? rows : [createEmptyDressing()]);
  };

  const updateDressingField = (index: number, field: string, value: string) => {
    setDressingsForm(prev => prev.map((dressing, idx) => (idx === index ? { ...dressing, [field]: value } : dressing)));
  };

  const addDressingRow = () => {
    setDressingsForm(prev => (prev.length >= 5 ? prev : [...prev, createEmptyDressing()]));
  };

  const removeDressingRow = (index: number) => {
    setDressingsForm(prev => {
      if (prev.length === 1) return [createEmptyDressing()];
      const next = [...prev];
      next.splice(index, 1);
      return next.length ? next : [createEmptyDressing()];
    });
  };

  const closeDressingsModal = () => {
    setDressingsModalBed(null);
    setDressingsForm([createEmptyDressing()]);
  };

  const saveDressings = async () => {
    if (!dressingsModalBed) return;
    const buildValue = (field: keyof ReturnType<typeof createEmptyDressing>, prefix: string) =>
      dressingsForm
        .map((dressing, idx) => (dressing[field]?.trim() ? `${prefix}${idx + 1}: ${dressing[field].trim()}` : ''))
        .filter(Boolean)
        .join('\n');
    try {
      const updates = [
        { field: 'dressings_location', value: buildValue('location', 'P') },
        { field: 'dressings_type', value: buildValue('type', 'P') },
        { field: 'dressings_status', value: buildValue('status', 'P') },
        { field: 'dressings_obs', value: buildValue('obs', 'P') },
      ];
      for (const update of updates) {
        await axios.patch(`/api/beds/${dressingsModalBed.id}/clinical`, {
          field: update.field,
          value: update.value,
          reason: t('reasons.dressingsEditor')
        });
      }
      enqueueSnackbar(t('notifications.dressingsUpdated'), { variant: 'success' });
      closeDressingsModal();
      refreshFloors();
    } catch (e: any) {
      enqueueSnackbar(`${t('notifications.dressingsError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    }
  };

  const openAdminModal = (bed: any) => {
    const adm = bed?.admissions?.[0];
    if (!adm) {
      enqueueSnackbar(t('dashboard.noActivePatient'), { variant: 'warning' });
      return;
    }
    setAdminModalBed(bed);
    setAdminForm({
      name: adm?.utente?.name || '',
      processNumber: adm?.utente?.processNumber || '',
      birthDate: adm?.utente?.birthDate ? adm.utente.birthDate.substring(0, 10) : '',
      surgeon: adm?.surgeon || '',
      surgery: adm?.surgery || '',
      specialty: adm?.meta?.specialty || '',
      subsystem: sanitizeSubsystem(adm?.utente?.subsystem) || '',
      dischargeDate: adm?.dischargeDate ? adm.dischargeDate.substring(0, 10) : '',
      observations: adm?.meta?.observations || '',
      allergies: adm?.meta?.allergies || ''
    });
    setAdminReason('');
  };

  const closeAdminModal = () => {
    setAdminModalBed(null);
    setAdminForm(createAdminForm());
    setAdminReason('');
  };

  const saveAdministrativeData = async () => {
    if (!adminModalBed) return;
    const toNullable = (value: string) => value?.trim() || null;
    const payload = {
      name: adminForm.name,
      processNumber: toNullable(adminForm.processNumber),
      birthDate: adminForm.birthDate || null,
      surgeon: adminForm.surgeon,
      surgery: adminForm.surgery,
      specialty: toNullable(adminForm.specialty),
      subsystem: sanitizeSubsystem(adminForm.subsystem),
      observations: toNullable(adminForm.observations),
      allergies: toNullable(adminForm.allergies),
      dischargeDate: adminForm.dischargeDate || null,
      reason: adminReason || undefined,
    };
    try {
      await axios.patch(`/api/beds/${adminModalBed.id}/admin`, payload);
      enqueueSnackbar(t('notifications.adminUpdated'), { variant: 'success' });
      closeAdminModal();
      refreshFloors();
    } catch (e: any) {
      enqueueSnackbar(`${t('notifications.saveError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    }
  };

  const openBedDetail = (bed: any) => {
    const adm = bed?.admissions?.[0];
    if (!adm) {
      enqueueSnackbar(t('dashboard.noActivePatient'), { variant: 'warning' });
      return;
    }
    setDetailBed(bed);
    setDetailForm({
      name: adm?.utente?.name || '',
      processNumber: adm?.utente?.processNumber || '',
      ageYears: adm?.ageYears ?? '',
      sex: adm?.sex || '',
      surgeon: adm?.surgeon || '',
      surgery: adm?.surgery || '',
      specialty: adm?.meta?.specialty || '',
      subsystem: sanitizeSubsystem(adm?.utente?.subsystem) || '',
      observations: adm?.meta?.observations || '',
      allergies: adm?.meta?.allergies || '',
      entryDate: toDateInputValue(adm?.entryDate),
      dischargeDate: toDateInputValue(adm?.dischargeDate),
    });
    setDetailReason('');
  };

  const closeBedDetail = () => {
    setDetailBed(null);
    setDetailForm(createDetailForm());
    setDetailReason('');
  };

  const saveDetailData = async () => {
    if (!detailBed) return;
    const payload: any = {
      name: detailForm.name,
      processNumber: detailForm.processNumber?.trim() || null,
      ageYears: detailForm.ageYears === '' ? null : Number(detailForm.ageYears),
      sex: detailForm.sex || null,
      surgeon: detailForm.surgeon,
      surgery: detailForm.surgery,
      specialty: detailForm.specialty || null,
      subsystem: sanitizeSubsystem(detailForm.subsystem),
      observations: detailForm.observations || null,
      allergies: detailForm.allergies || null,
      entryDate: detailForm.entryDate || null,
      dischargeDate: detailForm.dischargeDate || null,
      reason: detailReason || t('reasons.detailedUpdate'),
    };
    if (Number.isNaN(payload.ageYears)) {
      enqueueSnackbar(t('notifications.ageInvalid'), { variant: 'warning' });
      return;
    }
    try {
      await axios.patch(`/api/beds/${detailBed.id}/admin`, payload);
      enqueueSnackbar(t('notifications.dataUpdated'), { variant: 'success' });
      closeBedDetail();
      refreshFloors();
    } catch (e: any) {
      enqueueSnackbar(`${t('notifications.updateError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    }
  };

  const closeChangePassword = () => {
    setChangePasswordOpen(false);
    setPasswordForm({ current: '', next: '', confirm: '' });
    setPasswordSaving(false);
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      enqueueSnackbar(t('notifications.fillAllFields'), { variant: 'warning' });
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      enqueueSnackbar(t('notifications.passwordMismatch'), { variant: 'warning' });
      return;
    }
    setPasswordSaving(true);
    try {
      await axios.patch('/api/auth/password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      });
      enqueueSnackbar(t('notifications.passwordUpdated'), { variant: 'success' });
      closeChangePassword();
    } catch (e: any) {
      enqueueSnackbar(`${t('notifications.passwordUpdateError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleClearBed = async (bed: any) => {
    if (!isCoordinator) return;
    const confirmClear = window.confirm(t('prompts.clearBedConfirm', { code: bed.code }));
    if (!confirmClear) return;
    const reason = window.prompt(t('prompts.clearBedReason'), t('prompts.clearBedReasonDefault'));
    try {
      await axios.post(`/api/beds/${bed.id}/clear`, { reason: reason || t('reasons.manualClean') });
      enqueueSnackbar(t('notifications.bedCleared', { code: bed.code }), { variant: 'success' });
      refreshFloors();
    } catch (e: any) {
      enqueueSnackbar(`${t('notifications.clearBedError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    }
  };

  const handleFloorChange = (event: SelectChangeEvent) => {
    setSelectedFloor(event.target.value);
  };
  const toggleFloorClear = (floorId: string) => {
    setClearedFloors(prev => {
      const next = { ...prev };
      next[floorId] = !next[floorId];
      return next;
    });
  };

  const getExportFloor = () => {
    if (!selectedFloor || selectedFloor === 'ALL') {
      enqueueSnackbar(t('notifications.selectUnitExport'), { variant: 'info' });
      return null;
    }
    const floor = floors.find((f: any) => f.id === selectedFloor);
    if (!floor) {
      enqueueSnackbar(t('notifications.unitNotFound'), { variant: 'error' });
      return null;
    }
    if (!floor.beds || !floor.beds.length) {
      enqueueSnackbar(t('notifications.noBedsInUnit'), { variant: 'warning' });
      return null;
    }
    return floor;
  };

  const buildExportRows = (floor: any) => {
    const formatDay = (value?: string) => {
      if (!value) return '';
      try {
        return format(new Date(value), 'dd/MM/yyyy');
      } catch {
        return value;
      }
    };
    const makeBlock = (label: string, rows: any[], key: string) =>
      rows
        .map((row, idx) => (row[key] ? `${label}${idx + 1}: ${row[key]}` : ''))
        .filter(Boolean)
        .join('\n');

    const sortedBeds = [...(floor?.beds || [])].sort((a, b) => compareBedCodes(a.code || '', b.code || ''));

    return sortedBeds.map((bed: any) => {
      const adm = bed.admissions?.[0];
      const meta = adm?.meta || {};
      const state = bed?.clinicalState || {};
      const hasAdmission = !!adm;
      const drains = getDrainRows(bed);
      const dressings = getDressingRows(bed);
      const boolValue = (flag?: boolean | null) => (hasAdmission ? booleanMark(!!flag) : '');
      const subsystem = sanitizeSubsystem(adm?.utente?.subsystem) || '';
      const drainsBlock = {
        location: makeBlock('D', drains, 'location'),
        bottleVolume: makeBlock('D', drains, 'bottleVolume'),
        totalVolume: makeBlock('D', drains, 'totalVolume'),
      };
      const dressingsBlock = {
        location: makeBlock('P', dressings, 'location'),
        type: makeBlock('P', dressings, 'type'),
        status: makeBlock('P', dressings, 'status'),
        obs: makeBlock('P', dressings, 'obs'),
      };

      return {
        bedCode: bed.code || '',
        status: bed.isLocked ? t('dashboard.lockedShort') : '',
        name: adm?.utente?.name || '',
        process: adm?.utente?.processNumber || '',
        age: typeof adm?.ageYears === 'number' ? String(adm.ageYears) : '',
        sex: adm?.sex || '',
        sexShort: abbreviateSex(adm?.sex),
        surgeon: adm?.surgeon || '',
        specialty: meta.specialty || '',
        surgery: adm?.surgery || '',
        observations: meta.observations || '',
        subsystem,
        allergies: meta.allergies || '',
        entryDate: formatDay(adm?.entryDate),
        dischargeDate: formatDay(adm?.dischargeDate),
        cvp: boolValue(state?.cvp_exists),
        therapy: boolValue(state?.therapy_exists),
        dib: boolValue(state?.dib_exists),
        drainsFlag: boolValue(hasAnyDrains(state)),
        drainsLocation: drainsBlock.location,
        drainsBottleVolume: drainsBlock.bottleVolume,
        drainsTotalVolume: drainsBlock.totalVolume,
        outputFlag: boolValue(state?.output_exists),
        outputObs: state?.output_obs || '',
        urinationFlag: boolValue(state?.urination_exists),
        urinationObs: state?.urination_obs || '',
        dressingsFlag: boolValue(hasAnyDressings(state)),
        dressingsLocation: dressingsBlock.location,
        dressingsType: dressingsBlock.type,
        dressingsStatus: dressingsBlock.status,
        dressingsObs: dressingsBlock.obs,
      };
    });
  };

  const exportSelectedFloorPdf = async () => {
    const floor = getExportFloor();
    if (!floor) return;
    const rows = buildExportRows(floor);
    if (!rows.length) {
      enqueueSnackbar(t('notifications.noDataExport'), { variant: 'info' });
      return;
    }
    try {
      const hospitalName = settings.hospitalName || t('app.name');
      const jsPDFModule = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDFModule.default({ orientation: 'landscape', unit: 'pt', format: 'a2' });
      const logoData = await loadLogoDataUrl();
      if (logoData) {
        doc.addImage(logoData, 'PNG', 40, 18, 50, 50);
      }
      const headerX = logoData ? 100 : 40;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`${hospitalName} · ${floor.name}`, headerX, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(
        t('common.exportedBy', { name: exporterName, date: todayLabel }),
        headerX,
        58,
      );
      const header = [
        t('labels.bed'),
        t('labels.status'),
        t('labels.patient'),
        t('labels.process'),
        t('labels.age'),
        t('labels.sex'),
        t('labels.surgeon'),
        t('labels.specialty'),
        t('labels.surgery'),
        t('labels.observations'),
        t('labels.subsystem'),
        t('labels.allergies'),
        t('labels.entry'),
        t('labels.discharge'),
        t('clinical.cvp_exists'),
        t('clinical.therapy_exists'),
        t('clinical.dib_exists'),
        `${t('clinicalSections.drains')} ${t('clinicalSections.yesNo')}`,
        `${t('clinicalSections.drains')} ${t('clinicalSections.location')}`,
        `${t('clinicalSections.drains')} ${t('clinicalSections.volumeBottle')}`,
        `${t('clinicalSections.drains')} ${t('clinicalSections.volumeTotal')}`,
        `${t('clinicalSections.output')} ${t('clinicalSections.yesNo')}`,
        `${t('clinicalSections.output')} ${t('clinicalSections.obs')}`,
        `${t('clinicalSections.urination')} ${t('clinicalSections.yesNo')}`,
        `${t('clinicalSections.urination')} ${t('clinicalSections.obs')}`,
        `${t('clinicalSections.dressings')} ${t('clinicalSections.yesNo')}`,
        `${t('clinicalSections.dressings')} ${t('clinicalSections.location')}`,
        `${t('clinicalSections.dressings')} ${t('clinicalSections.type')}`,
        `${t('clinicalSections.dressings')} ${t('clinicalSections.status')}`,
        `${t('clinicalSections.dressings')} ${t('clinicalSections.obs')}`,
      ];
      const body = rows.map((row: any) => [
        row.bedCode,
        row.status,
        row.name,
        row.process,
        row.age,
        row.sexShort,
        row.surgeon,
        row.specialty,
        row.surgery,
        row.observations,
        row.subsystem,
        row.allergies,
        row.entryDate,
        row.dischargeDate,
        row.cvp,
        row.therapy,
        row.dib,
        row.drainsFlag,
        row.drainsLocation,
        row.drainsBottleVolume,
        row.drainsTotalVolume,
        row.outputFlag,
        row.outputObs,
        row.urinationFlag,
        row.urinationObs,
        row.dressingsFlag,
        row.dressingsLocation,
        row.dressingsType,
        row.dressingsStatus,
        row.dressingsObs,
      ]);
      const columnStyles: Record<number, any> = {
        0: { cellWidth: 24 },
        1: { cellWidth: 28 },
        2: { cellWidth: 80, halign: 'left' },
        3: { cellWidth: 38 },
        4: { cellWidth: 20 },
        5: { cellWidth: 18 },
        6: { cellWidth: 70, halign: 'left' },
        7: { cellWidth: 70, halign: 'left' },
        8: { cellWidth: 70, halign: 'left' },
        9: { cellWidth: 90, halign: 'left' },
        10: { cellWidth: 50, halign: 'center' },
        11: { cellWidth: 50, halign: 'left' },
        12: { cellWidth: 45 },
        13: { cellWidth: 45 },
        14: { cellWidth: 14 },
        15: { cellWidth: 14 },
        16: { cellWidth: 14 },
        17: { cellWidth: 16 },
        18: { cellWidth: 55, halign: 'left' },
        19: { cellWidth: 35, halign: 'left' },
        20: { cellWidth: 35, halign: 'left' },
        21: { cellWidth: 16 },
        22: { cellWidth: 60, halign: 'left' },
        23: { cellWidth: 16 },
        24: { cellWidth: 60, halign: 'left' },
        25: { cellWidth: 16 },
        26: { cellWidth: 55, halign: 'left' },
        27: { cellWidth: 45, halign: 'left' },
        28: { cellWidth: 45, halign: 'left' },
        29: { cellWidth: 60, halign: 'left' },
      };
      const tableWidth = doc.internal.pageSize.getWidth() - 20;
      autoTable(doc, {
        head: [header],
        body,
        startY: 80,
        styles: { fontSize: 4, cellPadding: 1, overflow: 'linebreak', halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [15, 58, 93], textColor: 255, fontSize: 5 },
        bodyStyles: { fontSize: 4 },
        columnStyles,
        tableWidth,
        margin: { left: 10, right: 10 },
        theme: 'grid',
      });
      const safeName = (floor.name || '').toString().replace(/\s+/g, '_').toLowerCase();
      doc.save(`distribuicao_${safeName}_${todayLabel.replace(/\//g, '-')}.pdf`);
      enqueueSnackbar(t('notifications.pdfExported'), { variant: 'success' });
    } catch (error) {
      console.error(error);
      enqueueSnackbar(t('notifications.pdfError'), { variant: 'error' });
    }
  };

  const exportSelectedFloorExcel = async () => {
    const floor = getExportFloor();
    if (!floor) return;
    const rows = buildExportRows(floor);
    if (!rows.length) {
      enqueueSnackbar(t('notifications.noDataExport'), { variant: 'info' });
      return;
    }
    try {
      const hospitalName = settings.hospitalName || t('app.name');
      const xlsx = await import('xlsx');
      const header = [
        t('labels.bed'),
        t('labels.status'),
        t('labels.patient'),
        t('labels.process'),
        t('labels.age'),
        t('labels.sex'),
        t('labels.surgeon'),
        t('labels.specialty'),
        t('labels.surgery'),
        t('labels.observations'),
        t('labels.subsystem'),
        t('labels.allergies'),
        t('labels.entry'),
        t('labels.discharge'),
        t('clinical.cvp_exists'),
        t('clinical.therapy_exists'),
        t('clinical.dib_exists'),
        `${t('clinicalSections.drains')} ${t('clinicalSections.yesNo')}`,
        `${t('clinicalSections.drains')} ${t('clinicalSections.location')}`,
        `${t('clinicalSections.drains')} ${t('clinicalSections.volumeBottle')}`,
        `${t('clinicalSections.drains')} ${t('clinicalSections.volumeTotal')}`,
        `${t('clinicalSections.output')} ${t('clinicalSections.yesNo')}`,
        `${t('clinicalSections.output')} ${t('clinicalSections.obs')}`,
        `${t('clinicalSections.urination')} ${t('clinicalSections.yesNo')}`,
        `${t('clinicalSections.urination')} ${t('clinicalSections.obs')}`,
        `${t('clinicalSections.dressings')} ${t('clinicalSections.yesNo')}`,
        `${t('clinicalSections.dressings')} ${t('clinicalSections.location')}`,
        `${t('clinicalSections.dressings')} ${t('clinicalSections.type')}`,
        `${t('clinicalSections.dressings')} ${t('clinicalSections.status')}`,
        `${t('clinicalSections.dressings')} ${t('clinicalSections.obs')}`,
      ];
      const topPadding = Array(header.length - 1).fill('');
      const secondPadding = Array(header.length - 2).fill('');
      const aoa = [
        [`${hospitalName} - ${floor.name}`, ...topPadding],
        [t('common.exportedBy', { name: exporterName, date: todayLabel }), ...secondPadding],
        [],
        header,
        ...rows.map((row: any) => [
          row.bedCode,
          row.status,
          row.name,
          row.process,
          row.age,
          row.sexShort,
          row.surgeon,
          row.specialty,
          row.surgery,
          row.observations,
          row.subsystem,
          row.allergies,
          row.entryDate,
          row.dischargeDate,
          row.cvp,
          row.therapy,
          row.dib,
          row.drainsFlag,
          row.drainsLocation,
          row.drainsBottleVolume,
          row.drainsTotalVolume,
          row.outputFlag,
          row.outputObs,
          row.urinationFlag,
          row.urinationObs,
          row.dressingsFlag,
          row.dressingsLocation,
          row.dressingsType,
          row.dressingsStatus,
          row.dressingsObs,
        ]),
      ];
      const ws = xlsx.utils.aoa_to_sheet(aoa);
      const excelWidths = [8, 8, 32, 14, 8, 6, 24, 22, 24, 36, 14, 20, 12, 12, 6, 6, 6, 8, 22, 14, 14, 8, 20, 8, 20, 8, 18, 16, 16, 20];
      ws['!cols'] = excelWidths.map(wch => ({ wch }));
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
      ];
      const headerRowIndex = 3;
      header.forEach((_, idx) => {
        const cell = xlsx.utils.encode_cell({ r: headerRowIndex, c: idx });
        if (ws[cell]) {
          ws[cell].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '0F3A5D' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          };
        }
      });
      const titleCell = xlsx.utils.encode_cell({ r: 0, c: 0 });
      if (ws[titleCell]) {
        ws[titleCell].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'left' } };
      }
      const infoCell = xlsx.utils.encode_cell({ r: 1, c: 0 });
      if (ws[infoCell]) {
        ws[infoCell].s = { font: { italic: true }, alignment: { horizontal: 'left' } };
      }
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Distribuicao');
      const safeName = floor.name.replace(/\s+/g, '_').toLowerCase();
      xlsx.writeFile(wb, `distribuicao_${safeName}_${todayLabel.replace(/\//g, '-')}.xlsx`);
      enqueueSnackbar(t('notifications.excelExported'), { variant: 'success' });
    } catch (error) {
      console.error(error);
      enqueueSnackbar(t('notifications.excelError'), { variant: 'error' });
    }
  };

  const buildSummaryRows = (floor: any) => {
    const rows = buildExportRows(floor);
    return rows.map(row => ({
      bedCode: row.bedCode,
      name: row.name || '',
      surgeon: row.surgeon || '',
      surgery: row.surgery || '',
      observations: row.observations || '',
      entryDate: row.entryDate,
      dischargeDate: row.dischargeDate,
    }));
  };

  const exportSelectedFloorSummaryPdf = async () => {
    const floor = getExportFloor();
    if (!floor) return;
    const rows = buildSummaryRows(floor);
    if (!rows.length) {
      enqueueSnackbar(t('notifications.noDataExport'), { variant: 'info' });
      return;
    }
    try {
      const hospitalName = settings.hospitalName || t('app.name');
      const jsPDFModule = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDFModule.default({ orientation: 'landscape', unit: 'pt', format: 'a3' });
      const logoData = await loadLogoDataUrl();
      if (logoData) {
        doc.addImage(logoData, 'PNG', 40, 18, 50, 50);
      }
      const headerX = logoData ? 100 : 40;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`${hospitalName} · ${t('dashboard.summaryTitle')} · ${floor.name}`, headerX, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(
        t('common.exportedBy', { name: exporterName, date: todayLabel }),
        headerX,
        58,
      );
      const header = [
        t('labels.bed'),
        t('labels.patient'),
        t('labels.surgeon'),
        t('labels.surgery'),
        t('labels.observations'),
        t('labels.entry'),
        t('labels.discharge'),
      ];
      const body = rows.map(row => [
        row.bedCode,
        row.name,
        row.surgeon,
        row.surgery,
        row.observations,
        row.entryDate,
        row.dischargeDate,
      ]);
      autoTable(doc, {
        head: [header],
        body,
        startY: 80,
        styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
        headStyles: { fillColor: [33, 94, 152], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 160, halign: 'left' },
          2: { cellWidth: 110, halign: 'left' },
          3: { cellWidth: 110, halign: 'left' },
          4: { cellWidth: 190, halign: 'left' },
          5: { cellWidth: 70 },
          6: { cellWidth: 70 },
        },
        theme: 'grid',
      });
      const safeName = floor.name.replace(/\s+/g, '_').toLowerCase();
      doc.save(`resumo_${safeName}_${todayLabel.replace(/\//g, '-')}.pdf`);
      enqueueSnackbar(t('notifications.pdfSummaryExported'), { variant: 'success' });
    } catch (error) {
      console.error(error);
      enqueueSnackbar(t('notifications.pdfSummaryError'), { variant: 'error' });
    }
  };

  const exportSelectedFloorSummaryExcel = async () => {
    const floor = getExportFloor();
    if (!floor) return;
    const rows = buildSummaryRows(floor);
    if (!rows.length) {
      enqueueSnackbar(t('notifications.noDataExport'), { variant: 'info' });
      return;
    }
    try {
      const xlsx = await import('xlsx');
      const header = [
        t('labels.bed'),
        t('labels.patient'),
        t('labels.surgeon'),
        t('labels.surgery'),
        t('labels.observations'),
        t('labels.entry'),
        t('labels.discharge'),
      ];
      const aoa = [
        [`${hospitalName} - ${t('dashboard.summaryTitle')} - ${floor.name}`, ...Array(header.length - 1).fill('')],
        [t('common.exportedBy', { name: exporterName, date: todayLabel }), ...Array(header.length - 2).fill('')],
        [],
        header,
        ...rows.map(row => [
          row.bedCode,
          row.name,
          row.surgeon,
          row.surgery,
          row.observations,
          row.entryDate,
          row.dischargeDate,
        ]),
      ];
      const ws = xlsx.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 10 }, { wch: 34 }, { wch: 24 }, { wch: 24 }, { wch: 44 }, { wch: 14 }, { wch: 14 }];
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
      ];
      const headerRowIndex = 3;
      header.forEach((_, idx) => {
        const cell = xlsx.utils.encode_cell({ r: headerRowIndex, c: idx });
        if (ws[cell]) {
          ws[cell].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '215E98' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          };
        }
      });
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Resumo');
      const safeName = floor.name.replace(/\s+/g, '_').toLowerCase();
      xlsx.writeFile(wb, `resumo_${safeName}_${todayLabel.replace(/\//g, '-')}.xlsx`);
      enqueueSnackbar(t('notifications.excelSummaryExported'), { variant: 'success' });
    } catch (error) {
      console.error(error);
      enqueueSnackbar(t('notifications.excelSummaryError'), { variant: 'error' });
    }
  };

  const handleBooleanField = async (bed: any, field: string, value: boolean) => {
    if (bed.isLocked && user?.role !== 'ADMIN') {
      enqueueSnackbar(t('dashboard.bedLocked'), { variant: 'warning' });
      return;
    }
    try {
      await axios.patch(`/api/beds/${bed.id}/clinical`, {
        field,
        value,
        reason: t('reasons.quickUpdate')
      });
      refreshFloors();
    } catch {
      enqueueSnackbar(t('notifications.clinicalUpdateError'), { variant: 'error' });
    }
  };

  const renderBooleanCell = (bed: any, field: string, helper?: string, isEnabled = true) => {
    const targetBed = (bed && (bed as any).__source) || bed;
    if (!isEnabled) {
      return (
        <TableCell sx={{ ...styles.dataCell, color: '#cfd8dc' }} align="center">
          —
        </TableCell>
      );
    }
    const current = !!bed.clinicalState?.[field];
    return (
      <TableCell sx={{ ...styles.dataCell, minWidth: 90 }} align="center">
        <ButtonGroup size="small" variant="outlined">
          <Button
            color="success"
            variant={current ? 'contained' : 'outlined'}
            onClick={() => handleBooleanField(targetBed, field, true)}
            disabled={!isEnabled}
          >
            {t('common.yes')}
          </Button>
          <Button
            color="warning"
            variant={!current ? 'contained' : 'outlined'}
            onClick={() => handleBooleanField(targetBed, field, false)}
            disabled={!isEnabled}
          >
            {t('common.no')}
          </Button>
        </ButtonGroup>
        {helper && (
          <Typography variant="caption" display="block" sx={{ mt: 0.5, color: '#607d8b' }}>
            {helper}
          </Typography>
        )}
      </TableCell>
    );
  };

  const renderCell = (bed: any, field: string) => {
    const targetBed = (bed && (bed as any).__source) || bed;
    const hasAdmission = !!(bed?.admissions?.length);
    const val = bed.clinicalState?.[field];
    return (
      <TableCell
        onClick={() => hasAdmission && handleClinicalEdit(targetBed, field, val)}
        sx={{
          ...styles.dataCell,
          cursor: hasAdmission ? 'pointer' : 'default',
          color: hasAdmission ? '#37474f' : '#b0bec5',
          ...(hasAdmission ? {} : { '&:hover': { backgroundColor: '#fff', boxShadow: 'none' } }),
        }}
        align="center"
        title={hasAdmission ? 'Clique para editar este registo clínico' : 'Disponível apenas com utente ativo'}
      >
        {val ? <span style={{ fontWeight: 500, color: '#37474f' }}>{val}</span> : <span style={{ color: '#cfd8dc' }}>-</span>}
      </TableCell>
    );
  };

  const renderAdminCell = (
    bed: any,
    field: string,
    label: string,
    value: any,
    config?: { multiline?: boolean; type?: 'text' | 'number' | 'select' | 'date'; choices?: { value: string; label: string }[]; cellSx?: any; formatter?: (val: any) => ReactNode }
  ) => {
    const actionBed = (bed && (bed as any).__source) || bed;
    const hasAdmission = bed.admissions?.length > 0;
    const display = config?.formatter ? config.formatter(value) : (value || '—');
    return (
      <TableCell
        sx={{
          ...styles.dataCell,
          cursor: hasAdmission ? 'pointer' : 'default',
          color: hasAdmission ? '#37474f' : '#b0bec5',
          ...config?.cellSx,
        }}
        onClick={() => hasAdmission && handleAdminField(actionBed, field, label, value, config)}
        title={hasAdmission ? `${t('labels.edit')} ${label}` : t('dashboard.noActivePatient')}
      >
        {typeof display === 'string' || typeof display === 'number' ? (
          display || <span style={{ color: '#cfd8dc' }}>-</span>
        ) : (
          display
        )}
      </TableCell>
    );
  };

  const renderDrainCell = (bed: any, key: 'location' | 'bottleVolume' | 'totalVolume', isEnabled = true) => {
    const targetBed = (bed && (bed as any).__source) || bed;
    if (!isEnabled) {
      return (
        <TableCell sx={{ ...styles.dataCell, color: '#cfd8dc' }} align="center">
          —
        </TableCell>
      );
    }
    const rows = getDrainRows(bed);
    const hasDrains = rows.some(d => d.location || d.bottleVolume || d.totalVolume);
    const labelPrefix =
      key === 'location'
        ? t('clinicalSections.location')
        : key === 'bottleVolume'
          ? t('clinicalSections.volumeBottle')
          : t('clinicalSections.volumeTotal');
    return (
      <TableCell
        onClick={() => handleDrainsEdit(targetBed)}
        sx={styles.dataCell}
        align="center"
        title={t('dashboard.manageDrains')}
      >
        {hasDrains ? (
          <Box sx={{ textAlign: 'left' }}>
            {rows.map((drain: any, idx: number) => (
              <Typography key={`${bed.id}-drain-${key}-${idx}`} variant="caption" display="block" color="#37474f">
                {`D${idx + 1} ${labelPrefix}: ${drain[key] || '-'}`}
              </Typography>
            ))}
          </Box>
        ) : (
                          <span style={{ color: '#cfd8dc' }}>{t('dashboard.noDrains')}</span>
        )}
      </TableCell>
    );
  };

  const renderDressingCell = (bed: any, key: 'location' | 'type' | 'status' | 'obs', isEnabled = true) => {
    const targetBed = (bed && (bed as any).__source) || bed;
    if (!isEnabled) {
      return (
        <TableCell sx={{ ...styles.dataCell, color: '#cfd8dc' }} align="center">
          —
        </TableCell>
      );
    }
    const rows = getDressingRows(bed);
    const hasDressings = rows.some(d => d.location || d.type || d.status || d.obs);
    return (
      <TableCell
        onClick={() => handleDressingsEdit(targetBed)}
        sx={styles.dataCell}
        align="center"
        title={t('dashboard.manageDressings')}
      >
        {hasDressings ? (
          <Box sx={{ textAlign: 'left' }}>
            {rows.map((dressing: any, idx: number) => (
              <Typography key={`${bed.id}-dressing-${key}-${idx}`} variant="caption" display="block" color="#37474f">
                {`P${idx + 1}: ${dressing[key] || '-'}`}
              </Typography>
            ))}
          </Box>
        ) : (
          <span style={{ color: '#cfd8dc' }}>{t('dashboard.noDressings')}</span>
        )}
      </TableCell>
    );
  };

  const openAuditModal = async (bed: any) => {
    if (!isCoordinator) return;
    setAuditModalBed(bed);
    setAuditLoading(true);
    try {
      const { data } = await axios.get(`/api/beds/${bed.id}/history`);
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch {
      enqueueSnackbar(t('notifications.auditsLoadError'), { variant: 'error' });
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const closeAuditModal = () => {
    setAuditModalBed(null);
    setAuditLogs([]);
  };

  const handleCreateUser = async () => {
    if (!userForm.username || !userForm.fullName || !userForm.password) {
      enqueueSnackbar(t('notifications.userFieldsRequired'), { variant: 'warning' });
      return;
    }
    setUserActionLoading(true);
    try {
      await axios.post('/api/auth/users', userForm);
      enqueueSnackbar(t('notifications.userCreated'), { variant: 'success' });
      setUserForm({ username: '', fullName: '', password: '', role: 'NURSE' });
      fetchUsersList();
    } catch (e: any) {
      enqueueSnackbar(`${t('notifications.userCreateError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm(t('prompts.removeUserConfirm'))) return;
    setUserActionLoading(true);
    try {
      await axios.delete(`/api/auth/users/${id}`);
      enqueueSnackbar(t('notifications.userRemoved'), { variant: 'success' });
      fetchUsersList();
    } catch (e: any) {
      enqueueSnackbar(`${t('notifications.userRemoveError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    } finally {
      setUserActionLoading(false);
    }
  };

  const openResetPasswordDialog = (userToReset: any) => {
    setResetPasswordUser(userToReset);
    setResetPasswordValue('');
    setResetPasswordSaving(false);
  };

  const closeResetPasswordDialog = () => {
    setResetPasswordUser(null);
    setResetPasswordValue('');
    setResetPasswordSaving(false);
  };

  const handleResetUserPassword = async () => {
    if (!resetPasswordUser) return;
    if (!resetPasswordValue || resetPasswordValue.length < 8) {
      enqueueSnackbar(t('notifications.passwordTooShort'), { variant: 'warning' });
      return;
    }
    setResetPasswordSaving(true);
    try {
      await axios.patch(`/api/auth/users/${resetPasswordUser.id}/password`, { newPassword: resetPasswordValue });
      enqueueSnackbar(t('notifications.passwordResetDone'), { variant: 'success' });
      closeResetPasswordDialog();
    } catch (e: any) {
      enqueueSnackbar(`${t('notifications.passwordResetError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
      setResetPasswordSaving(false);
    }
  };

  const floorsToDisplay = selectedFloor === 'ALL' ? floors : floors.filter(f => f.id === selectedFloor);

  const getDate = (d: string) => { try { return d ? format(new Date(d), 'dd/MM') : ''; } catch { return ''; } };
  const formatDateTime = (d?: string) => { try { return d ? format(new Date(d), 'dd/MM HH:mm') : '—'; } catch { return '—'; } };
  const getIsoDate = (value?: string) => (value ? value.substring(0, 10) : '');
  const isChildAdmission = (admission?: any) => typeof admission?.ageYears === 'number' && admission.ageYears < 18;
  const getSpecialtyVisuals = (value?: string) => {
    if (!value) return { bg: '#fafafa', color: '#607d8b' };
    return specialtyColors[value] || { bg: '#fafafa', color: '#37474f' };
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#f7fbff', minHeight: '100vh' }}>
      {isAdmin ? (
        <Paper sx={{ mb: 3, p: 3, borderRadius: 3, boxShadow: 6, background: 'linear-gradient(120deg,#022c44 0%,#00466b 60%,#026c9f 100%)', color: '#fff' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1, minWidth: 280 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{hospitalName}</Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>{t('dashboard.adminTitle')} · {t('dashboard.adminSubtitle')}</Typography>
              <Chip label={t('roles.admin')} color="secondary" variant="filled" sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
            </Box>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<LockResetIcon />}
              onClick={() => setChangePasswordOpen(true)}
            >
              {t('dashboard.editPassword')}
            </Button>
          </Box>
        </Paper>
      ) : (
        <Paper sx={{ mb: 3, p: 3, borderRadius: 3, boxShadow: 6, background: 'linear-gradient(120deg,#003654 0%,#005c8a 60%,#0d7bbd 100%)', color: '#fff' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1, minWidth: 280 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{hospitalName}</Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>{t('app.headerSubtitle')}</Typography>
              <Chip label={t('dashboard.editableCells')} color="secondary" variant="filled" sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="floor-filter-label" sx={{ color: '#fff' }}>{t('dashboard.selectUnit')}</InputLabel>
                <Select
                  labelId="floor-filter-label"
                  value={selectedFloor}
                  label={t('dashboard.selectUnit')}
                  onChange={handleFloorChange}
                  sx={{
                    color: '#fff',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.7)' },
                    '.MuiSvgIcon-root': { color: '#fff' },
                  }}
                >
                  <MenuItem value="">
                    <em>{t('dashboard.selectUnit')}</em>
                  </MenuItem>
                  <MenuItem value="ALL">{t('dashboard.allUnits')}</MenuItem>
                  {floors.map((floor: any) => (
                    <MenuItem key={floor.id} value={floor.id}>{floor.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                color="inherit"
                onClick={refreshFloors}
                startIcon={<RefreshIcon />}
                disabled={floorsLoading}
                sx={{ borderColor: 'rgba(255,255,255,0.7)' }}
              >
                {floorsLoading ? t('dashboard.updateNow') : t('common.refresh')}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<PictureAsPdfIcon />}
                onClick={exportSelectedFloorPdf}
                disabled={!selectedFloor || selectedFloor === 'ALL'}
              >
                {t('dashboard.exportPdf')}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<FileDownloadIcon />}
                onClick={exportSelectedFloorExcel}
                disabled={!selectedFloor || selectedFloor === 'ALL'}
              >
                {t('dashboard.exportExcel')}
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<PictureAsPdfIcon />}
                onClick={exportSelectedFloorSummaryPdf}
                disabled={!selectedFloor || selectedFloor === 'ALL'}
                sx={{ borderColor: 'rgba(255,255,255,0.7)' }}
              >
                {t('dashboard.summaryPdf')}
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<FileDownloadIcon />}
                onClick={exportSelectedFloorSummaryExcel}
                disabled={!selectedFloor || selectedFloor === 'ALL'}
                sx={{ borderColor: 'rgba(255,255,255,0.7)' }}
              >
                {t('dashboard.summaryExcel')}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<LockResetIcon />}
                onClick={() => setChangePasswordOpen(true)}
              >
                {t('dashboard.editPassword')}
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {!isAdmin && !selectedFloor && (
        <Paper sx={{ mb: 3, p: 3, borderRadius: 3, border: '1px dashed #90caf9', bgcolor: '#e3f2fd' }}>
          <Typography variant="h6" sx={{ color: '#0d47a1', fontWeight: 600 }}>
            {t('dashboard.selectUnitTop')}
          </Typography>
          <Typography variant="body2" sx={{ color: '#0d47a1' }}>
            {t('dashboard.selectUnitTopDesc')}
          </Typography>
        </Paper>
      )}

      {isAdmin && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>{t('dashboard.manageUsers')}</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label={t('labels.username')}
                    fullWidth
                    size="small"
                    value={userForm.username}
                    onChange={e => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label={t('labels.fullName')}
                    fullWidth
                    size="small"
                    value={userForm.fullName}
                    onChange={e => setUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label={t('login.password')}
                    type="password"
                    fullWidth
                    size="small"
                    value={userForm.password}
                    onChange={e => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="role-select-admin">{t('labels.role')}</InputLabel>
                    <Select
                      labelId="role-select-admin"
                      value={userForm.role}
                      label={t('labels.role')}
                      onChange={e => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                    >
                      <MenuItem value="NURSE">{t('roles.nurse')}</MenuItem>
                      <MenuItem value="COORDINATOR">{t('roles.coordinator')}</MenuItem>
                      <MenuItem value="ADMIN">{t('roles.admin')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={7}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="medium"
                    onClick={handleCreateUser}
                    disabled={userActionLoading}
                  >
                    {t('dashboard.createUser')}
                  </Button>
                </Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              {usersLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={styles.headerCell}>{t('labels.patient')}</TableCell>
                      <TableCell sx={styles.headerCell}>{t('labels.username')}</TableCell>
                      <TableCell sx={styles.headerCell}>{t('labels.role')}</TableCell>
                      <TableCell sx={styles.headerCell}>{t('labels.active')}</TableCell>
                      <TableCell sx={styles.headerCell}>{t('labels.createdAt')}</TableCell>
                      <TableCell sx={styles.headerCell}>{t('labels.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usersList.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.fullName}</TableCell>
                        <TableCell>{u.username}</TableCell>
                        <TableCell>
                          <Chip label={u.role} color={u.role === 'ADMIN' ? 'error' : u.role === 'COORDINATOR' ? 'primary' : 'default'} size="small" />
                        </TableCell>
                        <TableCell>{u.isActive ? t('common.yes') : t('common.no')}</TableCell>
                        <TableCell>{formatDateTime(u.createdAt)}</TableCell>
                        <TableCell>
                          <Tooltip title={u.id === user?.id ? t('user.cannotRemoveSelf') : t('user.removeUser')}>
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={userActionLoading || u.id === user?.id}
                                onClick={() => handleDeleteUser(u.id)}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={t('user.resetPassword')}>
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                disabled={userActionLoading}
                                onClick={() => openResetPasswordDialog(u)}
                              >
                                <LockResetIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {(!isAdmin && !selectedFloor) && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3, boxShadow: 4 }}>
          <Typography variant="h6">{t('dashboard.selectUnitTop')}</Typography>
          <Typography color="text.secondary">{t('dashboard.selectUnitTopDesc')}</Typography>
        </Paper>
      )}

      {!isAdmin && selectedFloor && floorsToDisplay.map((f: any) => {
        const isCleared = !!clearedFloors[f.id];
        const sortedBeds = [...(f.beds || [])].sort((a, b) => compareBedCodes(a.code || '', b.code || ''));
        return (
          <Paper key={f.id} sx={{ mb: 4, borderRadius: 3, overflow: 'hidden', boxShadow: 5 }}>
            <Box sx={styles.floorHeader}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
              >
                <Box>
                  <Typography variant="h6">{f.name.toUpperCase()}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85, letterSpacing: 0.3 }}>
                    {t('dashboard.floorHeaderHint')} · {hospitalName}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {isCleared && (
                    <Chip
                      label={t('dashboard.clearedView')}
                      size="small"
                      sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }}
                    />
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    color="inherit"
                    startIcon={isCleared ? <RefreshIcon fontSize="small" /> : <DeleteOutlineIcon fontSize="small" />}
                    onClick={() => toggleFloorClear(f.id)}
                    sx={{ borderColor: 'rgba(255,255,255,0.7)', textTransform: 'none' }}
                  >
                    {isCleared ? t('dashboard.restoreView') : t('dashboard.clearView')}
                  </Button>
                </Stack>
              </Stack>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                Situação do dia {todayLabel}
              </Typography>
            </Box>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, minWidth: 60, bgcolor: '#fff' }}>{t('labels.bed')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, width: 30, bgcolor: '#fff' }}><LockIcon fontSize="small" /></TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, minWidth: 180, bgcolor: '#e3f2fd', color: '#0d47a1' }}>{t('labels.patient')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e3f2fd', color: '#0d47a1' }}>{t('labels.age')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e3f2fd', color: '#0d47a1' }}>{t('labels.sex')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e3f2fd', color: '#0d47a1' }}>{t('labels.surgeon')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e3f2fd', color: '#0d47a1' }}>{t('labels.specialty')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e3f2fd', color: '#0d47a1' }}>{t('labels.surgery')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e3f2fd', color: '#0d47a1' }}>{t('labels.observations')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e3f2fd', color: '#0d47a1' }}>{t('labels.subsystem')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e3f2fd', color: '#0d47a1' }}>{t('labels.allergies')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e3f2fd', color: '#0d47a1' }}>{t('labels.entry')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e3f2fd', color: '#0d47a1' }}>{t('labels.discharge')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e0f7fa', color: '#006064' }}>CVP</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e0f7fa', color: '#006064' }}>{t('clinical.therapy_exists')}</TableCell>
                  <TableCell rowSpan={2} sx={{ ...styles.headerCell, bgcolor: '#e0f7fa', color: '#006064' }}>DIB</TableCell>
                  <TableCell colSpan={3} sx={{ ...styles.headerCell, bgcolor: '#e0f2f1', color: '#00695c' }}>{t('clinicalSections.drains')}</TableCell>
                  <TableCell colSpan={2} sx={{ ...styles.headerCell, bgcolor: '#fff3e0', color: '#e65100' }}>{t('clinicalSections.output')}</TableCell>
                  <TableCell colSpan={2} sx={{ ...styles.headerCell, bgcolor: '#f3e5f5', color: '#4a148c' }}>{t('clinicalSections.urination')}</TableCell>
                  <TableCell colSpan={4} sx={{ ...styles.headerCell, bgcolor: '#f1f8e9', color: '#1b5e20' }}>{t('clinicalSections.dressings')}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ ...styles.headerCell, bgcolor: '#e0f2f1' }}>{t('clinicalSections.location')}</TableCell>
                  <TableCell sx={{ ...styles.headerCell, bgcolor: '#e0f2f1' }}>{t('clinicalSections.volumeBottle')}</TableCell>
                  <TableCell sx={{ ...styles.headerCell, bgcolor: '#e0f2f1' }}>{t('clinicalSections.volumeTotal')}</TableCell>
                  <TableCell sx={{ ...styles.headerCell, bgcolor: '#fff3e0' }}>{t('clinicalSections.yesNo')}</TableCell>
                  <TableCell sx={{ ...styles.headerCell, bgcolor: '#fff3e0' }}>{t('clinicalSections.obs')}</TableCell>
                  <TableCell sx={{ ...styles.headerCell, bgcolor: '#f3e5f5' }}>{t('clinicalSections.yesNo')}</TableCell>
                  <TableCell sx={{ ...styles.headerCell, bgcolor: '#f3e5f5' }}>{t('clinicalSections.obs')}</TableCell>
                  <TableCell sx={{ ...styles.headerCell, bgcolor: '#f1f8e9' }}>{t('clinicalSections.location')}</TableCell>
                  <TableCell sx={{ ...styles.headerCell, bgcolor: '#f1f8e9' }}>{t('clinicalSections.type')}</TableCell>
                  <TableCell sx={{ ...styles.headerCell, bgcolor: '#f1f8e9' }}>{t('clinicalSections.status')}</TableCell>
                  <TableCell sx={{ ...styles.headerCell, bgcolor: '#f1f8e9' }}>{t('clinicalSections.obs')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedBeds.map((bed: any, idx: number) => {
                  const viewBed = isCleared ? { ...bed, admissions: [], clinicalState: {}, __source: bed } : bed;
                  const sourceBed = (viewBed as any).__source || viewBed;
                  const adm = viewBed.admissions?.[0];
                  const hasAdmission = !!adm;
                  const specialtyValue = adm?.meta?.specialty || '';
                  const adminObservations = adm?.meta?.observations || '';
                  const subsystem = adm?.utente?.subsystem || '';
                  const specialtyVisual = getSpecialtyVisuals(specialtyValue);
                  const entryIso = getIsoDate(adm?.entryDate);
                  const dischargeIso = getIsoDate(adm?.dischargeDate);
                  const isChild = isChildAdmission(adm);
                  const rowStyle = bed.isLocked
                    ? styles.lockedRow
                    : isChild
                      ? { backgroundColor: '#fffde7' }
                      : { backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' };
                  const hasAllergies = !!adm?.meta?.allergies;
                  return (
                    <TableRow key={bed.id} sx={rowStyle} hover>
                      <TableCell
                        sx={{ fontWeight: 'bold', borderRight: '1px solid #ddd', textAlign: 'center', cursor: 'pointer' }}
                        onClick={() => openBedDetail(bed)}
                        title="Ver detalhe completo"
                      >
                        {bed.code}
                        <OpenInNewIcon fontSize="inherit" sx={{ ml: 0.5, verticalAlign: 'middle', fontSize: '0.85rem', color: '#78909c' }} />
                      </TableCell>
                      <TableCell sx={{ borderRight: '1px solid #ddd', p: 0, textAlign: 'center' }}>
                        <IconButton size="small" onClick={() => toggleLock(bed)}>
                          {bed.isLocked ? <LockIcon color="error" fontSize="small" /> : <LockOpenIcon color="disabled" fontSize="small" style={{ opacity: 0.3 }} />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ borderRight: '1px solid #ddd', p: 1 }}>
                        {isCleared ? (
                          <Typography variant="body2" color="#cfd8dc">
                            —
                          </Typography>
                        ) : adm ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Box>
                              <Typography
                                variant="body2"
                                fontWeight="600"
                                color="#263238"
                                sx={{ cursor: 'pointer' }}
                                onClick={() => handleAdminField(sourceBed, 'name', t('labels.patient'), adm.utente.name, { type: 'text' })}
                              >
                                {adm.utente.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                sx={{ display: 'block', cursor: 'pointer' }}
                                onClick={() => handleAdminField(sourceBed, 'processNumber', t('labels.process'), adm.utente.processNumber || '', { type: 'text' })}
                              >
                                {adm.utente.processNumber || t('labels.noProcess')}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title={t('dashboard.editAdmin')}>
                                <IconButton size="small" color="primary" onClick={() => openAdminModal(sourceBed)}>
                                  <EditNoteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {isCoordinator && (
                                <Tooltip title={t('dashboard.auditForBed')}>
                                  <IconButton size="small" color="secondary" onClick={() => openAuditModal(bed)}>
                                    <HistoryEduIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {isCoordinator && (
                                <Tooltip title={t('dashboard.clearBed')}>
                                  <IconButton size="small" color="warning" onClick={() => handleClearBed(sourceBed)}>
                                    <CleaningServicesIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title={t('dashboard.dischargeAction')}>
                                <IconButton size="small" color="error" onClick={() => handleDischarge(bed)}>
                                  <PersonRemoveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        ) : (
                          <Button
                            startIcon={<PersonAddIcon />}
                            size="small"
                            onClick={() => handleAdmitClick(sourceBed)}
                            sx={{ textTransform: 'none', color: '#78909c' }}
                            disabled={bed.isLocked}
                          >
                            {t('dashboard.admit')}
                          </Button>
                        )}
                      </TableCell>
                      {renderAdminCell(viewBed, 'ageYears', t('labels.age'), adm?.ageYears ?? '', {
                        type: 'number',
                        formatter: (val: any) => (val || val === 0 ? `${val} ${t('labels.ageUnit')}` : '—')
                      })}
                      {renderAdminCell(viewBed, 'sex', t('labels.sex'), adm?.sex || '', {
                        type: 'select',
                        choices: sexOptions
                      })}
                      {renderAdminCell(viewBed, 'surgeon', t('labels.surgeon'), adm?.surgeon || '', { type: 'text', cellSx: { textAlign: 'left' } })}
                      {renderAdminCell(viewBed, 'specialty', t('labels.specialty'), specialtyValue, {
                        type: 'select',
                        choices: specialtyOptions,
                        cellSx: { backgroundColor: specialtyVisual.bg, color: specialtyVisual.color, fontWeight: 600, textAlign: 'left' },
                        formatter: (val: any) => val || '—'
                      })}
                      {renderAdminCell(viewBed, 'surgery', t('labels.surgery'), adm?.surgery || '', { type: 'text', cellSx: { textAlign: 'left' } })}
                      {renderAdminCell(viewBed, 'observations', t('labels.observations'), adminObservations, {
                        multiline: true,
                        type: 'text',
                        cellSx: { textAlign: 'left' },
                        formatter: (val: any) => (
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: val ? '#37474f' : '#b0bec5' }}>
                            {val || '—'}
                          </Typography>
                        )
                      })}
                      {renderAdminCell(viewBed, 'subsystem', t('labels.subsystem'), subsystem, {
                        type: 'select',
                        choices: subsystemOptions,
                        cellSx: { textAlign: 'left' },
                      })}
                      {renderAdminCell(viewBed, 'allergies', t('labels.allergies'), adm?.meta?.allergies || '', {
                        multiline: true,
                        type: 'text',
                        cellSx: {
                          textAlign: 'left',
                          ...(hasAllergies
                            ? { backgroundColor: '#ffebee', color: '#b71c1c', fontWeight: 600 }
                            : {}),
                        },
                        formatter: (val: any) => (
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: val ? '#37474f' : '#b0bec5' }}>
                            {val || '—'}
                          </Typography>
                        )
                      })}
                      {renderAdminCell(viewBed, 'entryDate', t('labels.entry'), entryIso, {
                        type: 'date',
                        formatter: (val: any) => (val ? getDate(val) : '—')
                      })}
                      {renderAdminCell(viewBed, 'dischargeDate', t('labels.discharge'), dischargeIso, {
                        type: 'date',
                        formatter: (val: any) => (val ? getDate(val) : '—')
                      })}
                      {renderBooleanCell(viewBed, 'cvp_exists', undefined, hasAdmission)}
                      {renderBooleanCell(viewBed, 'therapy_exists', undefined, hasAdmission)}
                      {renderBooleanCell(viewBed, 'dib_exists', undefined, hasAdmission)}
                      {renderDrainCell(viewBed, 'location', hasAdmission)}
                      {renderDrainCell(viewBed, 'bottleVolume', hasAdmission)}
                      {renderDrainCell(viewBed, 'totalVolume', hasAdmission)}
                      {renderBooleanCell(viewBed, 'output_exists', undefined, hasAdmission)}
                      {renderCell(viewBed, 'output_obs')}
                      {renderBooleanCell(viewBed, 'urination_exists', undefined, hasAdmission)}
                      {renderCell(viewBed, 'urination_obs')}
                      {renderDressingCell(viewBed, 'location', hasAdmission)}
                      {renderDressingCell(viewBed, 'type', hasAdmission)}
                      {renderDressingCell(viewBed, 'status', hasAdmission)}
                      {renderDressingCell(viewBed, 'obs', hasAdmission)}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          </Paper>
        );
      })}

      <Dialog open={!!detailBed} onClose={closeBedDetail} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#e3f2fd', color: '#0d47a1' }}>
          {t('dashboard.fullRecord')} · {detailBed?.code}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('labels.name')} value={detailForm.name} onChange={e => setDetailForm(prev => ({ ...prev, name: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('labels.process')} value={detailForm.processNumber} onChange={e => setDetailForm(prev => ({ ...prev, processNumber: e.target.value }))} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth type="number" label={t('labels.age')} value={detailForm.ageYears} onChange={e => setDetailForm(prev => ({ ...prev, ageYears: e.target.value }))} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                select
                fullWidth
                label={t('labels.sex')}
                value={detailForm.sex}
                onChange={e => setDetailForm(prev => ({ ...prev, sex: e.target.value }))}
                SelectProps={{ native: false }}
              >
                <MenuItem value="">
                  <em>{t('common.none')}</em>
                </MenuItem>
                {sexOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('labels.surgeon')} value={detailForm.surgeon} onChange={e => setDetailForm(prev => ({ ...prev, surgeon: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('labels.surgery')} value={detailForm.surgery} onChange={e => setDetailForm(prev => ({ ...prev, surgery: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label={t('labels.specialty')}
                value={detailForm.specialty}
                onChange={e => setDetailForm(prev => ({ ...prev, specialty: e.target.value }))}
                SelectProps={{ native: false }}
              >
                <MenuItem value="">
                  <em>{t('common.none')}</em>
                </MenuItem>
                {specialtyOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label={t('labels.subsystem')}
                value={detailForm.subsystem}
                onChange={e => setDetailForm(prev => ({ ...prev, subsystem: e.target.value }))}
                SelectProps={{ native: false }}
              >
                <MenuItem value="">
                  <em>{t('common.none')}</em>
                </MenuItem>
                {subsystemOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label={t('labels.observations')}
                value={detailForm.observations}
                onChange={e => setDetailForm(prev => ({ ...prev, observations: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label={t('labels.allergies')}
                value={detailForm.allergies}
                onChange={e => setDetailForm(prev => ({ ...prev, allergies: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label={t('labels.entry')}
                value={detailForm.entryDate}
                onChange={e => setDetailForm(prev => ({ ...prev, entryDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label={t('labels.discharge')}
                value={detailForm.dischargeDate}
                onChange={e => setDetailForm(prev => ({ ...prev, dischargeDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" sx={{ mb: 1 }}>{t('dashboard.clinicalState')}</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {Object.keys(clinicalBooleanLabels).map(field => (
              <Chip
                key={field}
                label={`${clinicalBooleanLabels[field]}: ${detailBed?.clinicalState?.[field] ? t('common.yes') : t('common.no')}`}
                color={detailBed?.clinicalState?.[field] ? 'success' : 'default'}
                size="small"
              />
            ))}
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={() => detailBed && handleDrainsEdit(detailBed)}>
              {t('dashboard.manageDrains')}
            </Button>
            <Button variant="outlined" onClick={() => detailBed && handleDressingsEdit(detailBed)}>
              {t('dashboard.manageDressings')}
            </Button>
            {isCoordinator && detailBed && (
              <Button variant="outlined" onClick={() => openAuditModal(detailBed)}>
                {t('dashboard.audit')}
              </Button>
            )}
          </Stack>
          <TextField
            fullWidth
            sx={{ mt: 3 }}
            label={t('labels.changeReason')}
            value={detailReason}
            onChange={e => setDetailReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBedDetail}>{t('common.close')}</Button>
          <Button variant="contained" onClick={saveDetailData}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!resetPasswordUser} onClose={closeResetPasswordDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#fff8e1', color: '#e65100' }}>
          {t('user.resetPassword')} · {resetPasswordUser?.fullName || resetPasswordUser?.username}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('dashboard.resetPasswordHint')}
          </Typography>
          <TextField
            label={t('labels.newPassword')}
            type="password"
            fullWidth
            size="small"
            value={resetPasswordValue}
            onChange={e => setResetPasswordValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResetPasswordDialog}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleResetUserPassword}
            disabled={resetPasswordSaving || !resetPasswordValue}
          >
            {t('user.resetPassword')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={changePasswordOpen} onClose={closeChangePassword} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#ede7f6', color: '#4a148c' }}>{t('dashboard.editPassword')}</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            fullWidth
            margin="dense"
            type="password"
            label={t('labels.currentPassword')}
            value={passwordForm.current}
            onChange={e => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
          />
          <TextField
            fullWidth
            margin="dense"
            type="password"
            label={t('labels.newPassword')}
            value={passwordForm.next}
            onChange={e => setPasswordForm(prev => ({ ...prev, next: e.target.value }))}
          />
          <TextField
            fullWidth
            margin="dense"
            type="password"
            label={t('labels.confirmPassword')}
            value={passwordForm.confirm}
            onChange={e => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeChangePassword}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleChangePassword} disabled={passwordSaving}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!auditModalBed} onClose={closeAuditModal} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#f5f5f5' }}>{t('dashboard.audit')} - {auditModalBed?.code}</DialogTitle>
        <DialogContent dividers>
          {auditLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={30} />
            </Box>
          ) : auditLogs.length === 0 ? (
            <Typography>Nenhum registo de auditoria para esta cama.</Typography>
          ) : (
            <List>
              {auditLogs.map((log: any) => (
                <ListItem key={log.id} alignItems="flex-start" divider>
                  <ListItemText
                    primary={`${format(new Date(log.timestamp), 'dd/MM HH:mm')} · ${log.user?.fullName || t('labels.user')} (${log.user?.role || '—'})`}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary">
                          {`Ação: ${log.action} · Motivo: ${log.reason}`}
                        </Typography>
                        {log.diff && (
                          <Typography component="pre" variant="caption" sx={{ mt: 1, bgcolor: '#f1f1f1', p: 1, borderRadius: 1 }}>
                            {JSON.stringify(log.diff, null, 2)}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAuditModal}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingCell} onClose={() => setEditingCell(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#eceff1', color: '#37474f' }}>
          {editingCell ? `${editingCell.label} · ${editingCell.bed?.code}` : t('labels.edit')}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {editingCell?.inputType === 'select' ? (
            <FormControl fullWidth margin="dense">
              <InputLabel>{editingCell.label}</InputLabel>
              <Select
                label={editingCell.label}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
              >
                <MenuItem value="">
                  <em>{t('common.none')}</em>
                </MenuItem>
                {(editingCell.options || []).map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <TextField
              fullWidth
              autoFocus
              margin="dense"
              label={editingCell?.label || t('labels.value')}
              variant="outlined"
              type={editingCell?.inputType === 'number' ? 'number' : editingCell?.inputType === 'date' ? 'date' : 'text'}
              multiline={!!editingCell?.multiline}
              minRows={editingCell?.multiline ? 3 : 1}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              InputLabelProps={editingCell?.inputType === 'date' ? { shrink: true } : undefined}
            />
          )}
          <TextField fullWidth margin="dense" label={t('labels.changeReason')} variant="outlined" value={editReason} onChange={e => setEditReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingCell(null)}>{t('common.cancel')}</Button>
          <Button onClick={saveEdit} variant="contained" disableElevation>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!drainsModalBed} onClose={closeDrainsModal} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#e0f2f1', color: '#00695c' }}>
          {t('dashboard.drainsTitle')} - {t('labels.bed')} {drainsModalBed?.code}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {t('dashboard.drainsHint')}
          </Typography>
          {drainsForm.map((drain, idx) => (
            <Grid container spacing={2} alignItems="center" key={`drain-row-${idx}`} sx={{ mb: 1 }}>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  label={`D${idx + 1} ${t('clinicalSections.location')}`}
                  value={drain.location}
                  onChange={e => updateDrainField(idx, 'location', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label={t('clinicalSections.volumeBottle')}
                  value={drain.bottleVolume}
                  onChange={e => updateDrainField(idx, 'bottleVolume', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label={t('clinicalSections.volumeTotal')}
                  value={drain.totalVolume}
                  onChange={e => updateDrainField(idx, 'totalVolume', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={1} sx={{ textAlign: 'center' }}>
                <IconButton onClick={() => removeDrainRow(idx)} color="error" size="small" disabled={drainsForm.length === 1}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 1 }}>
            <Button startIcon={<AddCircleOutlineIcon />} onClick={addDrainRow} disabled={drainsForm.length >= 5}>
              {t('dashboard.addDrain')}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDrainsModal}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveDrains} disableElevation>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!dressingsModalBed} onClose={closeDressingsModal} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#f1f8e9', color: '#1b5e20' }}>
          {t('dashboard.dressingsTitle')} - {t('labels.bed')} {dressingsModalBed?.code}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {t('dashboard.dressingsHint')}
          </Typography>
          {dressingsForm.map((dressing, idx) => (
            <Grid container spacing={2} alignItems="center" key={`dressing-row-${idx}`} sx={{ mb: 1 }}>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth label={`P${idx + 1} ${t('clinicalSections.location')}`} value={dressing.location} onChange={e => updateDressingField(idx, 'location', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth label={t('clinicalSections.type')} value={dressing.type} onChange={e => updateDressingField(idx, 'type', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth label={t('clinicalSections.status')} value={dressing.status} onChange={e => updateDressingField(idx, 'status', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField fullWidth label={t('labels.observations')} value={dressing.obs} onChange={e => updateDressingField(idx, 'obs', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={1} sx={{ textAlign: 'center' }}>
                <IconButton onClick={() => removeDressingRow(idx)} color="error" size="small" disabled={dressingsForm.length === 1}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 1 }}>
            <Button startIcon={<AddCircleOutlineIcon />} onClick={addDressingRow} disabled={dressingsForm.length >= 5}>
              {t('dashboard.addDressing')}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDressingsModal}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveDressings} disableElevation>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!admittingBed} onClose={() => setAdmittingBed(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#e3f2fd', color: '#0d47a1' }}>
          {t('dashboard.admitTitle')} - {t('labels.bed')} {admittingBed?.code}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('labels.fullName')}
                value={admitData.name}
                onChange={e => setAdmitData({ ...admitData, name: e.target.value })}
                variant="filled"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdmittingBed(null)}>{t('common.cancel')}</Button>
          <Button onClick={saveAdmit} variant="contained" color="primary" disableElevation>{t('dashboard.admit')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!adminModalBed} onClose={closeAdminModal} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#f0f4ff', color: '#0d3c5a' }}>
          {t('dashboard.adminDataTitle')} - {adminModalBed?.code}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth label={t('labels.patient')} value={adminForm.name} onChange={e => setAdminForm(prev => ({ ...prev, name: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label={t('labels.process')} value={adminForm.processNumber} onChange={e => setAdminForm(prev => ({ ...prev, processNumber: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label={t('labels.birthDate')} value={adminForm.birthDate} onChange={e => setAdminForm(prev => ({ ...prev, birthDate: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label={t('labels.surgeon')} value={adminForm.surgeon} onChange={e => setAdminForm(prev => ({ ...prev, surgeon: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label={t('labels.surgery')} value={adminForm.surgery} onChange={e => setAdminForm(prev => ({ ...prev, surgery: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label={t('labels.specialty')}
                value={adminForm.specialty}
                onChange={e => setAdminForm(prev => ({ ...prev, specialty: e.target.value }))}
                SelectProps={{ native: false }}
              >
                <MenuItem value="">
                  <em>{t('common.none')}</em>
                </MenuItem>
                {specialtyOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label={t('labels.subsystem')}
                value={adminForm.subsystem}
                onChange={e => setAdminForm(prev => ({ ...prev, subsystem: e.target.value }))}
                SelectProps={{ native: false }}
              >
                <MenuItem value="">
                  <em>{t('common.none')}</em>
                </MenuItem>
                {subsystemOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label={t('labels.discharge')} value={adminForm.dischargeDate} onChange={e => setAdminForm(prev => ({ ...prev, dischargeDate: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={t('labels.observations')} value={adminForm.observations} multiline minRows={2} onChange={e => setAdminForm(prev => ({ ...prev, observations: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={t('labels.allergies')} value={adminForm.allergies} multiline minRows={2} onChange={e => setAdminForm(prev => ({ ...prev, allergies: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={t('labels.changeReason')} value={adminReason} onChange={e => setAdminReason(e.target.value)} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAdminModal}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveAdministrativeData} disableElevation>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
