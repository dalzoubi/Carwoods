import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2', // Blue
            light: '#63a4ff', // Light Blue for hover
            dark: '#004ba0', // Dark Blue for active
        },
        secondary: {
            main: '#004d40', // Teal
        },
        text: {
            primary: '#ffffff', // White text
            secondary: '#333333', // Dark text for content
            link: '#ffcc00', // Yellow text for footer links
        },
        background: {
            paper: '#e0e0e0', // Light background for content
        },
        drawer: {
            background: '#1976d2', // Blue background for drawer
            text: '#ffffff', // White text for drawer
            hover: '#63a4ff', // Light blue for hover in drawer
        },
    },
});

export default theme;
