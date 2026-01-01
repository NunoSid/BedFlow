import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Paper, Alert, MenuItem } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../context/SettingsContext';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, user } = useAuth();
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();

  const hospitalName = (settings.hospitalName || '').trim();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
    } catch (e: any) {
      setError(t('login.failed', { message: e.response?.data?.message || t('errors.connection') }));
    }
  };

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem('bedflow_lang', value);
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
      <Paper sx={{ p: 4, width: 340 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
          <Box
            component="img"
            src="/logo.png"
            alt="BedFlow logo"
            sx={{ height: 120, mb: 1 }}
            onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
              event.currentTarget.style.display = 'none';
            }}
          />
          {hospitalName && (
            <Typography variant="h6" align="center" sx={{ fontWeight: 700 }}>
              {hospitalName}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {t('login.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <TextField
            select
            size="small"
            value={i18n.language}
            onChange={(event) => handleLanguageChange(event.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="pt">{t('language.pt')}</MenuItem>
            <MenuItem value="en">{t('language.en')}</MenuItem>
          </TextField>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label={t('login.username')}
            margin="normal"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <TextField
            fullWidth
            type="password"
            label={t('login.password')}
            margin="normal"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 2 }}>
            {t('login.submit')}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};
