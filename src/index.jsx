import React from 'react';
import ReactDOM from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import './index.css';
import App from './App';
import { ThemeModeProvider } from './ThemeModeContext';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeModeProvider>
      <CssBaseline />
      <App />
    </ThemeModeProvider>
  </React.StrictMode>
);

reportWebVitals();
