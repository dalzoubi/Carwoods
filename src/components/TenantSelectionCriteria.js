import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph, nestedListStyle } from '../styles';

const TenantSelectionCriteria = () => {
  return (
    <div className="tenant-criteria">
      <Helmet>
        <title>Carwoods - Tenant Selection Criteria</title>
      </Helmet>

      <Heading>Tenant Selection Criteria</Heading>

      <Paragraph>
        All applicants must meet <strong>every</strong> requirement below. These standards are applied consistently to
        all applicants, including those using housing assistance (Section 8 or similar programs). Meeting some criteria
        does not qualify an applicant.
      </Paragraph>

      <nav aria-label="Table of contents">
        <h2>Contents</h2>
        <ol>
          <li><a href="#non-negotiable">Non-negotiable standards</a></li>
          <li><a href="#at-a-glance">At a glance</a></li>
          <li>
            <a href="#details">Details</a>
            <ol>
              <li><a href="#employment">Employment</a></li>
              <li><a href="#income">Income</a></li>
              <li><a href="#rental-history">Rental history</a></li>
              <li><a href="#credit">Credit</a></li>
              <li><a href="#background">Background</a></li>
            </ol>
          </li>
          <li><a href="#housing-assistance">Housing Assistance</a></li>
          <li><a href="#credit-exception">Discretionary credit exception (rare)</a></li>
          <li><a href="#pets">Pets</a></li>
        </ol>
      </nav>

      <section id="non-negotiable">
        <h2>Non-negotiable standards (read first)</h2>
        <ul>
          <li>All requirements below are <strong>mandatory</strong>. Applications that do not meet every requirement will be <strong>denied</strong>.</li>
          <li>No verbal assurances, explanations, or promises can replace documentation.</li>
          <li>Incomplete applications will not be processed.</li>
          <li>Housing assistance (Section 8) does <strong>not</strong> waive credit, background, employment, or rental history standards.</li>
          <li>Submitting an application does not guarantee approval.</li>
        </ul>
      </section>

      <section id="at-a-glance">
        <h2>At a glance</h2>
        <ul>
          <li><strong>Employment:</strong> 24+ months of verifiable employment history</li>
          <li><strong>Income:</strong> Gross monthly income ≥ 3× monthly rent (or ≥ 3× your tenant portion if using housing assistance)</li>
          <li><strong>Rental history:</strong> 24+ months of verifiable rental or mortgage payment history</li>
          <li><strong>Credit:</strong> Minimum score of 650 (strictly enforced)</li>
          <li><strong>Background:</strong> No criminal convictions, evictions, bankruptcies, or housing-related collections/negatives</li>
        </ul>
      </section>

      <section id="details">
        <h2>Details</h2>

        <h3 id="employment">Employment</h3>
        <ul>
          <li>Minimum <strong>24 consecutive months</strong> of verifiable employment history</li>
          <li>Employment gaps must be documented</li>
          <li>Recent job starts, short-term work, or unverified employment do not qualify</li>
          <li>Self-employment requires <strong>24 months of tax returns</strong></li>
        </ul>

        <h3 id="income">Income</h3>
        <ul>
          <li>Gross monthly income must be at least <strong>3× the monthly rent</strong></li>
          <li>
            For housing assistance applicants, the income requirement is based on <strong>3× your tenant portion</strong> of rent as
            determined by the Housing Authority
          </li>
          <li>Income must be <strong>verifiable, recurring, and stable</strong></li>
          <li>Bank statements may be required to confirm cash-flow stability</li>
        </ul>

        <h3 id="rental-history">Rental history</h3>
        <ul>
          <li>Minimum <strong>24 months</strong> of verifiable rental or mortgage payment history</li>
          <li>Landlord references must be verifiable and responsive</li>
          <li>Family/friend landlords are not accepted</li>
          <li>Rental history must demonstrate on-time payments and proper care of the property</li>
        </ul>

        <h3 id="credit">Credit (strictly enforced)</h3>
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
          <li>Credit explanations do not override objective findings</li>
        </ul>

        <h3 id="background">Background</h3>
        <ul>
          <li><strong>No criminal convictions</strong></li>
          <li><strong>No evictions</strong></li>
          <li><strong>No bankruptcies</strong></li>
          <li><strong>No housing-related collections/negatives</strong> on the credit report</li>
          <li>Inconsistencies between disclosures and screening results may result in denial</li>
        </ul>
      </section>

      <section id="housing-assistance">
        <h2>Housing Assistance (Section 8 and others)</h2>
        <ul style={nestedListStyle}>
          <li>All applicants are screened using the same criteria for rental history, credit, criminal background, and references</li>
          <li>Income requirement is based on your tenant portion of rent as determined by the Housing Authority</li>
          <li>Provide: valid voucher, RFTA packet, and your caseworker’s contact information</li>
          <li>No side payments; all rent amounts must be approved and documented by the Housing Authority</li>
          <li>Voucher must be active and valid through the expected lease start date</li>
          <li>Move-in requires Housing Authority inspection and rent reasonableness approval</li>
        </ul>
      </section>

      <section id="credit-exception">
        <h2>Discretionary credit exception (rare)</h2>
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
      </section>

      <section id="pets">
        <h2>Pets</h2>

        <Paragraph>
          Pets are subject to separate approval. Restrictions may apply by type, breed, size, and quantity. Pet approval is not
          guaranteed even if all other criteria are met.
        </Paragraph>

        <h3>Prohibited animals</h3>
        <ul>
          <li>Exotic animals</li>
          <li>Farm animals (e.g., hoofed animals, livestock)</li>
          <li>Saddle animals</li>
          <li>Reptiles</li>
          <li>Primates</li>
          <li>Fowl</li>
        </ul>

        <h3>Caged animals</h3>
        <ul>
          <li>No caged animals allowed</li>
        </ul>

        <h3>Prohibited dog breeds</h3>
        <details>
          <summary>View list of prohibited dog breeds</summary>
          <ul>
            <li>Akitas Inu</li>
            <li>Alaskan Malamute</li>
            <li>American Bull Dog</li>
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
            <li>“Pit Bull”</li>
            <li>Rhodesian Ridgeback</li>
            <li>Rottweiler</li>
            <li>Staffordshire Bull Terrier</li>
            <li>Thai Ridgeback</li>
            <li>Wolf or Wolf Hybrid</li>
            <li>Any mixed breed containing any of the above breeds</li>
          </ul>
        </details>
      </section>
    </div>
  );
};

export default TenantSelectionCriteria;