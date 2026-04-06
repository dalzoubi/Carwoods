import styled from 'styled-components';
import theme from '../theme';

/** Full-height column: header + growing main + footer pinned to viewport bottom on short pages */
export const AppShell = styled.div.attrs({ 'data-layout': 'app-shell' })`
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
`;

export const Container = styled.main`
    font-family: var(--typography-font-family);
    color: var(--palette-text-secondary);
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    /* Tighter gutters on phones so content uses width; sm+ matches historical spacing */
    padding: ${theme.spacing(1.5)};
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;

    @media (min-width: 600px) {
        padding: ${theme.spacing(2.5)};
    }
`;

export const Content = styled.section`
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin-top: ${theme.spacing(1.5)};
    padding: ${theme.spacing(1.5)};
    background: var(--palette-background-paper);
    border-radius: var(--shape-border-radius);
    box-shadow: var(--shadow-card);
    color: var(--palette-text-secondary);
    animation: pageFadeIn 0.25s ease-out;

    @media (min-width: 600px) {
        margin-top: ${theme.spacing(2.5)};
        padding: ${theme.spacing(2.5)};
    }

    @keyframes pageFadeIn {
        from {
            opacity: 0;
            transform: translateY(6px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

export const PageHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${theme.spacing(1.25)};

    h1 {
        margin-bottom: 0;
    }
`;
