import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import axios from 'axios';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import { useFloors } from '../hooks/useFloors';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../context/SettingsContext';
import { loadLogoDataUrl } from '../utils/pdfLogo';

const defaultFilters = {
  startDate: '',
  endDate: '',
  bedCode: '',
  floor: '',
  patient: '',
  processNumber: '',
};

export const AuditPage = () => {
  const { user } = useAuth();
  const { floors } = useFloors();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const exporterName = user?.fullName || user?.username || t('common.none');
  const [filters, setFilters] = useState(defaultFilters);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const canView = user && (user.role === 'COORDINATOR' || user.role === 'ADMIN');

  const fetchLogs = async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params: any = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const { data } = await axios.get('/api/audit/logs', { params });
      setLogs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      enqueueSnackbar(`${t('errors.loadAudits')}: ${e.response?.data?.message || ''}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const exportPdf = async () => {
    if (!logs.length) {
      enqueueSnackbar(t('notifications.noDataExport'), { variant: 'info' });
      return;
    }
    try {
      const hospitalName = settings.hospitalName || t('app.name');
      const jsPDFModule = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDFModule.default({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const logoData = await loadLogoDataUrl();
      if (logoData) {
        doc.addImage(logoData, 'PNG', 40, 18, 50, 50);
      }
      const headerX = logoData ? 100 : 40;
      doc.setFontSize(14);
      doc.text(`${hospitalName} · ${t('audits.title')}`, headerX, 40);
      doc.setFontSize(10);
      doc.text(t('audits.records', { count: logs.length }), headerX, 58);
      const header = [
        t('labels.dateTime'),
        t('labels.floor'),
        t('labels.bed'),
        t('labels.action'),
        t('labels.user'),
        t('labels.reason'),
        t('labels.patient'),
        t('labels.process'),
      ];
      const body = logs.map(log => [
        log.timestamp ? format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm') : '',
        log.floorName || '—',
        log.bedCode || '—',
        log.action,
        log.user?.fullName || log.user?.username || '—',
        log.reason || '—',
        log.patientName || '—',
        log.patientProcessNumber || '—',
      ]);
      autoTable(doc, {
        head: [header],
        body,
        startY: 80,
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [5, 45, 78], textColor: 255 },
        tableWidth: 'auto',
      });
      doc.save('auditorias.pdf');
      enqueueSnackbar(t('notifications.pdfExported'), { variant: 'success' });
    } catch (error) {
      console.error(error);
      enqueueSnackbar(t('notifications.pdfError'), { variant: 'error' });
    }
  };

  const exportExcel = async () => {
    if (!logs.length) {
      enqueueSnackbar(t('notifications.noDataExport'), { variant: 'info' });
      return;
    }
    try {
      const hospitalName = settings.hospitalName || t('app.name');
      const xlsx = await import('xlsx');
      const header = [
        t('labels.dateTime'),
        t('labels.floor'),
        t('labels.bed'),
        t('labels.action'),
        t('labels.user'),
        t('labels.reason'),
        t('labels.patient'),
        t('labels.process'),
      ];
      const rows = logs.map(log => [
        log.timestamp ? format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm') : '',
        log.floorName || '',
        log.bedCode || '',
        log.action,
        log.user?.fullName || log.user?.username || '',
        log.reason || '',
        log.patientName || '',
        log.patientProcessNumber || '',
      ]);
      const topPadding = Array(header.length - 1).fill('');
      const secondPadding = Array(header.length - 2).fill('');
      const sheet = xlsx.utils.aoa_to_sheet([
        [`${hospitalName} - ${t('audits.title')}`, ...topPadding],
        [t('common.exportedBy', { name: exporterName, date: format(new Date(), 'dd/MM/yyyy HH:mm') }), ...secondPadding],
        [],
        header,
        ...rows,
      ]);
      sheet['!cols'] = [
        { wch: 20 },
        { wch: 14 },
        { wch: 10 },
        { wch: 18 },
        { wch: 28 },
        { wch: 36 },
        { wch: 24 },
        { wch: 16 },
      ];
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, sheet, 'Auditorias');
      xlsx.writeFile(workbook, 'auditorias.xlsx');
      enqueueSnackbar(t('notifications.excelExported'), { variant: 'success' });
    } catch (error) {
      console.error(error);
      enqueueSnackbar(t('notifications.excelError'), { variant: 'error' });
    }
  };

  if (!canView) {
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
          {t('audits.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('audits.subtitle')}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label={t('labels.start')}
              type="date"
              size="small"
              fullWidth
              value={filters.startDate}
              onChange={e => updateFilter('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label={t('labels.end')}
              type="date"
              size="small"
              fullWidth
              value={filters.endDate}
              onChange={e => updateFilter('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label={t('labels.bed')}
              size="small"
              fullWidth
              value={filters.bedCode}
              onChange={e => updateFilter('bedCode', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              label={t('labels.floor')}
              size="small"
              fullWidth
              value={filters.floor}
              onChange={e => updateFilter('floor', e.target.value)}
            >
              <MenuItem value="">
                <em>{t('dashboard.allUnits')}</em>
              </MenuItem>
              {floors.map(floor => (
                <MenuItem key={floor.id} value={floor.name}>{floor.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label={t('labels.patient')}
              size="small"
              fullWidth
              value={filters.patient}
              onChange={e => updateFilter('patient', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label={t('labels.process')}
              size="small"
              fullWidth
              value={filters.processNumber}
              onChange={e => updateFilter('processNumber', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={12} md={4} display="flex" gap={1} alignItems="center">
            <Button variant="contained" onClick={fetchLogs}>{t('common.search')}</Button>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={exportPdf}
              color="secondary"
            >
              {t('audits.exportPdf')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={exportExcel}
              color="secondary"
            >
              {t('audits.exportExcel')}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : logs.length === 0 ? (
          <Typography color="text.secondary">{t('audits.noData')}</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('labels.dateTime')}</TableCell>
                  <TableCell>{t('labels.floor')}</TableCell>
                  <TableCell>{t('labels.bed')}</TableCell>
                  <TableCell>{t('labels.action')}</TableCell>
                  <TableCell>{t('labels.user')}</TableCell>
                  <TableCell>{t('labels.patient')}</TableCell>
                  <TableCell>{t('labels.process')}</TableCell>
                  <TableCell>{t('labels.reason')}</TableCell>
                  <TableCell>{t('labels.details')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id} hover>
                    <TableCell>{log.timestamp ? format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm') : '—'}</TableCell>
                    <TableCell>{log.floorName || '—'}</TableCell>
                    <TableCell>{log.bedCode || '—'}</TableCell>
                    <TableCell>
                      <Chip label={log.action} size="small" />
                    </TableCell>
                    <TableCell>{log.user?.fullName || log.user?.username || '—'}</TableCell>
                    <TableCell>{log.patientName || '—'}</TableCell>
                    <TableCell>{log.patientProcessNumber || '—'}</TableCell>
                    <TableCell>{log.reason || '—'}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => setSelectedLog(log)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={!!selectedLog} onClose={() => setSelectedLog(null)} maxWidth="md" fullWidth>
        <DialogTitle>{t('audits.details')}</DialogTitle>
        <DialogContent dividers>
          {selectedLog && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2">
                <strong>{t('labels.dateTime')}:</strong>{' '}
                {selectedLog.timestamp ? format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm') : '—'}
              </Typography>
              <Typography variant="body2">
                <strong>{t('labels.action')}:</strong> {selectedLog.action}
              </Typography>
              <Typography variant="body2">
                <strong>{t('labels.user')}:</strong> {selectedLog.user?.fullName || selectedLog.user?.username}
              </Typography>
              <Typography variant="body2">
                <strong>{t('labels.reason')}:</strong> {selectedLog.reason || '—'}
              </Typography>
              {selectedLog.diff && (
                <Box>
                  <Typography variant="subtitle2">{t('labels.details')}</Typography>
                  <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
                    {JSON.stringify(selectedLog.diff, null, 2)}
                  </pre>
                </Box>
              )}
              {selectedLog.beforeState && (
                <Box>
                  <Typography variant="subtitle2">{t('labels.before')}</Typography>
                  <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
                    {JSON.stringify(selectedLog.beforeState, null, 2)}
                  </pre>
                </Box>
              )}
              {selectedLog.afterState && (
                <Box>
                  <Typography variant="subtitle2">{t('labels.after')}</Typography>
                  <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
                    {JSON.stringify(selectedLog.afterState, null, 2)}
                  </pre>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedLog(null)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
