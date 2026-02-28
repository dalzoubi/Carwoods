import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Heading, SubHeading, SectionHeading, Paragraph, TocNav, SmoothDetails, BackToTop, nestedListStyle, PrintButton, PrintHeader, PageHeader, FilteredSection } from '../styles';
import ApplicantWizard, { loadProfile } from './ApplicantWizard';
import carwoodsLogo from '../assets/carwoods-logo.png';

const TenantSelectionCriteria = () => {
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
    petsRestrictions:  !f || f.hasPets === 'pets',
  };

  return (
    <div className="tenant-criteria">
      <Helmet>
        <title>Carwoods - Tenant Selection Criteria</title>
      </Helmet>

      <span id="page-top" />
      <PrintHeader>
        <img src={carwoodsLogo} alt="Carwoods" />
      </PrintHeader>
      <PageHeader>
        <Heading>Tenant Selection Criteria</Heading>
        <PrintButton onClick={() => window.print()} aria-label="Print this page">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
          </svg>
        </PrintButton>
      </PageHeader>

      <Paragraph>
        We appreciate your interest in our properties. We do not discriminate based on race, color, religion, sex, familial status, national origin, disability, or other protected characteristics under the Texas Fair Housing Act.
      </Paragraph>

      <Paragraph>
        All applicants must meet <strong>every</strong> requirement below. These standards are applied consistently to
        all applicants, including those using housing assistance (Section 8 or similar programs). Meeting some criteria
        does not qualify an applicant.
      </Paragraph>

      <ApplicantWizard onProfileChange={setProfile} />

      <TocNav aria-label="Table of contents">
        <SubHeading>Contents</SubHeading>
        <ol>
          <li><a href="#non-negotiable">Important: Read First</a></li>
          <li><a href="#at-a-glance">At a glance</a></li>
          <li>
            <a href="#details">Details</a>
            <ol type="a">
              <li><a href="#employment">Employment</a></li>
              <li><a href="#income">Income</a></li>
              <li><a href="#rental-history">Rental history</a></li>
              <li><a href="#credit">Credit</a></li>
              <li><a href="#background">Background</a></li>
            </ol>
          </li>
          {show.housingAssistance && <li><a href="#housing-assistance">Housing Assistance</a></li>}
          {show.creditException && <li><a href="#credit-exception">Discretionary credit exception (rare)</a></li>}
          {show.guarantorPolicy && <li><a href="#guarantor-policy">Guarantor policy</a></li>}
          {show.cosignerPolicy && <li><a href="#cosigner-policy">Co-signer policy</a></li>}
          {show.pets && (
            <li>
              <a href="#pets">Pets</a>
              <ol type="a">
                <li><a href="#assistance-animals">Assistance animals</a></li>
              </ol>
            </li>
          )}
        </ol>
      </TocNav>

      <section id="non-negotiable" aria-labelledby="heading-non-negotiable">
        <SubHeading id="heading-non-negotiable">1. Important: Read First</SubHeading>
        <ul>
          <li>All requirements below are <strong>mandatory</strong>. Applications that do not meet every requirement may be <strong>denied</strong>.</li>
          <li>No verbal assurances, explanations, or promises can replace documentation.</li>
          <li>Incomplete applications will not be processed.</li>
          <li>Housing assistance (Section 8) does <strong>not</strong> waive credit, background, employment, or rental history standards.</li>
          <li>Submitting an application does not guarantee approval.</li>
        </ul>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <section id="at-a-glance" aria-labelledby="heading-at-a-glance">
        <SubHeading id="heading-at-a-glance">2. At a glance</SubHeading>
        <ul>
          <li><strong>Employment:</strong> 24+ months of verifiable employment history</li>
          <li><strong>Income:</strong> Gross monthly income ≥ 3× monthly rent (or ≥ 2.5× your tenant portion if using housing assistance)</li>
          <li><strong>Rental history:</strong> 24+ months of verifiable rental or mortgage payment history</li>
          <li><strong>Credit:</strong> Minimum score of 650 (strictly enforced)</li>
          <li><strong>Background:</strong> No criminal convictions, evictions, bankruptcies, or housing-related collections/negatives</li>
        </ul>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <section id="details" aria-labelledby="heading-details">
        <SubHeading id="heading-details">3. Details</SubHeading>

        <SectionHeading id="employment">a. Employment</SectionHeading>
        <ul>
          <li>Minimum <strong>24 consecutive months</strong> of verifiable employment history</li>
          <li>Employment gaps must be documented</li>
          <li>Recent job starts, short-term work, or unverified employment do not qualify</li>
          <li>Self-employment requires <strong>24 months of tax returns</strong></li>
        </ul>

        <SectionHeading id="income">b. Income</SectionHeading>
        <ul>
          <li>Gross monthly income must be at least <strong>3× the monthly rent</strong></li>
          <li>
            For housing assistance applicants, the income requirement is based on <strong>2.5× your tenant portion</strong> of rent as
            determined by the Housing Authority
          </li>
          <li>Income must be <strong>verifiable, recurring, and stable</strong></li>
          <li>Bank statements may be required to confirm cash-flow stability</li>
        </ul>

        <SectionHeading id="rental-history">c. Rental history</SectionHeading>
        <ul>
          <li>Minimum <strong>24 months</strong> of verifiable rental or mortgage payment history</li>
          <li>Landlord references must be verifiable and responsive</li>
          <li>Family/friend landlords are not accepted</li>
          <li>Rental history must demonstrate on-time payments and proper care of the property</li>
        </ul>

        <SectionHeading id="credit">d. Credit (strictly enforced)</SectionHeading>
        <ul>
          <li>Minimum credit score of <strong>650</strong></li>
          <li>
            The following are disqualifying:
            <ul style={nestedListStyle}>
              <li>Housing-related collections (utilities/energy/water/landlord claims)</li>
              <li>Unpaid auto loan charge-offs, repossessions, or major delinquencies</li>
              <li>Pattern of unpaid obligations or excessive collections</li>
            </ul>
          </li>
          <li>While we welcome written explanations, rental decisions are based on verified credit reports and consistent criteria</li>
        </ul>

        <SectionHeading id="background">e. Background</SectionHeading>
        <ul>
          <li><strong>No criminal convictions</strong></li>
          <li><strong>No evictions</strong></li>
          <li><strong>No bankruptcies</strong></li>
          <li><strong>No housing-related collections/negatives</strong> on the credit report</li>
          <li>We do not deny applicants based on being a victim of domestic violence, dating violence, sexual assault, or stalking, in compliance with Texas law</li>
          <li>Inconsistencies between disclosures and screening results may result in denial</li>
        </ul>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <FilteredSection id="housing-assistance" aria-labelledby="heading-housing-assistance" data-filtered={String(!show.housingAssistance)}>
        <SubHeading id="heading-housing-assistance">4. Housing Assistance (Section 8 and others)</SubHeading>
        <ul style={nestedListStyle}>
          <li>All applicants are screened using the same criteria for rental history, credit, criminal background, and references</li>
          <li>Income requirement is 2.5× your tenant portion of rent as determined by the Housing Authority</li>
          <li>Provide: valid voucher, RFTA packet, and your caseworker&apos;s contact information</li>
          <li>No side payments; all rent amounts must be approved and documented by the Housing Authority</li>
          <li>Voucher must be active and valid through the expected lease start date</li>
          <li>Move-in requires Housing Authority inspection and rent reasonableness approval</li>
        </ul>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </FilteredSection>

      <FilteredSection id="credit-exception" aria-labelledby="heading-credit-exception" data-filtered={String(!show.creditException)}>
        <SubHeading id="heading-credit-exception">5. Discretionary credit exception (rare)</SubHeading>
        <Paragraph>
          Applicants who do not meet the minimum credit score requirement may be considered <strong>only</strong> if all
          conditions below are met. Approval under this exception is not guaranteed and remains at the sole discretion of the
          owner/agent.
        </Paragraph>
        <ul>
          <li><strong>36+ months</strong> of verifiable, on-time rental history</li>
          <li><strong>No housing-related collections</strong> (utilities/energy/water/landlord claims) in the past <strong>36 months</strong></li>
          <li><strong>No unpaid auto loan charge-offs or repossessions</strong> in the past <strong>48 months</strong></li>
          <li>Demonstrated <strong>positive bank balances and cash flow</strong> for the most recent <strong>60 days</strong></li>
          <li>All other criteria (employment, income, background, references) must still be met</li>
        </ul>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </FilteredSection>

      <FilteredSection id="guarantor-policy" aria-labelledby="heading-guarantor-policy" data-filtered={String(!show.guarantorPolicy)}>
          <SubHeading id="heading-guarantor-policy">6. Guarantor policy</SubHeading>

          <SmoothDetails summary="View guarantor requirements and terms">
            <Paragraph>
              A guarantor is a qualified individual who agrees in writing to be financially responsible for the lease obligations
              if the tenant fails to pay or otherwise defaults. A guarantor is not a substitute for incomplete documentation and is
              not a &quot;character reference.&quot; Guarantors are accepted only under the standards below, which are applied consistently
              to all applicants.
            </Paragraph>

            <SectionHeading>a. When a guarantor may be considered</SectionHeading>
            <ul>
              <li>
                A guarantor may be considered only when an applicant meets <strong>all</strong> screening requirements for credit,
                background, rental history, and documentation, but does not fully meet the income requirement.
              </li>
              <li>
                A guarantor is <strong>not</strong> available to offset disqualifying items such as criminal convictions, evictions,
                bankruptcies, housing-related collections/negatives, or material misrepresentations.
              </li>
              <li>
                Approval with a guarantor is not guaranteed and remains subject to owner/agent discretion based on documented risk
                factors and consistency with published standards.
              </li>
            </ul>

            <SectionHeading>b. Guarantor qualification requirements (mandatory)</SectionHeading>
            <ul>
              <li><strong>Identity:</strong> Valid government-issued photo ID (color copy).</li>
              <li>
                <strong>Income:</strong> Verifiable gross monthly income of at least <strong>4× the monthly rent</strong> (for housing
                assistance applicants, 4× the full contract rent).
              </li>
              <li>
                <strong>Employment:</strong> 24+ months of verifiable employment or self-employment history (self-employment requires
                24 months of tax returns).
              </li>
              <li><strong>Credit:</strong> Minimum credit score of <strong>700</strong> (strictly enforced).</li>
              <li>
                <strong>Credit disqualifiers:</strong> Housing-related collections (utilities/energy/water/landlord claims), repossessions,
                charge-offs, or a pattern of unpaid obligations may result in denial.
              </li>
              <li><strong>Background:</strong> No criminal convictions, evictions, or bankruptcies.</li>
              <li><strong>Residency:</strong> Guarantor must reside in the United States and be reachable for verification.</li>
            </ul>

            <SectionHeading>c. Guarantor legal and payment terms</SectionHeading>
            <ul>
              <li>
                The guarantor must complete a separate application and pass screening. Application fees (if any) apply.
              </li>
              <li>
                The guarantor must sign a guaranty agreement that provides <strong>joint and several liability</strong> for all lease
                obligations, including rent, fees, damages, and legal costs, to the fullest extent permitted by law.
              </li>
              <li>
                The guarantor remains responsible for the lease term and any extensions/renewals unless released in writing by the
                owner/agent.
              </li>
              <li>
                The presence of a guarantor does not change payment due dates or late fee policies.
              </li>
              <li>
                At lease renewal, the tenant must independently meet all published income and qualification requirements, or the
                guarantor must agree in writing to remain in force for the renewal term. If neither condition is met, the lease may
                be non-renewed.
              </li>
            </ul>

            <SectionHeading>d. Important notes</SectionHeading>
            <ul>
              <li>No side payments or undisclosed arrangements are permitted.</li>
              <li>Documentation must be complete and verifiable. Incomplete guarantor packages will not be processed.</li>
              <li>
                Carwoods reserves the right to request additional documentation to verify identity, income, and stability.
              </li>
            </ul>
          </SmoothDetails>
          <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </FilteredSection>

      <FilteredSection id="cosigner-policy" aria-labelledby="heading-cosigner-policy" data-filtered={String(!show.cosignerPolicy)}>
          <SubHeading id="heading-cosigner-policy">7. Co-signer policy</SubHeading>

          <SmoothDetails summary="View co-signer requirements and terms">
            <Paragraph>
              A co-signer is <strong>not the same as a guarantor</strong>. A co-signer signs the lease itself as a
              co-tenant and is jointly and severally liable for all lease obligations from the first day of the tenancy —
              regardless of whether the primary tenant pays. Because a co-signer is legally a co-tenant under Texas law,
              they are subject to the <strong>full applicant screening process</strong> and must independently meet every
              published qualification standard.
            </Paragraph>

            <SectionHeading>a. Key differences from a guarantor</SectionHeading>
            <ul>
              <li><strong>Liability timing:</strong> A co-signer is liable from day one; a guarantor is only called upon after the primary tenant defaults.</li>
              <li><strong>Document signed:</strong> A co-signer signs the lease agreement itself; a guarantor signs a separate guaranty agreement.</li>
              <li><strong>Occupancy:</strong> A co-signer may or may not reside in the unit; a guarantor does not reside in the unit.</li>
              <li><strong>Qualification standard:</strong> A co-signer must meet all the same income, credit, background, employment, and rental history requirements as any primary applicant — there is no reduced standard.</li>
            </ul>

            <SectionHeading>b. When a co-signer may be considered</SectionHeading>
            <ul>
              <li>
                A co-signer may be considered only when the primary applicant meets all screening requirements for credit,
                background, rental history, and documentation, but does not fully meet the income requirement.
              </li>
              <li>
                A co-signer is <strong>not</strong> available to offset disqualifying items such as criminal convictions,
                evictions, bankruptcies, housing-related collections/negatives, or material misrepresentations by the
                primary applicant.
              </li>
              <li>
                Approval with a co-signer is not guaranteed and remains subject to owner/agent discretion.
              </li>
            </ul>

            <SectionHeading>c. Co-signer qualification requirements (mandatory)</SectionHeading>
            <ul>
              <li><strong>Identity:</strong> Valid government-issued photo ID (color copy).</li>
              <li>
                <strong>Income:</strong> Verifiable gross monthly income of at least <strong>4× the monthly rent</strong>.
                Combined household income (co-signer + primary applicant) must still demonstrate the ability to sustain the
                full rent obligation.
              </li>
              <li>
                <strong>Employment:</strong> 24+ months of verifiable employment or self-employment history (self-employment
                requires 24 months of tax returns).
              </li>
              <li><strong>Credit:</strong> Minimum credit score of <strong>700</strong> (strictly enforced).</li>
              <li>
                <strong>Credit disqualifiers:</strong> Housing-related collections (utilities/energy/water/landlord claims),
                repossessions, charge-offs, or a pattern of unpaid obligations may result in denial.
              </li>
              <li><strong>Background:</strong> No criminal convictions, evictions, or bankruptcies.</li>
              <li><strong>Rental history:</strong> 24+ months of verifiable rental or mortgage payment history.</li>
              <li><strong>Residency:</strong> Co-signer must reside in the United States and be reachable for verification.</li>
            </ul>

            <SectionHeading>d. Co-signer legal and payment terms</SectionHeading>
            <ul>
              <li>
                The co-signer must complete a full application and pass all screening. Application fees (if any) apply.
              </li>
              <li>
                The co-signer signs the lease as a co-tenant and bears <strong>joint and several liability</strong> for all
                lease obligations — including rent, fees, damages, and legal costs — from the lease start date.
              </li>
              <li>
                The co-signer&apos;s liability is not contingent on the primary tenant&apos;s default. Management may pursue the
                co-signer directly for any unpaid obligation without first exhausting remedies against the primary tenant.
              </li>
              <li>
                The co-signer remains responsible for the full lease term and any extensions or renewals unless released in
                writing by the owner/agent.
              </li>
              <li>
                At lease renewal, all co-signers must re-qualify under the then-current published standards, or the lease
                may be non-renewed.
              </li>
              <li>
                The presence of a co-signer does not change payment due dates, late fee policies, or any other lease terms.
              </li>
            </ul>

            <SectionHeading>e. Important notes</SectionHeading>
            <ul>
              <li>No side payments or undisclosed arrangements are permitted.</li>
              <li>Documentation must be complete and verifiable. Incomplete co-signer packages will not be processed.</li>
              <li>
                Carwoods reserves the right to request additional documentation to verify identity, income, and stability.
              </li>
            </ul>
          </SmoothDetails>
          <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </FilteredSection>

      <FilteredSection id="pets" aria-labelledby="heading-pets" data-filtered={String(!show.pets)}>
          <SubHeading id="heading-pets">8. Pets</SubHeading>

          <Paragraph>
            Pets are subject to separate approval. Restrictions may apply by type, breed, size, and quantity. Pet approval is not
            guaranteed even if all other criteria are met.
          </Paragraph>

          <SectionHeading id="assistance-animals">a. Assistance animals</SectionHeading>
          <Paragraph>
            Assistance animals (service animals and emotional support animals) are <strong>not pets</strong>. They are reasonable
            accommodations for disabilities under the Fair Housing Act. Breed, size, and species restrictions do not apply to
            assistance animals when properly documented. We evaluate assistance-animal requests in accordance with applicable law.
          </Paragraph>

          {show.petsRestrictions && (<>
          <SectionHeading>b. Prohibited animals</SectionHeading>
          <ul>
            <li>Exotic animals</li>
            <li>Farm animals (e.g., hoofed animals, livestock)</li>
            <li>Saddle animals</li>
            <li>Reptiles</li>
            <li>Primates</li>
            <li>Fowl</li>
          </ul>

          <SectionHeading>c. Caged animals</SectionHeading>
          <ul>
            <li>No caged animals allowed</li>
          </ul>

          <SectionHeading>d. Prohibited dog breeds</SectionHeading>
          <SmoothDetails summary="View list of prohibited dog breeds">
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
          </SmoothDetails>
          </>)}
          <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </FilteredSection>
    </div>
  );
};

export default TenantSelectionCriteria;
