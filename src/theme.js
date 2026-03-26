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
const darkShadow = '0 4px 24px rgba(0, 0, 0, 0.55)';

/**
 * Syncs palette tokens to CSS variables for styled-components and plain CSS.
 * @param {import('@mui/material/styles').Theme} muiTheme
 */
export function applyThemeCssVariables(muiTheme) {
    const root = document.documentElement;
    const { palette } = muiTheme;
    const isDark = palette.mode === 'dark';
    const appChrome = palette.appChrome;

    root.style.colorScheme = isDark ? 'dark' : 'light';

    root.style.setProperty('--palette-primary-main', palette.primary.main);
    root.style.setProperty('--palette-primary-light', palette.primary.light);
    root.style.setProperty('--palette-primary-dark', palette.primary.dark);

    root.style.setProperty('--palette-text-primary', palette.text.primary);
    root.style.setProperty('--palette-text-secondary', palette.text.secondary);
    root.style.setProperty('--palette-text-link', palette.text.link ?? palette.primary.light);

    root.style.setProperty('--palette-background-default', palette.background.default);
    root.style.setProperty('--palette-background-paper', palette.background.paper);

    root.style.setProperty('--palette-app-chrome-main', appChrome.main);
    root.style.setProperty('--palette-app-chrome-contrast', appChrome.contrastText);

    root.style.setProperty('--nav-chrome-text', appChrome.contrastText);
    root.style.setProperty(
        '--nav-chrome-active-bg',
        isDark ? 'rgba(255, 255, 255, 0.12)' : palette.primary.dark
    );
    root.style.setProperty('--nav-chrome-active-text', appChrome.contrastText);
    root.style.setProperty(
        '--nav-chrome-hover-bg',
        isDark ? 'rgba(255, 255, 255, 0.08)' : palette.primary.dark
    );

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
    root.style.setProperty(
        '--menu-item-hover-bg',
        isDark ? 'rgba(144, 202, 249, 0.12)' : 'rgba(25, 118, 210, 0.08)'
    );

    root.style.setProperty('--toc-nav-bg', isDark ? 'rgba(100, 181, 246, 0.08)' : '#f0f4ff');
    root.style.setProperty('--personalize-card-bg', isDark ? 'rgba(100, 181, 246, 0.08)' : '#f0f4ff');

    root.style.setProperty('--filter-banner-bg', isDark ? 'rgba(245, 158, 11, 0.12)' : '#fff8e1');
    root.style.setProperty('--filter-banner-border', isDark ? '#b45309' : '#f59e0b');
    root.style.setProperty('--filter-banner-label', isDark ? '#fcd34d' : '#92400e');
    root.style.setProperty('--filter-banner-text', isDark ? '#fde68a' : '#78350f');
    root.style.setProperty('--filter-banner-edit-color', isDark ? '#fcd34d' : '#92400e');
    root.style.setProperty('--filter-banner-edit-hover-bg', isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7');
    root.style.setProperty('--filter-banner-edit-outline', isDark ? '#fbbf24' : '#f59e0b');
    root.style.setProperty('--filter-banner-reset-bg', isDark ? '#b45309' : '#f59e0b');
    root.style.setProperty('--filter-banner-reset-hover', isDark ? '#92400e' : '#d97706');
    root.style.setProperty('--filter-banner-reset-outline', isDark ? '#fcd34d' : '#92400e');

    root.style.setProperty('--button-on-primary', appChrome.contrastText);
    root.style.setProperty('--print-button-hover-text', appChrome.contrastText);

    /* Footer / chrome bar: high contrast using bar background + on-bar text */
    root.style.setProperty('--footer-on-primary', appChrome.contrastText);
    root.style.setProperty('--footer-link-on-primary', appChrome.contrastText);
    root.style.setProperty('--footer-link-hover-on-primary', isDark ? '#ffffff' : '#f5faff');
    root.style.setProperty(
        '--footer-separator-on-primary',
        isDark ? 'rgba(230, 237, 243, 0.35)' : 'rgba(255, 255, 255, 0.55)'
    );
}

/**
 * @param {'light' | 'dark'} mode
 */
export function buildTheme(mode) {
    const isDark = mode === 'dark';

    /** Softer top/bottom bars in dark mode (less saturated than primary.main). */
    const appChrome = isDark
        ? { main: '#1c2836', contrastText: '#e8edf3' }
        : { main: '#1976d2', contrastText: '#ffffff' };

    return createTheme({
        palette: {
            mode,
            primary: isDark
                ? {
                      main: '#64b5f6',
                      light: '#90caf9',
                      dark: '#42a5f5',
                  }
                : {
                      main: '#1976d2',
                      light: '#63a4ff',
                      dark: '#004ba0',
                  },
            secondary: isDark
                ? { main: '#90caf9', light: '#bbdefb', dark: '#64b5f6' }
                : { main: '#00897b', light: '#4ebaaa', dark: '#005249' },
            error: isDark
                ? { main: '#f87171', light: '#fca5a5', dark: '#ef4444' }
                : { main: '#d32f2f', light: '#ef5350', dark: '#c62828' },
            text: isDark
                ? {
                      primary: 'rgba(255, 255, 255, 0.96)',
                      secondary: 'rgba(255, 255, 255, 0.72)',
                      disabled: 'rgba(255, 255, 255, 0.38)',
                  }
                : {
                      primary: '#1a1a1a',
                      secondary: '#424242',
                      disabled: 'rgba(0, 0, 0, 0.38)',
                  },
            background: isDark
                ? {
                      default: '#0d1117',
                      paper: '#161b22',
                  }
                : {
                      default: '#ffffff',
                      paper: '#f8f9fa',
                  },
            divider: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
            ...(isDark && {
                action: {
                    active: 'rgba(255, 255, 255, 0.65)',
                    hover: 'rgba(255, 255, 255, 0.08)',
                    selected: 'rgba(144, 202, 249, 0.16)',
                    disabled: 'rgba(255, 255, 255, 0.3)',
                    disabledBackground: 'rgba(255, 255, 255, 0.12)',
                },
            }),
            appChrome,
            drawer: isDark
                ? {
                      background: appChrome.main,
                      text: appChrome.contrastText,
                      hover: 'rgba(255, 255, 255, 0.08)',
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
                        backgroundColor: isDark ? '#0d1117' : '#ffffff',
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        backgroundImage: 'none',
                        ...(theme.palette.mode === 'dark' && {
                            backgroundColor: theme.palette.background.paper,
                        }),
                    }),
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: ({ theme }) => ({
                        backgroundImage: 'none',
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                    }),
                },
            },
            MuiDialogTitle: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        color: theme.palette.text.primary,
                    }),
                },
            },
            MuiDialogContent: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        color: theme.palette.text.secondary,
                    }),
                },
            },
            MuiDialogActions: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        borderTop: `1px solid ${theme.palette.divider}`,
                        backgroundColor:
                            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }),
                },
            },
            MuiBackdrop: {
                styleOverrides: {
                    root: ({ theme }) =>
                        theme.palette.mode === 'dark'
                            ? { backgroundColor: 'rgba(0, 0, 0, 0.75)' }
                            : {},
                },
            },
            MuiLinearProgress: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        backgroundColor:
                            theme.palette.mode === 'dark' ? 'rgba(100, 181, 246, 0.15)' : '#e3f2fd',
                    }),
                    bar: ({ theme }) => ({
                        backgroundColor: theme.palette.primary.main,
                    }),
                },
            },
            MuiRadio: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.45)' : undefined,
                        '&.Mui-checked': { color: theme.palette.primary.main },
                    }),
                },
            },
            MuiCheckbox: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.45)' : undefined,
                        '&.Mui-checked': { color: theme.palette.primary.main },
                    }),
                },
            },
        },
    });
}

/** Default light theme (for tests and static spacing). */
const defaultTheme = buildTheme('light');

export const shadowCard = lightShadow;

export default defaultTheme;
