import styled from 'styled-components';

export const PrintHeader = styled.div`
    display: none;

    @media print {
        display: flex !important;
        justify-content: center;
        align-items: center;
        margin-bottom: 14pt;
        padding-block-end: 10pt;
        /* Logo prints via invert below; keep band explicitly white (matches global print div reset) */
        background: #fff !important;
        border-bottom: 1px solid #ccc;
        /* Match light-mode print output even when the app is in dark mode */
        color-scheme: light !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    span {
        display: none;
    }
`;

/** Navbar-style inverted mark on screen; hidden when printing (see PrintHeaderLogoPrint). */
export const PrintHeaderLogo = styled.img`
    height: 44pt;
    width: auto;
    filter: invert(1);
    forced-color-adjust: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;

    @media print {
        display: none !important;
    }
`;

/** Black-on-transparent asset from prebuild; visible only in print (no CSS filter). */
export const PrintHeaderLogoPrint = styled.img`
    display: none;
    height: 44pt;
    width: auto;
    forced-color-adjust: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;

    @media print {
        display: block !important;
    }
`;

export const PrintButton = styled.button.attrs({ type: 'button' })`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    padding: 0;
    background: transparent;
    color: var(--palette-primary-main);
    border: 1.5px solid var(--palette-primary-main);
    border-radius: var(--shape-border-radius);
    cursor: pointer;
    transition: background 0.2s, color 0.2s;

    svg {
        width: 22px;
        height: 22px;
        fill: currentColor;
    }

    &:hover {
        background: var(--palette-primary-main);
        color: var(--print-button-hover-text);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 2px;
    }

    @media print {
        display: none !important;
    }
`;

export const PrintFilterSummary = styled.div`
    display: none;

    @media print {
        display: block !important;
        margin-bottom: 12pt;
        padding: 8pt 10pt;
        border: 1pt solid #ccc;
        border-radius: 4pt;
        font-size: 9pt;
        color: #444;
        background: #f9f9f9;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .pfs-label {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-size: 8pt;
        color: #666;
        margin-bottom: 3pt;
    }

    .pfs-criteria {
        font-size: 9.5pt;
        color: #222;
        margin-bottom: 4pt;
    }

    .pfs-date {
        font-size: 8pt;
        color: #888;
    }
`;
