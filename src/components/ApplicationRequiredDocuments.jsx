import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heading, SubHeading, Paragraph, InlineLink, BackToTop, nestedListStyle, nestedUlStyle, PrintHeader, PageHeader, FilteredSection } from '../styles';
import { TocPageLayout } from './TocPageLayout';
import ApplicantWizard, { loadProfile } from './ApplicantWizard';
import { ApplyFlowSubnav } from './ApplyFlowSubnav';
import { withDarkPath } from '../routePaths';
import carwoodsLogo from '../assets/carwoods-logo.png';

const ApplicationRequiredDocuments = () => {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [profile, setProfile] = useState(() => loadProfile());

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const f = profile;

  const show = {
    employed:      !f || f.employment === 'employed' || f.employment === 'both',
    selfEmployed:  !f || f.employment === 'self-employed' || f.employment === 'both',
    petsSection:   !f || (f.hasPets && f.hasPets !== 'none'),
    petsOnly:      !f || f.hasPets === 'pets',
    serviceAnimal: !f || f.hasPets === 'service',
    esa:           !f || f.hasPets === 'esa',
    benefits:      !f || (Array.isArray(f.benefits) && f.benefits.some(b => b !== 'none')),
    va:            !f || (Array.isArray(f.benefits) && f.benefits.includes('va')),
    ssaSsi:        !f || (Array.isArray(f.benefits) && f.benefits.includes('ssa-ssi')),
    ssdi:          !f || (Array.isArray(f.benefits) && f.benefits.includes('ssdi')),
    retirement:    !f || (Array.isArray(f.benefits) && f.benefits.includes('retirement')),
    childSupport:  !f || (Array.isArray(f.benefits) && f.benefits.includes('child-support')),
    otherBenefits: !f || (Array.isArray(f.benefits) && f.benefits.includes('other-benefits')),
    section8:      !f || f.section8 === 'yes',
    guarantor:     !f || f.guarantorCosigner === 'guarantor' || f.guarantorCosigner === 'not-sure',
    cosigner:      !f || f.guarantorCosigner === 'cosigner' || f.guarantorCosigner === 'not-sure',
  };

  const anyBenefitSubsection = show.va || show.ssaSsi || show.ssdi || show.retirement || show.childSupport || show.otherBenefits;

  const docSectionNumbers = useMemo(() => {
    const benefitsVisible = show.benefits && anyBenefitSubsection;
    const seq = [
      ['identification', true],
      ['employed', show.employed],
      ['self-employed', show.selfEmployed],
      ['rental-history', true],
      ['pets-animals', show.petsSection],
      ['benefits', benefitsVisible],
      ['emergency-contact', true],
      ['section-8', show.section8],
      ['guarantor', show.guarantor],
      ['cosigner', show.cosigner],
    ];
    let i = 0;
    const map = {};
    seq.forEach(([key, visible]) => {
      if (visible) {
        i += 1;
        map[key] = i;
      }
    });
    return map;
  }, [
    show.employed,
    show.selfEmployed,
    show.petsSection,
    show.benefits,
    anyBenefitSubsection,
    show.section8,
    show.guarantor,
    show.cosigner,
  ]);

  const docTitle = (key, text) => {
    const n = docSectionNumbers[key];
    return n != null ? `${n}. ${text}` : text;
  };

  return (
    <div>
      <Helmet>
        <title>{t('requiredDocs.title')}</title>
      </Helmet>

      <PrintHeader>
        <img src={carwoodsLogo} alt={t('common.carwoodsAlt')} />
      </PrintHeader>
      <PageHeader>
        <Heading>{t('requiredDocs.heading')}</Heading>
      </PageHeader>

      <ApplyFlowSubnav phase="documents" />

      <Paragraph>{t('requiredDocs.fairHousing')}</Paragraph>

      <Paragraph>
        {t('requiredDocs.intro')}{' '}
        <InlineLink href={withDarkPath(pathname, '/tenant-selection-criteria')}>{t('requiredDocs.introLink')}</InlineLink>{' '}
        {t('requiredDocs.introSuffix')}
      </Paragraph>

      <ApplicantWizard onProfileChange={setProfile} />

      <TocPageLayout
        toc={
          <>
            <SubHeading>{t('requiredDocs.tocContents')}</SubHeading>
            <ol>
              <li><a href="#identification">{t('requiredDocs.tocIdentification')}</a></li>
              {show.employed && <li><a href="#employed">{t('requiredDocs.tocEmployed')}</a></li>}
              {show.selfEmployed && <li><a href="#self-employed">{t('requiredDocs.tocSelfEmployed')}</a></li>}
              <li><a href="#rental-history">{t('requiredDocs.tocRentalHistory')}</a></li>
              {show.petsSection && (
                <li>
                  <a href="#pets-animals">{t('requiredDocs.tocPetsAnimals')}</a>
                  <ol type="a">
                    {show.petsOnly && <li><a href="#pets-only">{t('requiredDocs.tocPetsOnly')}</a></li>}
                    {show.serviceAnimal && <li><a href="#service-animals">{t('requiredDocs.tocServiceAnimals')}</a></li>}
                    {show.esa && <li><a href="#esa">{t('requiredDocs.tocEsa')}</a></li>}
                  </ol>
                </li>
              )}
              {show.benefits && anyBenefitSubsection && (
                <li>
                  <a href="#benefits">{t('requiredDocs.tocBenefits')}</a>
                  <ol type="a">
                    {show.va && <li><a href="#va-benefits">{t('requiredDocs.tocVa')}</a></li>}
                    {show.ssaSsi && <li><a href="#ssa-ssi">{t('requiredDocs.tocSsaSsi')}</a></li>}
                    {show.ssdi && <li><a href="#ssdi">{t('requiredDocs.tocSsdi')}</a></li>}
                    {show.retirement && <li><a href="#retirement">{t('requiredDocs.tocRetirement')}</a></li>}
                    {show.childSupport && <li><a href="#child-support">{t('requiredDocs.tocChildSupport')}</a></li>}
                    {show.otherBenefits && <li><a href="#other-benefits">{t('requiredDocs.tocOtherBenefits')}</a></li>}
                  </ol>
                </li>
              )}
              <li><a href="#emergency-contact">{t('requiredDocs.tocEmergencyContact')}</a></li>
              {show.section8 && <li><a href="#section-8">{t('requiredDocs.tocSection8')}</a></li>}
              {show.guarantor && <li><a href="#guarantor">{t('requiredDocs.tocGuarantor')}</a></li>}
              {show.cosigner && <li><a href="#cosigner">{t('requiredDocs.tocCosigner')}</a></li>}
            </ol>
          </>
        }
      >
      <section id="identification" aria-labelledby="heading-identification">
        <SubHeading id="heading-identification">{docTitle('identification', t('requiredDocs.idHeading'))}</SubHeading>
        <ol style={nestedListStyle}>
          <li>{t('requiredDocs.id1')}</li>
          <li>
            {t('requiredDocs.id2')}
            <ul style={nestedUlStyle}>
              <li>{t('requiredDocs.id2a')}</li>
              <li>{t('requiredDocs.id2b')}</li>
              <li>{t('requiredDocs.id2c')}</li>
              <li>{t('requiredDocs.id2d')}</li>
            </ul>
          </li>
        </ol>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </section>

      <FilteredSection id="employed" aria-labelledby="heading-employed" data-filtered={String(!show.employed)}>
        <SubHeading id="heading-employed">{docTitle('employed', t('requiredDocs.employedHeading'))}</SubHeading>
        <ol style={nestedListStyle}>
          <li>{t('requiredDocs.emp1')}</li>
          <li>{t('requiredDocs.emp2')}</li>
          <li>{t('requiredDocs.emp3')}</li>
          <li>{t('requiredDocs.emp4')}</li>
        </ol>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>

      <FilteredSection id="self-employed" aria-labelledby="heading-self-employed" data-filtered={String(!show.selfEmployed)}>
        <SubHeading id="heading-self-employed">{docTitle('self-employed', t('requiredDocs.selfEmployedHeading'))}</SubHeading>
        <ol style={nestedListStyle}>
          <li>{t('requiredDocs.se1')}</li>
          <li>{t('requiredDocs.se2')}</li>
          <li>{t('requiredDocs.se3')}</li>
        </ol>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>

      <section id="rental-history" aria-labelledby="heading-rental-history">
        <SubHeading id="heading-rental-history">{docTitle('rental-history', t('requiredDocs.rentalHistHeading'))}</SubHeading>
        <ol style={nestedListStyle}>
          <li>{t('requiredDocs.rh1')}</li>
          <li>{t('requiredDocs.rh2')}</li>
        </ol>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </section>

      <FilteredSection id="pets-animals" aria-labelledby="heading-pets-animals" data-filtered={String(!show.petsSection)}>
        <SubHeading id="heading-pets-animals">{docTitle('pets-animals', t('requiredDocs.petsAnimalsHeading'))}</SubHeading>
        <ol type="a" style={nestedListStyle}>
          <li id="pets-only" style={!show.petsOnly ? { display: 'none' } : undefined}>
            <strong>{t('requiredDocs.petsLi')}</strong>
          </li>
          <li id="service-animals" style={!show.serviceAnimal ? { display: 'none' } : undefined}>
            <strong>{t('requiredDocs.serviceAnimalLi')}</strong>
            <ul style={nestedUlStyle}>
              <li>{t('requiredDocs.sa1')}</li>
              <li>{t('requiredDocs.sa2')}</li>
            </ul>
            {t('requiredDocs.saFooter')}
          </li>
          <li id="esa" style={!show.esa ? { display: 'none' } : undefined}>
            <strong>{t('requiredDocs.esaLi')}</strong>
            <ul style={nestedUlStyle}>
              <li>{t('requiredDocs.esa1')}</li>
              <li>{t('requiredDocs.esa2')}</li>
              <li>{t('requiredDocs.esa3')}</li>
              <li>{t('requiredDocs.esa4')}</li>
              <li>{t('requiredDocs.esa5')}</li>
            </ul>
            <strong>{t('requiredDocs.esaFooter')}</strong>
          </li>
        </ol>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>

      <FilteredSection id="benefits" aria-labelledby="heading-benefits" data-filtered={String(!(show.benefits && anyBenefitSubsection))}>
        <SubHeading id="heading-benefits">{docTitle('benefits', t('requiredDocs.benefitsHeading'))}</SubHeading>
        <ol type="a" style={nestedListStyle}>
          <li id="va-benefits" style={!show.va ? { display: 'none' } : undefined}>
            <strong>{t('requiredDocs.vaLi')}</strong>
            <ul style={nestedUlStyle}>
              <li>{t('requiredDocs.va1')}</li>
              <li>{t('requiredDocs.va2')}</li>
              <li>{t('requiredDocs.va3')}</li>
            </ul>
          </li>
          <li id="ssa-ssi" style={!show.ssaSsi ? { display: 'none' } : undefined}>
            <strong>{t('requiredDocs.ssaSsiLi')}</strong>
            <ul style={nestedUlStyle}>
              <li>{t('requiredDocs.ssaSsi1')}</li>
              <li>{t('requiredDocs.ssaSsi2')}</li>
            </ul>
          </li>
          <li id="ssdi" style={!show.ssdi ? { display: 'none' } : undefined}>
            <strong>{t('requiredDocs.ssdiLi')}</strong>
            <ul style={nestedUlStyle}>
              <li>{t('requiredDocs.ssdi1')}</li>
              <li>{t('requiredDocs.ssdi2')}</li>
            </ul>
          </li>
          <li id="retirement" style={!show.retirement ? { display: 'none' } : undefined}>
            <strong>{t('requiredDocs.retirementLi')}</strong>
            <ul style={nestedUlStyle}>
              <li>{t('requiredDocs.ret1')}</li>
              <li>{t('requiredDocs.ret2')}</li>
            </ul>
          </li>
          <li id="child-support" style={!show.childSupport ? { display: 'none' } : undefined}>
            <strong>{t('requiredDocs.childSupportLi')}</strong>
            <ul style={nestedUlStyle}>
              <li>{t('requiredDocs.cs1')}</li>
              <li>{t('requiredDocs.cs2')}</li>
            </ul>
          </li>
          <li id="other-benefits" style={!show.otherBenefits ? { display: 'none' } : undefined}>
            <strong>{t('requiredDocs.otherBenefitsLi')}</strong>
          </li>
        </ol>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>

      <section id="emergency-contact" aria-labelledby="heading-emergency-contact">
        <SubHeading id="heading-emergency-contact">{docTitle('emergency-contact', t('requiredDocs.emergencyHeading'))}</SubHeading>
        <ol style={nestedListStyle}>
          <li>{t('requiredDocs.em1')}</li>
        </ol>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </section>

      <FilteredSection id="section-8" aria-labelledby="heading-section-8" data-filtered={String(!show.section8)}>
        <SubHeading id="heading-section-8">{docTitle('section-8', t('requiredDocs.sec8Heading'))}</SubHeading>
        <ol style={nestedListStyle}>
          <li>{t('requiredDocs.s8Li1')}</li>
          <li>{t('requiredDocs.s8Li2')}</li>
          <li>{t('requiredDocs.s8Li3')}</li>
          <li>{t('requiredDocs.s8Li4')}</li>
          <li>{t('requiredDocs.s8Li5')}</li>
          <li>{t('requiredDocs.s8Li6')}</li>
          <li>{t('requiredDocs.s8Li7')}</li>
          <li>{t('requiredDocs.s8Li8')}</li>
        </ol>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>

      <FilteredSection id="guarantor" aria-labelledby="heading-guarantor" data-filtered={String(!show.guarantor)}>
        <SubHeading id="heading-guarantor">{docTitle('guarantor', t('requiredDocs.guarantorHeading'))}</SubHeading>
        <Paragraph>
          {t('requiredDocs.guarantorIntro')}{' '}
          <InlineLink href={withDarkPath(pathname, '/tenant-selection-criteria')}>{t('requiredDocs.guarantorIntroLink')}</InlineLink>{' '}
          {t('requiredDocs.guarantorIntroSuffix')}
        </Paragraph>
        <ol style={nestedListStyle}>
          <li>{t('requiredDocs.g1')}</li>
          <li>{t('requiredDocs.g2')}</li>
          <li>{t('requiredDocs.g3')}</li>
          <li>{t('requiredDocs.g4')}</li>
          <li>{t('requiredDocs.g5')}</li>
          <li>{t('requiredDocs.g6')}</li>
          <li>{t('requiredDocs.g7')}</li>
          <li>{t('requiredDocs.g8')}</li>
        </ol>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>

      <FilteredSection id="cosigner" aria-labelledby="heading-cosigner" data-filtered={String(!show.cosigner)}>
        <SubHeading id="heading-cosigner">{docTitle('cosigner', t('requiredDocs.cosignerHeading'))}</SubHeading>
        <Paragraph>
          {t('requiredDocs.cosignerIntro')}{' '}
          <InlineLink href={withDarkPath(pathname, '/tenant-selection-criteria')}>{t('requiredDocs.cosignerIntroLink')}</InlineLink>{' '}
          {t('requiredDocs.cosignerIntroSuffix')}
        </Paragraph>
        <ol style={nestedListStyle}>
          <li>{t('requiredDocs.c1')}</li>
          <li>{t('requiredDocs.c2')}</li>
          <li>{t('requiredDocs.c3')}</li>
          <li>{t('requiredDocs.c4')}</li>
          <li>{t('requiredDocs.c5')}</li>
          <li>{t('requiredDocs.c6')}</li>
          <li>{t('requiredDocs.c7')}</li>
          <li>{t('requiredDocs.c8')}</li>
        </ol>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>
      </TocPageLayout>
    </div>
  );
};

export default ApplicationRequiredDocuments;
