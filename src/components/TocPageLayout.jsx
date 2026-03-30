import React, { useRef } from 'react';
import { TocNav, TocPageAside, TocPageLayoutGrid, TocPageMain } from '../styles';
import { useTocScrollSpy } from '../useTocScrollSpy';

/**
 * Wide screens: sticky TOC column + main content. Narrow: stacked (TOC first).
 * @param {{ toc: React.ReactNode, children: React.ReactNode }} props
 */
export function TocPageLayout({ toc, children }) {
    const tocRef = useRef(null);
    useTocScrollSpy(tocRef);

    return (
        <TocPageLayoutGrid>
            <TocPageAside>
                <TocNav ref={tocRef} aria-label="Table of contents">
                    {toc}
                </TocNav>
            </TocPageAside>
            <TocPageMain>{children}</TocPageMain>
        </TocPageLayoutGrid>
    );
}
