import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Heading, SubHeading, Paragraph, BackToTop, PrintHeader, PageHeader } from '../styles';
import { TocPageLayout } from './TocPageLayout';
import carwoodsLogo from '../assets/carwoods-logo.png';

const PropertyManagement = () => {
  const { t } = useTranslation();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
        <div>
            <Helmet>
                <title>{t('propertyManagement.title')}</title>
            </Helmet>
            <PrintHeader>
              <img src={carwoodsLogo} alt={t('common.carwoodsAlt')} />
            </PrintHeader>
            <PageHeader>
              <Heading>{t('propertyManagement.heading')}</Heading>
            </PageHeader>

            <TocPageLayout
              toc={
                <>
                  <SubHeading>{t('common.contents')}</SubHeading>
                  <ol>
                    <li><a href="#section-1">{t('propertyManagement.toc1')}</a></li>
                    <li><a href="#section-2">{t('propertyManagement.toc2')}</a></li>
                    <li><a href="#section-3">{t('propertyManagement.toc3')}</a></li>
                    <li><a href="#section-4">{t('propertyManagement.toc4')}</a></li>
                    <li><a href="#section-5">{t('propertyManagement.toc5')}</a></li>
                    <li><a href="#section-6">{t('propertyManagement.toc6')}</a></li>
                    <li><a href="#section-7">{t('propertyManagement.toc7')}</a></li>
                    <li><a href="#section-8">{t('propertyManagement.toc8')}</a></li>
                    <li><a href="#section-9">{t('propertyManagement.toc9')}</a></li>
                    <li><a href="#section-10">{t('propertyManagement.toc10')}</a></li>
                    <li><a href="#section-11">{t('propertyManagement.toc11')}</a></li>
                    <li><a href="#section-12">{t('propertyManagement.toc12')}</a></li>
                  </ol>
                </>
              }
            >
            <section aria-labelledby="section-1">
                <SubHeading id="section-1">{t('propertyManagement.s1Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s1Body')}</Paragraph>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>

            <section aria-labelledby="section-2">
                <SubHeading id="section-2">{t('propertyManagement.s2Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s2Body')}</Paragraph>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>

            <section aria-labelledby="section-3">
                <SubHeading id="section-3">{t('propertyManagement.s3Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s3Body')}</Paragraph>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>

            <section aria-labelledby="section-4">
                <SubHeading id="section-4">{t('propertyManagement.s4Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s4Intro')}</Paragraph>
                <ul>
                    <li>{t('propertyManagement.s4Li1')}</li>
                    <li>{t('propertyManagement.s4Li2')}</li>
                    <li>{t('propertyManagement.s4Li3')}</li>
                    <li>{t('propertyManagement.s4Li4')}</li>
                    <li>{t('propertyManagement.s4Li5')}</li>
                    <li>{t('propertyManagement.s4Li6')}</li>
                    <li>{t('propertyManagement.s4Li7')}</li>
                    <li>{t('propertyManagement.s4Li8')}</li>
                    <li>{t('propertyManagement.s4Li9')}</li>
                </ul>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>

            <section aria-labelledby="section-5">
                <SubHeading id="section-5">{t('propertyManagement.s5Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s5Intro')}</Paragraph>
                <ul>
                    <li>{t('propertyManagement.s5Li1')}</li>
                    <li>{t('propertyManagement.s5Li2')}</li>
                    <li>{t('propertyManagement.s5Li3')}</li>
                </ul>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>

            <section aria-labelledby="section-6">
                <SubHeading id="section-6">{t('propertyManagement.s6Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s6Body1')}</Paragraph>
                <Paragraph>{t('propertyManagement.s6Body2')}</Paragraph>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>

            <section aria-labelledby="section-7">
                <SubHeading id="section-7">{t('propertyManagement.s7Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s7Intro')}</Paragraph>
                <ul>
                    <li>{t('propertyManagement.s7Li1')}</li>
                    <li>{t('propertyManagement.s7Li2')}</li>
                    <li>{t('propertyManagement.s7Li3')}</li>
                </ul>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>

            <section aria-labelledby="section-8">
                <SubHeading id="section-8">{t('propertyManagement.s8Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s8Intro')}</Paragraph>
                <ol>
                    <li>{t('propertyManagement.s8Li1')}</li>
                    <li>{t('propertyManagement.s8Li2')}</li>
                    <li>{t('propertyManagement.s8Li3')}</li>
                    <li>{t('propertyManagement.s8Li4')}</li>
                </ol>
                <Paragraph>{t('propertyManagement.s8Footer')}</Paragraph>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>

            <section aria-labelledby="section-9">
                <SubHeading id="section-9">{t('propertyManagement.s9Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s9Body')}</Paragraph>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>

            <section aria-labelledby="section-10">
                <SubHeading id="section-10">{t('propertyManagement.s10Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s10Body')}</Paragraph>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>

            <section aria-labelledby="section-11">
                <SubHeading id="section-11">{t('propertyManagement.s11Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s11Body')}</Paragraph>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>

            <section aria-labelledby="section-12">
                <SubHeading id="section-12">{t('propertyManagement.s12Heading')}</SubHeading>
                <Paragraph>{t('propertyManagement.s12Body')}</Paragraph>
                <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
            </section>
            </TocPageLayout>
        </div>
    );
};

export default PropertyManagement;
