import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TocNav, TocPageAside, TocPageLayoutGrid, TocPageMain } from '../styles';
import { useTocScrollSpy } from '../useTocScrollSpy';

/**
 * Wide screens: sticky TOC column + main content. Narrow: stacked (TOC first).
 * @param {{ toc: React.ReactNode, children: React.ReactNode }} props
 */
export function TocPageLayout({ toc, children }) {
    const { t } = useTranslation();
    const tocRef = useRef(null);
    useTocScrollSpy(tocRef);

    return (
        <TocPageLayoutGrid>
            <TocPageAside>
                <TocNav ref={tocRef} aria-label={t('common.tableOfContentsNavLabel')}>
                    {toc}
                </TocNav>
            </TocPageAside>
            <TocPageMain>{children}</TocPageMain>
        </TocPageLayoutGrid>
    );
}
