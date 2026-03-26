import { createTheme } from '@mui/material/styles';

const typography = {
    fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", Arial, sans-serif',
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
};

const shape = { borderRadius: 8 };

const lightShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
const darkShadow = '0 2px 8px rgba(0, 0, 0, 0.45)';

/**
 * Syncs palette tokens to CSS variables for styled-components and plain CSS.
 * @param {import('@mui/material/styles').Theme} muiTheme
 */
export function applyThemeCssVariables(muiTheme) {
    const root = document.documentElement;
    const { palette } = muiTheme;
    const isDark = palette.mode === 'dark';

    root.style.colorScheme = isDark ? 'dark' : 'light';

    root.style.setProperty('--palette-primary-main', palette.primary.main);
    root.style.setProperty('--palette-primary-light', palette.primary.light);
    root.style.setProperty('--palette-primary-dark', palette.primary.dark);

    root.style.setProperty('--palette-text-primary', palette.text.primary);
    root.style.setProperty('--palette-text-secondary', palette.text.secondary);
    root.style.setProperty('--palette-text-link', palette.text.link ?? palette.primary.light);

    root.style.setProperty('--palette-background-default', palette.background.default);
    root.style.setProperty('--palette-background-paper', palette.background.paper);

    const drawer = palette.drawer;
    root.style.setProperty('--palette-drawer-background', drawer.background);
    root.style.setProperty('--palette-drawer-text', drawer.text);
    root.style.setProperty('--palette-drawer-hover', drawer.hover);

    root.style.setProperty('--shape-border-radius', `${muiTheme.shape.borderRadius}px`);

    root.style.setProperty('--typography-font-family', muiTheme.typography.fontFamily);
    root.style.setProperty('--typography-h1-font-size', muiTheme.typography.h1.fontSize);
    root.style.setProperty('--typography-h1-font-weight', String(muiTheme.typography.h1.fontWeight));
    root.style.setProperty('--typography-h2-font-size', muiTheme.typography.h2.fontSize);
    root.style.setProperty('--typography-h2-font-weight', String(muiTheme.typography.h2.fontWeight));
    root.style.setProperty('--typography-h3-font-size', muiTheme.typography.h3.fontSize);
    root.style.setProperty('--typography-h3-font-weight', String(muiTheme.typography.h3.fontWeight));
    root.style.setProperty('--typography-body1-font-size', muiTheme.typography.body1.fontSize);
    root.style.setProperty('--typography-body1-line-height', String(muiTheme.typography.body1.lineHeight));
    root.style.setProperty(
        '--typography-body2-font-size',
        muiTheme.typography.body2?.fontSize ?? '0.875rem'
    );

    root.style.setProperty('--shadow-card', isDark ? darkShadow : lightShadow);
    root.style.setProperty('--menu-item-hover-bg', isDark ? 'rgba(66, 165, 245, 0.14)' : 'rgba(25, 118, 210, 0.08)');

    root.style.setProperty('--toc-nav-bg', isDark ? 'rgba(66, 165, 245, 0.12)' : '#f0f4ff');
    root.style.setProperty('--personalize-card-bg', isDark ? 'rgba(66, 165, 245, 0.12)' : '#f0f4ff');

    root.style.setProperty('--filter-banner-bg', isDark ? 'rgba(245, 158, 11, 0.16)' : '#fff8e1');
    root.style.setProperty('--filter-banner-border', isDark ? '#d97706' : '#f59e0b');
    root.style.setProperty('--filter-banner-label', isDark ? '#fbbf24' : '#92400e');
    root.style.setProperty('--filter-banner-text', isDark ? '#fde68a' : '#78350f');
    root.style.setProperty('--filter-banner-edit-color', isDark ? '#fbbf24' : '#92400e');
    root.style.setProperty('--filter-banner-edit-hover-bg', isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7');
    root.style.setProperty('--filter-banner-edit-outline', isDark ? '#fbbf24' : '#f59e0b');
    root.style.setProperty('--filter-banner-reset-bg', isDark ? '#d97706' : '#f59e0b');
    root.style.setProperty('--filter-banner-reset-hover', isDark ? '#b45309' : '#d97706');
    root.style.setProperty('--filter-banner-reset-outline', isDark ? '#fbbf24' : '#92400e');

    root.style.setProperty('--button-on-primary', '#fff');
    root.style.setProperty('--print-button-hover-text', '#fff');

    /* Footer sits on primary.main; these meet WCAG 2.1 AA ~4.5:1 for normal text on that bar. */
    if (isDark) {
        root.style.setProperty('--footer-on-primary', '#0f172a');
        root.style.setProperty('--footer-link-on-primary', '#0f172a');
        root.style.setProperty('--footer-link-hover-on-primary', '#020617');
        root.style.setProperty('--footer-separator-on-primary', 'rgba(15, 23, 42, 0.45)');
    } else {
        root.style.setProperty('--footer-on-primary', '#ffffff');
        root.style.setProperty('--footer-link-on-primary', '#ffffff');
        root.style.setProperty('--footer-link-hover-on-primary', '#f5faff');
        root.style.setProperty('--footer-separator-on-primary', 'rgba(255, 255, 255, 0.55)');
    }
}

/**
 * @param {'light' | 'dark'} mode
 */
export function buildTheme(mode) {
    const isDark = mode === 'dark';

    return createTheme({
        palette: {
            mode,
            primary: isDark
                ? {
                      main: '#42a5f5',
                      light: '#90caf9',
                      dark: '#1565c0',
                  }
                : {
                      main: '#1976d2',
                      light: '#63a4ff',
                      dark: '#004ba0',
                  },
            text: isDark
                ? {
                      primary: '#ffffff',
                      secondary: 'rgba(255, 255, 255, 0.85)',
                      link: '#ffd54f',
                  }
                : {
                      primary: '#ffffff',
                      secondary: '#333333',
                      link: '#ffcc00',
                  },
            background: isDark
                ? {
                      default: '#121212',
                      paper: '#1e1e1e',
                  }
                : {
                      default: '#ffffff',
                      paper: '#f8f9fa',
                  },
            drawer: isDark
                ? {
                      background: '#1565c0',
                      text: '#ffffff',
                      hover: '#1976d2',
                  }
                : {
                      background: '#1976d2',
                      text: '#ffffff',
                      hover: '#63a4ff',
                  },
        },
        typography,
        shape,
        shadows: [
            'none',
            isDark ? darkShadow : lightShadow,
            ...Array(23).fill(isDark ? darkShadow : lightShadow),
        ],
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        backgroundColor: isDark ? '#121212' : '#ffffff',
                    },
                },
            },
        },
    });
}

/** Default light theme (for tests and static spacing). */
const defaultTheme = buildTheme('light');

export const shadowCard = lightShadow;

export default defaultTheme;
