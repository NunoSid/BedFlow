import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import './i18n';

const theme = createTheme({
  palette: {
    primary: { main: '#005c8a', contrastText: '#ffffff' }, // Azul institucional
    secondary: { main: '#4ac4c6' }, // Verde água clínico
    background: { default: '#f7fbff', paper: '#ffffff' },
    success: { main: '#3fb07c' },
    warning: { main: '#f4a259' },
  },
  typography: {
    fontFamily: '"Noto Sans", "Roboto", "Arial", sans-serif',
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <App />
      </SnackbarProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
