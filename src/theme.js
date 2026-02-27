import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
            light: '#63a4ff',
            dark: '#004ba0',
        },
        text: {
            primary: '#ffffff',
            secondary: '#333333',
            link: '#ffcc00',
        },
        background: {
            default: '#ffffff',
            paper: '#f8f9fa',
        },
        drawer: {
            background: '#1976d2',
            text: '#ffffff',
            hover: '#63a4ff',
        },
    },
    typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", Arial, sans-serif',
        h1: {
            fontSize: '2.5rem',
            fontWeight: 600,
        },
        h2: {
            fontSize: '1.75rem',
            fontWeight: 600,
        },
        h3: {
            fontSize: '1.35rem',
            fontWeight: 600,
        },
        body1: {
            fontSize: '1.1rem',
            lineHeight: 1.6,
        },
    },
    shape: {
        borderRadius: 8,
    },
    shadows: [
        'none',
        '0 2px 4px rgba(0, 0, 0, 0.1)',
        ...Array(23).fill('0 2px 4px rgba(0, 0, 0, 0.1)'),
    ],
});

export const shadowCard = '0 2px 4px rgba(0, 0, 0, 0.1)';

export default theme;
