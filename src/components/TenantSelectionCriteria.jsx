import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Heading, SubHeading, SectionHeading, Paragraph, BackToTop, nestedListStyle, nestedUlStyle, PrintHeader, PrintHeaderLogo, PrintHeaderLogoPrint, PrintFilterSummary, PageHeader, FilteredSection } from '../styles';
import { TocPageLayout } from './TocPageLayout';
import ApplicantWizard, { loadProfile, buildChipLabel } from './ApplicantWizard';
import { ApplyFlowSubnav } from './ApplyFlowSubnav';
import carwoodsLogo from '../assets/carwoods-logo.png';
import carwoodsLogoPrint from '../assets/carwoods-logo-print.png';

const TenantSelectionCriteria = () => {
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
    housingAssistance: !f || f.section8 === 'yes',
    creditException:   !f || f.creditScore === 'below-650' || f.creditScore === 'unknown',
    guarantorPolicy:   !f || f.guarantorCosigner === 'guarantor' || f.guarantorCosigner === 'not-sure',
    cosignerPolicy:    !f || f.guarantorCosigner === 'cosigner' || f.guarantorCosigner === 'not-sure',
    pets:              !f || (f.hasPets && f.hasPets !== 'none'),
    assistanceAnimals: !f || f.hasPets === 'service' || f.hasPets === 'esa',
    petsRestrictions:  !f || f.hasPets === 'pets',
  };

  const petRestrictionLetters = show.assistanceAnimals
    ? { prohibited: 'b', caged: 'c', breeds: 'd' }
    : { prohibited: 'a', caged: 'b', breeds: 'c' };

  const sectionNumbers = useMemo(() => {
    const seq = [
      ['non-negotiable', true],
      ['at-a-glance', true],
      ['details', true],
      ['housing-assistance', show.housingAssistance],
      ['credit-exception', show.creditException],
      ['guarantor-policy', show.guarantorPolicy],
      ['cosigner-policy', show.cosignerPolicy],
      ['pets', show.pets],
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
    show.housingAssistance,
    show.creditException,
    show.guarantorPolicy,
    show.cosignerPolicy,
    show.pets,
  ]);

  const sectionTitle = (key, text) => {
    const n = sectionNumbers[key];
    return n != null ? `${n}. ${text}` : text;
  };

  return (
    <div className="tenant-criteria">
      <Helmet>
        <title>{t('tenantCriteria.title')}</title>
      </Helmet>

      <PrintHeader>
        <PrintHeaderLogo src={carwoodsLogo} alt="" aria-hidden />
        <PrintHeaderLogoPrint src={carwoodsLogoPrint} alt={t('common.carwoodsAlt')} />
      </PrintHeader>
      <PrintFilterSummary>
        <div className="pfs-label">{t('tenantCriteria.filteredView')}</div>
        <div className="pfs-criteria">
          {profile ? buildChipLabel(profile, t) : t('tenantCriteria.noFilters')}
        </div>
        <div className="pfs-date">
          {t('tenantCriteria.generated')} {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </PrintFilterSummary>
      <PageHeader>
        <Heading>{t('tenantCriteria.heading')}</Heading>
      </PageHeader>

      <ApplyFlowSubnav phase="eligibility" />

      <Paragraph>{t('tenantCriteria.fairHousing')}</Paragraph>

      <Paragraph>
        {t('tenantCriteria.allMust')}
      </Paragraph>

      <ApplicantWizard onProfileChange={setProfile} />

      <TocPageLayout
        toc={
          <>
            <SubHeading>{t('tenantCriteria.tocContents')}</SubHeading>
            <ol>
              <li><a href="#non-negotiable">{t('tenantCriteria.toc1')}</a></li>
              <li><a href="#at-a-glance">{t('tenantCriteria.toc2')}</a></li>
              <li>
                <a href="#details">{t('tenantCriteria.toc3')}</a>
                <ol type="a">
                  <li><a href="#employment">{t('tenantCriteria.toc3a')}</a></li>
                  <li><a href="#income">{t('tenantCriteria.toc3b')}</a></li>
                  <li><a href="#rental-history">{t('tenantCriteria.toc3c')}</a></li>
                  <li><a href="#credit">{t('tenantCriteria.toc3d')}</a></li>
                  <li><a href="#background">{t('tenantCriteria.toc3e')}</a></li>
                </ol>
              </li>
              {show.housingAssistance && <li><a href="#housing-assistance">{t('tenantCriteria.toc4')}</a></li>}
              {show.creditException && <li><a href="#credit-exception">{t('tenantCriteria.toc5')}</a></li>}
              {show.guarantorPolicy && (
                <li>
                  <a href="#guarantor-policy">{t('tenantCriteria.toc6')}</a>
                  <ol type="a">
                    <li><a href="#guarantor-when">{t('tenantCriteria.toc6a')}</a></li>
                    <li><a href="#guarantor-qualification">{t('tenantCriteria.toc6b')}</a></li>
                    <li><a href="#guarantor-legal">{t('tenantCriteria.toc6c')}</a></li>
                    <li><a href="#guarantor-notes">{t('tenantCriteria.toc6d')}</a></li>
                  </ol>
                </li>
              )}
              {show.cosignerPolicy && (
                <li>
                  <a href="#cosigner-policy">{t('tenantCriteria.toc7')}</a>
                  <ol type="a">
                    <li><a href="#cosigner-differences">{t('tenantCriteria.toc7a')}</a></li>
                    <li><a href="#cosigner-when">{t('tenantCriteria.toc7b')}</a></li>
                    <li><a href="#cosigner-qualification">{t('tenantCriteria.toc7c')}</a></li>
                    <li><a href="#cosigner-legal">{t('tenantCriteria.toc7d')}</a></li>
                    <li><a href="#cosigner-notes">{t('tenantCriteria.toc7e')}</a></li>
                  </ol>
                </li>
              )}
              {show.pets && (
                <li>
                  <a href="#pets">{t('tenantCriteria.toc8')}</a>
                  <ol type="a">
                    {show.assistanceAnimals && (
                      <li><a href="#assistance-animals">{t('tenantCriteria.toc8a')}</a></li>
                    )}
                    {show.petsRestrictions && (
                      <>
                        <li><a href="#pets-prohibited">{t('tenantCriteria.toc8b')}</a></li>
                        <li><a href="#pets-caged">{t('tenantCriteria.toc8c')}</a></li>
                        <li><a href="#pets-breeds">{t('tenantCriteria.toc8d')}</a></li>
                      </>
                    )}
                  </ol>
                </li>
              )}
            </ol>
          </>
        }
      >
      <section id="non-negotiable" aria-labelledby="heading-non-negotiable">
        <SubHeading id="heading-non-negotiable">{sectionTitle('non-negotiable', t('tenantCriteria.nonNegHeading'))}</SubHeading>
        <ul>
          <li>{t('tenantCriteria.nonNeg1')}</li>
          <li>{t('tenantCriteria.nonNeg2')}</li>
          <li>{t('tenantCriteria.nonNeg3')}</li>
          <li>{t('tenantCriteria.nonNeg4')}</li>
          <li>{t('tenantCriteria.nonNeg5')}</li>
        </ul>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </section>

      <section id="at-a-glance" aria-labelledby="heading-at-a-glance">
        <SubHeading id="heading-at-a-glance">{sectionTitle('at-a-glance', t('tenantCriteria.glanceHeading'))}</SubHeading>
        <ul>
          <li><strong>{t('tenantCriteria.glance1').split(':')[0]}:</strong>{t('tenantCriteria.glance1').split(':').slice(1).join(':')}</li>
          <li><strong>{t('tenantCriteria.glance2').split(':')[0]}:</strong>{t('tenantCriteria.glance2').split(':').slice(1).join(':')}</li>
          <li><strong>{t('tenantCriteria.glance3').split(':')[0]}:</strong>{t('tenantCriteria.glance3').split(':').slice(1).join(':')}</li>
          <li><strong>{t('tenantCriteria.glance4').split(':')[0]}:</strong>{t('tenantCriteria.glance4').split(':').slice(1).join(':')}</li>
          <li><strong>{t('tenantCriteria.glance5').split(':')[0]}:</strong>{t('tenantCriteria.glance5').split(':').slice(1).join(':')}</li>
        </ul>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </section>

      <section id="details" aria-labelledby="heading-details">
        <SubHeading id="heading-details">{sectionTitle('details', t('tenantCriteria.detailsHeading'))}</SubHeading>

        <SectionHeading id="employment">{t('tenantCriteria.employmentHeading')}</SectionHeading>
        <ul>
          <li>{t('tenantCriteria.emp1')}</li>
          <li>{t('tenantCriteria.emp2')}</li>
          <li>{t('tenantCriteria.emp3')}</li>
          <li>{t('tenantCriteria.emp4')}</li>
        </ul>

        <SectionHeading id="income">{t('tenantCriteria.incomeHeading')}</SectionHeading>
        <ul>
          <li>{t('tenantCriteria.inc1')}</li>
          <li>{t('tenantCriteria.inc2')}</li>
          <li>{t('tenantCriteria.inc3')}</li>
          <li>{t('tenantCriteria.inc4')}</li>
        </ul>

        <SectionHeading id="rental-history">{t('tenantCriteria.rentalHistHeading')}</SectionHeading>
        <ul>
          <li>{t('tenantCriteria.rh1')}</li>
          <li>{t('tenantCriteria.rh2')}</li>
          <li>{t('tenantCriteria.rh3')}</li>
          <li>{t('tenantCriteria.rh4')}</li>
        </ul>

        <SectionHeading id="credit">{t('tenantCriteria.creditHeading')}</SectionHeading>
        <ul>
          <li>{t('tenantCriteria.cred1')}</li>
          <li>
            {t('tenantCriteria.cred2')}
            <ul style={nestedUlStyle}>
              <li>{t('tenantCriteria.cred2a')}</li>
              <li>{t('tenantCriteria.cred2b')}</li>
              <li>{t('tenantCriteria.cred2c')}</li>
            </ul>
          </li>
          <li>{t('tenantCriteria.cred3')}</li>
        </ul>

        <SectionHeading id="background">{t('tenantCriteria.backgroundHeading')}</SectionHeading>
        <ul>
          <li><strong>{t('tenantCriteria.bg1')}</strong></li>
          <li><strong>{t('tenantCriteria.bg2')}</strong></li>
          <li><strong>{t('tenantCriteria.bg3')}</strong></li>
          <li><strong>{t('tenantCriteria.bg4')}</strong></li>
          <li>{t('tenantCriteria.bg5')}</li>
          <li>{t('tenantCriteria.bg6')}</li>
        </ul>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </section>

      <FilteredSection id="housing-assistance" aria-labelledby="heading-housing-assistance" data-filtered={String(!show.housingAssistance)}>
        <SubHeading id="heading-housing-assistance">{sectionTitle('housing-assistance', t('tenantCriteria.housingAssistHeading'))}</SubHeading>
        <ul style={nestedListStyle}>
          <li>{t('tenantCriteria.ha1')}</li>
          <li>{t('tenantCriteria.ha2')}</li>
          <li>{t('tenantCriteria.ha3')}</li>
          <li>{t('tenantCriteria.ha4')}</li>
          <li>{t('tenantCriteria.ha5')}</li>
          <li>{t('tenantCriteria.ha6')}</li>
        </ul>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>

      <FilteredSection id="credit-exception" aria-labelledby="heading-credit-exception" data-filtered={String(!show.creditException)}>
        <SubHeading id="heading-credit-exception">{sectionTitle('credit-exception', t('tenantCriteria.creditExcHeading'))}</SubHeading>
        <Paragraph>{t('tenantCriteria.creditExcIntro')}</Paragraph>
        <ul>
          <li>{t('tenantCriteria.ce1')}</li>
          <li>{t('tenantCriteria.ce2')}</li>
          <li>{t('tenantCriteria.ce3')}</li>
          <li>{t('tenantCriteria.ce4')}</li>
          <li>{t('tenantCriteria.ce5')}</li>
        </ul>
        <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>

      <FilteredSection id="guarantor-policy" aria-labelledby="heading-guarantor-policy" data-filtered={String(!show.guarantorPolicy)}>
          <SubHeading id="heading-guarantor-policy">{sectionTitle('guarantor-policy', t('tenantCriteria.guarantorHeading'))}</SubHeading>
          <Paragraph>{t('tenantCriteria.guarantorIntro')}</Paragraph>

          <SectionHeading id="guarantor-when">{t('tenantCriteria.gwHeading')}</SectionHeading>
          <ul>
            <li>{t('tenantCriteria.gw1')}</li>
            <li>{t('tenantCriteria.gw2')}</li>
            <li>{t('tenantCriteria.gw3')}</li>
          </ul>

          <SectionHeading id="guarantor-qualification">{t('tenantCriteria.gqHeading')}</SectionHeading>
          <ul>
            <li>{t('tenantCriteria.gq1')}</li>
            <li>{t('tenantCriteria.gq2')}</li>
            <li>{t('tenantCriteria.gq3')}</li>
            <li>{t('tenantCriteria.gq4')}</li>
            <li>{t('tenantCriteria.gq5')}</li>
            <li>{t('tenantCriteria.gq6')}</li>
            <li>{t('tenantCriteria.gq7')}</li>
          </ul>

          <SectionHeading id="guarantor-legal">{t('tenantCriteria.glHeading')}</SectionHeading>
          <ul>
            <li>{t('tenantCriteria.gl1')}</li>
            <li>{t('tenantCriteria.gl2')}</li>
            <li>{t('tenantCriteria.gl3')}</li>
            <li>{t('tenantCriteria.gl4')}</li>
            <li>{t('tenantCriteria.gl5')}</li>
          </ul>

          <SectionHeading id="guarantor-notes">{t('tenantCriteria.gnHeading')}</SectionHeading>
          <ul>
            <li>{t('tenantCriteria.gn1')}</li>
            <li>{t('tenantCriteria.gn2')}</li>
            <li>{t('tenantCriteria.gn3')}</li>
          </ul>
          <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>

      <FilteredSection id="cosigner-policy" aria-labelledby="heading-cosigner-policy" data-filtered={String(!show.cosignerPolicy)}>
          <SubHeading id="heading-cosigner-policy">{sectionTitle('cosigner-policy', t('tenantCriteria.cosignerHeading'))}</SubHeading>
          <Paragraph>{t('tenantCriteria.cosignerIntro')}</Paragraph>

          <SectionHeading id="cosigner-differences">{t('tenantCriteria.cdHeading')}</SectionHeading>
          <ul>
            <li>{t('tenantCriteria.cd1')}</li>
            <li>{t('tenantCriteria.cd2')}</li>
            <li>{t('tenantCriteria.cd3')}</li>
            <li>{t('tenantCriteria.cd4')}</li>
          </ul>

          <SectionHeading id="cosigner-when">{t('tenantCriteria.cwHeading')}</SectionHeading>
          <ul>
            <li>{t('tenantCriteria.cw1')}</li>
            <li>{t('tenantCriteria.cw2')}</li>
            <li>{t('tenantCriteria.cw3')}</li>
          </ul>

          <SectionHeading id="cosigner-qualification">{t('tenantCriteria.cqHeading')}</SectionHeading>
          <ul>
            <li>{t('tenantCriteria.cq1')}</li>
            <li>{t('tenantCriteria.cq2')}</li>
            <li>{t('tenantCriteria.cq3')}</li>
            <li>{t('tenantCriteria.cq4')}</li>
            <li>{t('tenantCriteria.cq5')}</li>
            <li>{t('tenantCriteria.cq6')}</li>
            <li>{t('tenantCriteria.cq7')}</li>
            <li>{t('tenantCriteria.cq8')}</li>
          </ul>

          <SectionHeading id="cosigner-legal">{t('tenantCriteria.clHeading')}</SectionHeading>
          <ul>
            <li>{t('tenantCriteria.cl1')}</li>
            <li>{t('tenantCriteria.cl2')}</li>
            <li>{t('tenantCriteria.cl3')}</li>
            <li>{t('tenantCriteria.cl4')}</li>
            <li>{t('tenantCriteria.cl5')}</li>
            <li>{t('tenantCriteria.cl6')}</li>
          </ul>

          <SectionHeading id="cosigner-notes">{t('tenantCriteria.cnHeading')}</SectionHeading>
          <ul>
            <li>{t('tenantCriteria.cn1')}</li>
            <li>{t('tenantCriteria.cn2')}</li>
            <li>{t('tenantCriteria.cn3')}</li>
          </ul>
          <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>

      <FilteredSection id="pets" aria-labelledby="heading-pets" data-filtered={String(!show.pets)}>
          <SubHeading id="heading-pets">{sectionTitle('pets', t('tenantCriteria.petsHeading'))}</SubHeading>
          <Paragraph>{t('tenantCriteria.petsIntro')}</Paragraph>

          {show.assistanceAnimals && (<>
          <SectionHeading id="assistance-animals">{t('tenantCriteria.assistanceHeading')}</SectionHeading>
          <Paragraph>{t('tenantCriteria.assistanceBody')}</Paragraph>
          </>)}

          {show.petsRestrictions && (<>
          <SectionHeading id="pets-prohibited">{petRestrictionLetters.prohibited}. {t('tenantCriteria.prohibitedHeading')}</SectionHeading>
          <ul>
            <li>{t('tenantCriteria.prohibitedLi1')}</li>
            <li>{t('tenantCriteria.prohibitedLi2')}</li>
            <li>{t('tenantCriteria.prohibitedLi3')}</li>
            <li>{t('tenantCriteria.prohibitedLi4')}</li>
            <li>{t('tenantCriteria.prohibitedLi5')}</li>
            <li>{t('tenantCriteria.prohibitedLi6')}</li>
          </ul>

          <SectionHeading id="pets-caged">{petRestrictionLetters.caged}. {t('tenantCriteria.cagedHeading')}</SectionHeading>
          <ul>
            <li>{t('tenantCriteria.cagedLi1')}</li>
          </ul>

          <SectionHeading id="pets-breeds">{petRestrictionLetters.breeds}. {t('tenantCriteria.breedsHeading')}</SectionHeading>
          <ul>
              <li>Akita</li>
              <li>Alaskan Malamute</li>
              <li>American Bulldog</li>
              <li>American Staffordshire Terrier</li>
              <li>American Pit Bull Terrier</li>
              <li>Beauceron</li>
              <li>Boerboel</li>
              <li>Bull Mastiff / American Bandogge / Bully Kutta (any other Mastiff breed)</li>
              <li>Cane Corso</li>
              <li>Caucasian Ovcharka (Mountain Dogs)</li>
              <li>Chow Chow</li>
              <li>Doberman Pinscher (miniature Dobermans acceptable)</li>
              <li>Dogo Argentino</li>
              <li>English Bull Terrier</li>
              <li>Fila Brasileiro (aka Brazilian Mastiff)</li>
              <li>German Shepherds</li>
              <li>Giant Schnauzer</li>
              <li>Great Dane</li>
              <li>Gull Dong (aka Pakistani Bull Dog)</li>
              <li>Gull Terrier</li>
              <li>Husky or Siberian Husky</li>
              <li>Japanese Tosa / Tosa Inu / Tosa Ken</li>
              <li>Korean Jindo</li>
              <li>Perro de Presa Canario</li>
              <li>&quot;Pit Bull&quot;</li>
              <li>Rhodesian Ridgeback</li>
              <li>Rottweiler</li>
              <li>Staffordshire Bull Terrier</li>
              <li>Thai Ridgeback</li>
              <li>Wolf or Wolf Hybrid</li>
              <li>Any mixed breed containing any of the above breeds</li>
            </ul>
          </>)}
          <BackToTop href="#page-top">{t('common.backToTop')}</BackToTop>
      </FilteredSection>
      </TocPageLayout>
    </div>
  );
};

export default TenantSelectionCriteria;
