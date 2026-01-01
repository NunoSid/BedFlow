import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  Button,
  CircularProgress,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  MenuItem,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import EventNoteIcon from '@mui/icons-material/EventNote';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import axios from 'axios';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../context/SettingsContext';
import { loadLogoDataUrl } from '../utils/pdfLogo';
import { getSpecialtyOptions, getSexOptions, getSubsystemOptions, specialtyColors } from '../constants/clinicalOptions';

const sanitizeSubsystem = (value?: string | null, allowed?: Set<string>) => {
  if (!value) return null;
  const normalized = value.toUpperCase().trim();
  return allowed?.has(normalized) ? normalized : null;
};

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
      const diff = parseInt(a, 10) - parseInt(b, 10);
      if (diff !== 0) return diff;
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

type PlanningBoardState = {
  date: string;
  rows: any[];
  loading: boolean;
  saving: string | null;
};

const createPlanningForm = () => ({
  utenteName: '',
  utenteProcessNumber: '',
  ageYears: '',
  sex: '',
  surgeon: '',
  specialty: '',
  surgery: '',
  subsystem: '',
  observations: '',
  allergies: '',
  entryDate: '',
  dischargeDate: '',
});

export const PlanningPage = () => {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const specialtyOptions = getSpecialtyOptions(t);
  const sexOptions = getSexOptions(t);
  const subsystemOptions = getSubsystemOptions(t);
  const subsystemAllowed = new Set(subsystemOptions.map(option => option.value));
  const exporterName = user?.fullName || user?.username || t('app.authenticatedUser');
  const [planningInputDate, setPlanningInputDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [planningBoards, setPlanningBoards] = useState<PlanningBoardState[]>([]);
  const [planningSelections, setPlanningSelections] = useState<Record<string, string[]>>({});
  const [editor, setEditor] = useState<{ date: string; row: any } | null>(null);
  const [editorForm, setEditorForm] = useState(createPlanningForm());
  const [editorSaving, setEditorSaving] = useState(false);
  const [copyInputs, setCopyInputs] = useState<Record<string, string>>({});

  const canImportPlanning = !!user && ['NURSE', 'COORDINATOR', 'ADMIN'].includes(user.role);
  const isCoordinator = user?.role === 'COORDINATOR' || user?.role === 'ADMIN';

  const normalizeRow = (row: any) => {
    const bedCode = row?.bedCode || row?.bed?.code || '';
    const floorName = row?.floorName || row?.bed?.floor?.name || '';
    const toIso = (value: any) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      try {
        return new Date(value).toISOString();
      } catch {
        return '';
      }
    };
    const entryIso = toIso(row?.entryDate);
    const dischargeIso = toIso(row?.dischargeDate);
    return {
      ...row,
      bedCode,
      floorName,
      ageYears: row?.ageYears ?? '',
      sex: row?.sex || '',
      subsystem: sanitizeSubsystem(row?.subsystem, subsystemAllowed) || '',
      entryDate: entryIso ? entryIso.substring(0, 10) : '',
      dischargeDate: dischargeIso ? dischargeIso.substring(0, 10) : '',
      origin: row?.origin || 'PLAN',
    };
  };

  const sortRows = (rows: any[]) => [...rows].sort((a, b) => compareBedCodes(a?.bedCode || '', b?.bedCode || ''));

  const patchBoard = (date: string, patch: Partial<PlanningBoardState>) => {
    setPlanningBoards(prev => {
      const exists = prev.find(b => b.date === date);
      if (exists) {
        return prev.map(b => (b.date === date ? { ...b, ...patch } : b));
      }
      return [...prev, { date, rows: [], loading: false, saving: null, ...patch }];
    });
  };

  const loadPlanningBoard = useCallback(
    async (date: string) => {
      if (!date) return;
      patchBoard(date, { loading: true });
      try {
        const { data } = await axios.get(`/api/planning/${date}`);
        const mapped = sortRows((Array.isArray(data) ? data : []).map(normalizeRow));
        patchBoard(date, { rows: mapped, loading: false });
      } catch (e: any) {
        enqueueSnackbar(t('planningMessages.loadError'), { variant: 'error' });
        patchBoard(date, { loading: false });
      }
    },
    [enqueueSnackbar],
  );

  const handleAddPlanningBoard = () => {
    if (!planningInputDate) {
      enqueueSnackbar(t('planningMessages.selectDate'), { variant: 'warning' });
      return;
    }
    loadPlanningBoard(planningInputDate);
  };

  const handleRemovePlanningBoard = (date: string) => {
    setPlanningBoards(prev => prev.filter(b => b.date !== date));
    setPlanningSelections(prev => {
      if (!prev[date]) return prev;
      const clone = { ...prev };
      delete clone[date];
      return clone;
    });
  };

  const toggleSelection = (date: string, bedCode: string) => {
    setPlanningSelections(prev => {
      const current = new Set(prev[date] || []);
      if (current.has(bedCode)) current.delete(bedCode);
      else current.add(bedCode);
      return { ...prev, [date]: Array.from(current) };
    });
  };

  const persistPlanningRow = async (date: string, row: any) => {
    if (!isCoordinator) return;
    const bedCode = row.bedCode;
    patchBoard(date, { saving: bedCode });
    try {
      const payload = {
        utenteName: row.utenteName || null,
        utenteProcessNumber: row.utenteProcessNumber || null,
        ageYears: row.ageYears === '' ? null : Number(row.ageYears),
        sex: row.sex || null,
        surgeon: row.surgeon || null,
        specialty: row.specialty || null,
        surgery: row.surgery || null,
        subsystem: sanitizeSubsystem(row.subsystem, subsystemAllowed),
        allergies: row.allergies || null,
        observations: row.observations || null,
        entryDate: row.entryDate || null,
        dischargeDate: row.dischargeDate || null,
      };
      const { data } = await axios.patch(`/api/planning/${date}/${encodeURIComponent(bedCode)}`, payload);
      const normalized = { ...normalizeRow(data), origin: 'PLAN' };
      setPlanningBoards(prev =>
        prev.map(board =>
          board.date === date
            ? {
                ...board,
                rows: sortRows(board.rows.map(item => (item.bedCode === bedCode ? normalized : item))),
                saving: null,
              }
            : board,
        ),
      );
      enqueueSnackbar(t('planningMessages.saveSuccess'), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(`${t('planningMessages.saveError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
      patchBoard(date, { saving: null });
    }
  };

  const handleGeneratePlan = async (date: string) => {
    if (!isCoordinator) return;
    try {
      await axios.post(`/api/planning/${date}/generate`);
      enqueueSnackbar(t('planningMessages.generateSuccess'), { variant: 'success' });
      await loadPlanningBoard(date);
    } catch (e: any) {
      enqueueSnackbar(`${t('planningMessages.generateError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    }
  };

  const handleClearPlanningBoard = async (date: string) => {
    if (!isCoordinator) return;
    if (!window.confirm(t('planningMessages.confirmClearDay'))) return;
    patchBoard(date, { loading: true });
    try {
      await axios.delete(`/api/planning/${date}`);
      patchBoard(date, { rows: [], loading: false });
      setPlanningSelections(prev => {
        if (!prev[date]) return prev;
        const clone = { ...prev };
        delete clone[date];
        return clone;
      });
      enqueueSnackbar(t('planningMessages.clearDaySuccess'), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(`${t('planningMessages.clearDayError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
      patchBoard(date, { loading: false });
    }
  };

  const handleCopyInputChange = (date: string, value: string) => {
    setCopyInputs(prev => ({ ...prev, [date]: value }));
  };

  const handleCopyPlan = async (date: string) => {
    if (!isCoordinator) return;
    const sourceDate = copyInputs[date];
    if (!sourceDate) {
      enqueueSnackbar(t('planningMessages.selectSourceDate'), { variant: 'warning' });
      return;
    }
    try {
      await axios.post(`/api/planning/${date}/copy`, { sourceDate });
      enqueueSnackbar(t('planningMessages.copySuccess'), { variant: 'success' });
      await loadPlanningBoard(date);
    } catch (e: any) {
      enqueueSnackbar(`${t('planningMessages.copyError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    }
  };

  const handleImportPlanning = async (date: string, bedCodes?: string[]) => {
    if (!canImportPlanning) return;
    const codes = bedCodes && bedCodes.length ? bedCodes : planningSelections[date] || [];
    if (!codes.length) {
      enqueueSnackbar(t('planningMessages.selectBeds'), { variant: 'warning' });
      return;
    }
    try {
      const { data } = await axios.post(`/api/planning/${date}/import`, { bedCodes: codes });
      const results = Array.isArray(data?.results) ? data.results : [];
      const success = results.filter((item: any) => item.status === 'success').length;
      const failed = results.length - success;
      enqueueSnackbar(
        t('planningMessages.importResult', {
          success,
          extra: failed ? t('planningMessages.importFailures', { count: failed }) : '',
        }),
        {
          variant: failed ? 'warning' : 'success',
        },
      );
      setPlanningSelections(prev => {
        const clone = { ...prev };
        delete clone[date];
        return clone;
      });
    } catch (e: any) {
      enqueueSnackbar(`${t('planningMessages.importError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    }
  };

  const handleClearPlanningRow = async (date: string, bedCode: string) => {
    if (!isCoordinator) return;
    if (!window.confirm(t('planningMessages.confirmClearBed', { code: bedCode }))) return;
    try {
      await axios.delete(`/api/planning/${date}/${encodeURIComponent(bedCode)}`);
      setPlanningBoards(prev =>
        prev.map(board =>
          board.date === date
            ? {
                ...board,
                rows: board.rows.map(row =>
                  row.bedCode === bedCode
                    ? {
                        ...row,
                        utenteName: '',
                        utenteProcessNumber: '',
                        ageYears: '',
                        sex: '',
                        surgeon: '',
                        specialty: '',
                        surgery: '',
                        subsystem: '',
                        allergies: '',
                        observations: '',
                        entryDate: '',
                        dischargeDate: '',
                        origin: 'EMPTY',
                      }
                    : row,
                ),
              }
            : board,
        ),
      );
      setPlanningSelections(prev => {
        const current = prev[date];
        if (!current) return prev;
        const filtered = current.filter(code => code !== bedCode);
        return { ...prev, [date]: filtered };
      });
      enqueueSnackbar(t('planningMessages.clearBedSuccess'), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(`${t('planningMessages.clearBedError')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    }
  };

  const downloadPlanningPdf = async (board: PlanningBoardState) => {
    if (!board.rows.length) {
      enqueueSnackbar(t('planningMessages.noRowsExport'), { variant: 'info' });
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
      doc.text(`${hospitalName} · ${t('planning.title')} · ${format(new Date(board.date), 'dd/MM/yyyy')}`, headerX, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(
        t('common.exportedBy', {
          name: exporterName,
          date: format(new Date(), 'dd/MM/yyyy HH:mm'),
        }),
        headerX,
        58,
      );
      const header = [
        t('labels.bed'),
        t('labels.floor'),
        t('labels.patient'),
        t('labels.process'),
        t('labels.age'),
        t('labels.sex'),
        t('labels.surgeon'),
        t('labels.specialty'),
        t('labels.surgery'),
        t('labels.subsystem'),
        t('labels.entry'),
        t('labels.discharge'),
        t('labels.observations'),
        t('labels.allergies'),
      ];
      const body = board.rows.map(row => [
        row.bedCode,
        row.floorName,
        row.utenteName || '',
        row.utenteProcessNumber || '',
        row.ageYears || '',
        row.sex || '',
        row.surgeon || '',
        row.specialty || '',
        row.surgery || '',
        row.subsystem || '',
        row.entryDate || '',
        row.dischargeDate || '',
        row.observations || '',
        row.allergies || '',
      ]);
      autoTable(doc, {
        head: [header],
        body,
        startY: 80,
        styles: { fontSize: 6, cellPadding: 2, overflow: 'linebreak', halign: 'center' },
        columnStyles: {
          2: { halign: 'left', cellWidth: 140 },
          3: { halign: 'center', cellWidth: 80 },
          6: { halign: 'left', cellWidth: 120 },
          7: { halign: 'left', cellWidth: 110 },
          8: { halign: 'left', cellWidth: 120 },
          12: { halign: 'left', cellWidth: 160 },
          13: { halign: 'left', cellWidth: 130 },
        },
        tableWidth: 'auto',
        margin: { left: 10, right: 10 },
        theme: 'grid',
      });
      doc.save(`planeamento_${board.date}.pdf`);
    } catch (e) {
      console.error(e);
      enqueueSnackbar(t('planningMessages.pdfError'), { variant: 'error' });
    }
  };

  const exportPlanningExcel = async (board: PlanningBoardState) => {
    if (!board.rows.length) {
      enqueueSnackbar(t('planningMessages.noRowsExport'), { variant: 'info' });
      return;
    }
    try {
      const hospitalName = settings.hospitalName || t('app.name');
      const xlsx = await import('xlsx');
      const header = [
        t('labels.bed'),
        t('labels.floor'),
        t('labels.patient'),
        t('labels.process'),
        t('labels.age'),
        t('labels.sex'),
        t('labels.surgeon'),
        t('labels.specialty'),
        t('labels.surgery'),
        t('labels.subsystem'),
        t('labels.entry'),
        t('labels.discharge'),
        t('labels.observations'),
        t('labels.allergies'),
      ];
      const aoa = [
        [`${hospitalName} · ${t('planning.title')} · ${format(new Date(board.date), 'dd/MM/yyyy')}`, '', '', '', '', '', '', '', '', '', '', '', '', ''],
        [t('common.exportedBy', { name: exporterName, date: format(new Date(), 'dd/MM/yyyy HH:mm') }), '', '', '', '', '', '', '', '', '', '', '', '', ''],
        [],
        header,
        ...board.rows.map(row => [
          row.bedCode,
          row.floorName,
          row.utenteName || '',
          row.utenteProcessNumber || '',
          row.ageYears || '',
          row.sex || '',
          row.surgeon || '',
          row.specialty || '',
          row.surgery || '',
          row.subsystem || '',
          row.entryDate || '',
          row.dischargeDate || '',
          row.observations || '',
          row.allergies || '',
        ]),
      ];
      const ws = xlsx.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 14 },
        { wch: 28 },
        { wch: 14 },
        { wch: 8 },
        { wch: 8 },
        { wch: 18 },
        { wch: 18 },
        { wch: 22 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 32 },
        { wch: 24 },
      ];
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Planeamento');
      xlsx.writeFile(wb, `planeamento_${board.date}.xlsx`);
    } catch (e) {
      console.error(e);
      enqueueSnackbar(t('planningMessages.excelError'), { variant: 'error' });
    }
  };

  const openEditor = (date: string, row: any) => {
    if (!isCoordinator) return;
    setEditor({ date, row });
    setEditorForm({
      utenteName: row.utenteName || '',
      utenteProcessNumber: row.utenteProcessNumber || '',
      ageYears: row.ageYears || '',
      sex: row.sex || '',
      surgeon: row.surgeon || '',
      specialty: row.specialty || '',
      surgery: row.surgery || '',
      subsystem: sanitizeSubsystem(row.subsystem, subsystemAllowed) || '',
      observations: row.observations || '',
      allergies: row.allergies || '',
      entryDate: row.entryDate || '',
      dischargeDate: row.dischargeDate || '',
    });
  };

  const closeEditor = () => {
    setEditor(null);
    setEditorForm(createPlanningForm());
    setEditorSaving(false);
  };

  const handleEditorSave = async () => {
    if (!editor) return;
    setEditorSaving(true);
    await persistPlanningRow(editor.date, { ...editor.row, ...editorForm });
    setEditorSaving(false);
    closeEditor();
  };

  const renderValue = (value: string | number | undefined) => {
    if (value === undefined || value === null || value === '') {
      return <Typography variant="body2" color="text.secondary">—</Typography>;
    }
    return <Typography variant="body2" color="text.primary">{value}</Typography>;
  };

  const renderRow = (board: PlanningBoardState, row: any, selection: string[]) => {
    const isChild = typeof row.ageYears === 'number' && row.ageYears < 18;
    const specialtyVisual = row.specialty ? specialtyColors[row.specialty] : undefined;
    const originLabel =
      row.origin === 'PREDICTION'
        ? { label: t('planning.originPredicted'), color: 'warning' as const }
        : row.origin === 'EMPTY'
          ? { label: t('planning.originFree'), color: 'default' as const }
          : null;
    return (
      <TableRow
        key={`${board.date}-${row.bedCode}`}
        sx={{
          backgroundColor: isChild ? '#fff8e1' : undefined,
        }}
        hover
      >
        {canImportPlanning && (
          <TableCell align="center">
            <Checkbox
              size="small"
              checked={selection.includes(row.bedCode)}
              onChange={() => toggleSelection(board.date, row.bedCode)}
            />
          </TableCell>
        )}
        <TableCell sx={{ fontWeight: 600 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <span>{row.bedCode}</span>
            {originLabel && (
              <Chip label={originLabel.label} color={originLabel.color} size="small" />
            )}
            {isCoordinator && (
              <Tooltip title={t('planning.editBed')}>
                <span>
                  <IconButton size="small" color="primary" onClick={() => openEditor(board.date, row)}>
                    <EditNoteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        </TableCell>
        <TableCell>{renderValue(row.floorName)}</TableCell>
        <TableCell>{renderValue(row.utenteName)}</TableCell>
        <TableCell>{renderValue(row.utenteProcessNumber)}</TableCell>
        <TableCell>{renderValue(row.ageYears)}</TableCell>
        <TableCell>{renderValue(row.sex)}</TableCell>
        <TableCell>{renderValue(row.surgeon)}</TableCell>
        <TableCell>
          {row.specialty ? (
            <Chip
              label={row.specialty}
              size="small"
              sx={{
                bgcolor: specialtyVisual?.bg || '#eceff1',
                color: specialtyVisual?.color || '#37474f',
                fontWeight: 600,
              }}
            />
          ) : (
            renderValue('')
          )}
        </TableCell>
        <TableCell>{renderValue(row.surgery)}</TableCell>
        <TableCell>{renderValue(row.subsystem)}</TableCell>
        <TableCell>{renderValue(row.entryDate ? format(new Date(row.entryDate), 'dd/MM/yyyy') : '')}</TableCell>
        <TableCell>{renderValue(row.dischargeDate ? format(new Date(row.dischargeDate), 'dd/MM/yyyy') : '')}</TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }} color={row.observations ? 'text.primary' : 'text.secondary'}>
            {row.observations || '—'}
          </Typography>
        </TableCell>
        <TableCell sx={row.allergies ? { backgroundColor: '#ffebee' } : undefined}>
          <Typography
            variant="body2"
            sx={{ whiteSpace: 'pre-line', fontWeight: row.allergies ? 600 : 400 }}
            color={row.allergies ? '#b71c1c' : 'text.secondary'}
          >
            {row.allergies || '—'}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Stack direction="row" spacing={1} justifyContent="center">
            {canImportPlanning && (
              <Tooltip title={t('planning.importSingle')}>
                <span>
                  <IconButton size="small" color="success" onClick={() => handleImportPlanning(board.date, [row.bedCode])}>
                    <CloudUploadIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {isCoordinator && (
              <Tooltip title={t('planning.saveChanges')}>
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    disabled={board.saving === row.bedCode}
                    onClick={() => persistPlanningRow(board.date, row)}
                  >
                    <SaveOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {isCoordinator && (
              <Tooltip title={t('planning.clearBed')}>
                <span>
                  <IconButton
                    size="small"
                    color="warning"
                    onClick={() => handleClearPlanningRow(board.date, row.bedCode)}
                  >
                    <CleaningServicesIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        </TableCell>
      </TableRow>
    );
  };

  useEffect(() => {
    loadPlanningBoard(planningInputDate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ p: 3, bgcolor: '#f7fbff', minHeight: '100vh' }}>
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3, boxShadow: 5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t('planning.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('planning.subtitle')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <TextField
            type="date"
            label={t('planning.dayLabel')}
            size="small"
            value={planningInputDate}
            onChange={e => setPlanningInputDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 220 }}
          />
          <Button startIcon={<AddCircleOutlineIcon />} variant="contained" onClick={handleAddPlanningBoard}>
            {t('planning.loadDay')}
          </Button>
        </Stack>
      </Paper>

      {planningBoards.length === 0 ? (
        <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center', color: 'text.secondary' }}>
          {t('planning.emptyState')}
        </Paper>
      ) : (
        planningBoards.map(board => {
          const copyValue = copyInputs[board.date] || '';
          const selection = planningSelections[board.date] || [];
          return (
            <Paper key={board.date} sx={{ mb: 4, borderRadius: 3, boxShadow: 4, p: 3 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {t('planning.dayLabel')} {format(new Date(board.date), 'dd/MM/yyyy')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('planning.bedsPlanned', { count: board.rows.length })}
                  </Typography>
                </Box>
                <Stack spacing={1} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Tooltip title={t('planning.refresh')}>
                      <span>
                        <IconButton size="small" onClick={() => loadPlanningBoard(board.date)} disabled={board.loading}>
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('dashboard.exportPdf')}>
                      <span>
                        <IconButton size="small" onClick={() => downloadPlanningPdf(board)} disabled={!board.rows.length}>
                          <PictureAsPdfIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('dashboard.exportExcel')}>
                      <span>
                        <IconButton size="small" onClick={() => exportPlanningExcel(board)} disabled={!board.rows.length}>
                          <FileDownloadIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    {canImportPlanning && (
                      <Button
                        startIcon={<CloudUploadIcon />}
                        size="small"
                        variant="outlined"
                        disabled={!selection.length}
                        onClick={() => handleImportPlanning(board.date)}
                      >
                        {t('planning.importSelected')}
                      </Button>
                    )}
                    {isCoordinator && (
                      <Tooltip title={t('planning.generateFromCurrent')}>
                        <span>
                          <IconButton size="small" color="primary" onClick={() => handleGeneratePlan(board.date)} disabled={board.loading}>
                            <EventNoteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    {isCoordinator && (
                      <Tooltip title={t('planning.clearDay')}>
                        <span>
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleClearPlanningBoard(board.date)}
                            disabled={board.loading || !board.rows.length}
                          >
                            <CleaningServicesIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    <Tooltip title={t('planning.removeDay')}>
                      <span>
                        <IconButton size="small" color="error" onClick={() => handleRemovePlanningBoard(board.date)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                  {isCoordinator && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
                      <TextField
                        type="date"
                        size="small"
                        label={t('planning.copyFrom')}
                        value={copyValue}
                        onChange={e => handleCopyInputChange(board.date, e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleCopyPlan(board.date)}
                        disabled={!copyValue}
                      >
                        {t('planning.copyPlan')}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Stack>

              {board.loading ? (
                <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={28} />
                </Box>
              ) : board.rows.length === 0 ? (
                <Typography sx={{ color: 'text.secondary', mt: 2 }}>{t('planning.noRecords')}</Typography>
              ) : (
                <TableContainer sx={{ mt: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {canImportPlanning && <TableCell>{t('labels.select')}</TableCell>}
                        <TableCell>{t('labels.bed')}</TableCell>
                        <TableCell>{t('labels.floor')}</TableCell>
                        <TableCell>{t('labels.patient')}</TableCell>
                        <TableCell>{t('labels.process')}</TableCell>
                        <TableCell>{t('labels.age')}</TableCell>
                        <TableCell>{t('labels.sex')}</TableCell>
                        <TableCell>{t('labels.surgeon')}</TableCell>
                        <TableCell>{t('labels.specialty')}</TableCell>
                        <TableCell>{t('labels.surgery')}</TableCell>
                        <TableCell>{t('labels.subsystem')}</TableCell>
                        <TableCell>{t('labels.entry')}</TableCell>
                        <TableCell>{t('labels.discharge')}</TableCell>
                        <TableCell>{t('labels.observations')}</TableCell>
                        <TableCell>{t('labels.allergies')}</TableCell>
                        <TableCell>{t('labels.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {board.rows.map(row => renderRow(board, row, selection))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          );
        })
      )}

      <Dialog open={!!editor} onClose={closeEditor} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#e8f5e9', color: '#1b5e20' }}>
          {t('planning.title')} · {editor?.row?.bedCode}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('labels.patient')}
                value={editorForm.utenteName}
                onChange={e => setEditorForm(prev => ({ ...prev, utenteName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label={t('labels.process')}
                value={editorForm.utenteProcessNumber}
                onChange={e => setEditorForm(prev => ({ ...prev, utenteProcessNumber: e.target.value }))}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                type="number"
                label={t('labels.age')}
                value={editorForm.ageYears}
                onChange={e => setEditorForm(prev => ({ ...prev, ageYears: e.target.value }))}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                select
                fullWidth
                label={t('labels.sex')}
                value={editorForm.sex}
                onChange={e => setEditorForm(prev => ({ ...prev, sex: e.target.value }))}
                SelectProps={{ native: false }}
              >
                <MenuItem value="">
                  <em>{t('common.none')}</em>
                </MenuItem>
                {sexOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label={t('labels.surgeon')}
                value={editorForm.surgeon}
                onChange={e => setEditorForm(prev => ({ ...prev, surgeon: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label={t('labels.specialty')}
                value={editorForm.specialty}
                onChange={e => setEditorForm(prev => ({ ...prev, specialty: e.target.value }))}
                SelectProps={{ native: false }}
              >
                <MenuItem value="">
                  <em>{t('common.none')}</em>
                </MenuItem>
                {specialtyOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('labels.surgery')}
                value={editorForm.surgery}
                onChange={e => setEditorForm(prev => ({ ...prev, surgery: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label={t('labels.subsystem')}
                value={editorForm.subsystem}
                onChange={e => setEditorForm(prev => ({ ...prev, subsystem: e.target.value }))}
                SelectProps={{ native: false }}
              >
                <MenuItem value="">
                  <em>{t('common.none')}</em>
                </MenuItem>
                {subsystemOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
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
                value={editorForm.observations}
                onChange={e => setEditorForm(prev => ({ ...prev, observations: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label={t('labels.allergies')}
                value={editorForm.allergies}
                onChange={e => setEditorForm(prev => ({ ...prev, allergies: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="date"
                label={t('labels.entry')}
                value={editorForm.entryDate}
                onChange={e => setEditorForm(prev => ({ ...prev, entryDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="date"
                label={t('labels.discharge')}
                value={editorForm.dischargeDate}
                onChange={e => setEditorForm(prev => ({ ...prev, dischargeDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditor}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleEditorSave} disabled={editorSaving}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
