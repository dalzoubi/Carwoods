import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Heading, SubHeading, Paragraph, InlineLink, TocNav, BackToTop, nestedListStyle, PrintButton, PrintHeader, PageHeader } from '../styles';
import carwoodsLogo from '../assets/carwoods-logo.png';

const ApplicationRequiredDocuments = () => {
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
        <title>Carwoods - Application Required Documents</title>
      </Helmet>

      <span id="page-top" />
      <PrintHeader>
        <img src={carwoodsLogo} alt="Carwoods" />
      </PrintHeader>
      <PageHeader>
        <Heading>Application Required Documents</Heading>
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
        All documents listed below are required for <strong>each adult applicant (18 years or older)</strong>.
        Incomplete applications will <strong>not</strong> be processed.
        Providing documents does not guarantee approval.
        Documents are handled confidentially and used only for screening purposes.
        Please also review our <InlineLink href="/tenant-selection-criteria">Tenant Selection Criteria</InlineLink> for full eligibility requirements.
      </Paragraph>

      <TocNav aria-label="Table of contents">
        <SubHeading>Contents</SubHeading>
        <ol>
          <li><a href="#identification">Personal Identification</a></li>
          <li><a href="#employed">If Employed</a></li>
          <li><a href="#self-employed">If Self-Employed</a></li>
          <li><a href="#rental-history">Rental History &amp; Other Income</a></li>
          <li>
            <a href="#pets-animals">Pets and Assistance Animals</a>
            <ol type="a">
              <li><a href="#pets-only">Pets</a></li>
              <li><a href="#service-animals">Service Animals</a></li>
              <li><a href="#esa">Emotional Support Animals (ESA)</a></li>
            </ol>
          </li>
          <li>
            <a href="#benefits">Government or Other Benefits</a>
            <ol type="a">
              <li><a href="#va-benefits">VA Benefits</a></li>
              <li><a href="#ssa-ssi">SSA / SSI</a></li>
              <li><a href="#ssdi">SSDI</a></li>
              <li><a href="#retirement">Retirement / Pension</a></li>
              <li><a href="#child-support">Child Support or Spousal Maintenance</a></li>
              <li><a href="#other-benefits">All Other Benefits</a></li>
            </ol>
          </li>
          <li><a href="#emergency-contact">Emergency Contact</a></li>
          <li><a href="#section-8">Section 8 / Housing Assistance</a></li>
          <li><a href="#guarantor">Guarantor</a></li>
          <li><a href="#cosigner">Co-Signer</a></li>
        </ol>
      </TocNav>

      <section id="identification" aria-labelledby="heading-identification">
        <SubHeading id="heading-identification">1. Personal Identification (All Adults 18+)</SubHeading>
        <ol style={nestedListStyle}>
          <li>Valid government-issued photo ID (Driver&apos;s License or State ID, color copy).</li>
          <li>
            Social Security Number verification (one of the following, color copy, showing full SSN):
            <ul style={nestedListStyle}>
              <li>Social Security Card</li>
              <li>W-2</li>
              <li>1099</li>
              <li>Most recent tax return</li>
            </ul>
          </li>
        </ol>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <section id="employed" aria-labelledby="heading-employed">
        <SubHeading id="heading-employed">2. If Employed</SubHeading>
        <ol style={nestedListStyle}>
          <li>Most recent <strong>90 days</strong> of pay stubs showing year-to-date earnings.</li>
          <li>Written employment verification (HR letter or email confirming start date, position, and current status).</li>
          <li>
            Bank statements for the most recent <strong>60 days</strong>
            (original bank-exported PDF, all pages, <strong>must clearly show the applicant&apos;s full name and current address</strong>).
          </li>
          <li>Employer or HR contact information for verification (name, email, direct phone number).</li>
        </ol>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <section id="self-employed" aria-labelledby="heading-self-employed">
        <SubHeading id="heading-self-employed">3. If Self-Employed</SubHeading>
        <ol style={nestedListStyle}>
          <li>Most recent <strong>two (2) years</strong> of filed federal tax returns.</li>
          <li>
            Last <strong>6 months</strong> of bank statements
            (original bank-exported PDF, all pages, <strong>must clearly show the applicant&apos;s full name and current address</strong>).
          </li>
          <li>Business documentation (EIN letter, certificate of formation, or business license).</li>
        </ol>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <section id="rental-history" aria-labelledby="heading-rental-history">
        <SubHeading id="heading-rental-history">4. Rental History &amp; Other Income</SubHeading>
        <ol style={nestedListStyle}>
          <li>
            Landlord reference information for the past <strong>24 months</strong>
            (landlord name, email, and phone number).
          </li>
          <li>
            If no rental history but paying a mortgage, provide the last <strong>24 months</strong> of mortgage payment history.
          </li>
          <li>
            Other income (child support, disability, Social Security, retirement, etc.) requires:
            <ul style={nestedListStyle}>
              <li>Official award letter</li>
              <li>Proof of deposit in bank statements</li>
            </ul>
          </li>
        </ol>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <section id="pets-animals" aria-labelledby="heading-pets-animals">
        <SubHeading id="heading-pets-animals">5. Pets and Assistance Animals</SubHeading>
        <ol type="a" style={nestedListStyle}>
          <li id="pets-only">
            <strong>Pets (if applicable):</strong> Clear photos of each pet and current vaccination records.
          </li>
          <li id="service-animals">
            <strong>Service Animals:</strong> Under the Fair Housing Act and Texas Property Code, service animals are dogs (or miniature horses) individually trained to perform specific tasks directly related to a person&apos;s disability. We will not request documentation proving the animal is a certified or trained service animal, nor will we require the animal to demonstrate its task. However, we may ask:
            <ul style={nestedListStyle}>
              <li>Whether the applicant has a disability-related need for the animal (yes/no only — we will not ask for the nature or extent of the disability).</li>
              <li>What specific task or work the animal has been trained to perform.</li>
            </ul>
            No pet deposit, pet fee, or pet rent may be charged for a service animal. The applicant remains liable for any damage caused by the animal beyond normal wear and tear.
          </li>
          <li id="esa">
            <strong>Emotional Support Animals (ESA) and Other Assistance Animals:</strong> When the disability-related need for an ESA or other assistance animal is not obvious or known, we may request <strong>reliable documentation</strong> from a licensed healthcare professional (physician, psychiatrist, therapist, or other licensed mental health professional) currently treating the applicant. The letter must:
            <ul style={nestedListStyle}>
              <li>Be written on the provider&apos;s official letterhead.</li>
              <li>Include the provider&apos;s name, license type, license number, state of licensure, and direct contact information.</li>
              <li>Confirm that the applicant has a disability (without disclosing the specific diagnosis).</li>
              <li>State that the animal provides disability-related support or therapeutic benefit.</li>
              <li>Be dated within the past <strong>12 months</strong>.</li>
            </ul>
            <strong>Online certificates, registry IDs, vest documentation, or letters from internet-based services are not accepted</strong> and do not constitute reliable documentation under HUD guidelines. No pet deposit, pet fee, or pet rent may be charged for an approved assistance animal. The applicant remains liable for damage caused by the animal beyond normal wear and tear.
          </li>
        </ol>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <section id="benefits" aria-labelledby="heading-benefits">
        <SubHeading id="heading-benefits">6. Applicants Receiving Government or Other Benefits</SubHeading>
        <ol type="a" style={nestedListStyle}>
          <li id="va-benefits">
            <strong>VA (Veterans Affairs) Benefits:</strong>
            <ul style={nestedListStyle}>
              <li>Current VA Benefits Award Letter (dated within the past <strong>12 months</strong>) showing benefit type, monthly amount, and effective date.</li>
              <li>Most recent <strong>2 months</strong> of bank statements confirming VA deposit amounts.</li>
              <li>DD-214 (Certificate of Release or Discharge from Active Duty) is accepted as supplemental identity verification but is not required.</li>
            </ul>
          </li>
          <li id="ssa-ssi">
            <strong>Social Security (SSA) or Supplemental Security Income (SSI):</strong>
            <ul style={nestedListStyle}>
              <li>Current SSA Award Letter or Benefit Verification Letter (obtainable at ssa.gov) dated within the past <strong>12 months</strong>, showing monthly benefit amount.</li>
              <li>Most recent <strong>2 months</strong> of bank statements confirming SSA/SSI deposit amounts.</li>
            </ul>
          </li>
          <li id="ssdi">
            <strong>Social Security Disability Insurance (SSDI):</strong>
            <ul style={nestedListStyle}>
              <li>Current SSDI Award Letter dated within the past <strong>12 months</strong>, showing monthly benefit amount and disability onset date.</li>
              <li>Most recent <strong>2 months</strong> of bank statements confirming SSDI deposit amounts.</li>
            </ul>
          </li>
          <li id="retirement">
            <strong>Retirement / Pension Income:</strong>
            <ul style={nestedListStyle}>
              <li>Most recent pension or retirement benefit statement (e.g., TCDRS, TRS, FERS, or private pension) dated within the past <strong>12 months</strong>.</li>
              <li>Most recent <strong>2 months</strong> of bank statements confirming deposit amounts.</li>
            </ul>
          </li>
          <li id="child-support">
            <strong>Child Support or Spousal Maintenance:</strong>
            <ul style={nestedListStyle}>
              <li>Court order or divorce decree showing the awarded amount and duration.</li>
              <li>Most recent <strong>3 months</strong> of bank statements or OAG (Texas Office of the Attorney General) payment history confirming consistent receipt.</li>
            </ul>
          </li>
          <li id="other-benefits">
            <strong>All Other Benefits:</strong> Official award or benefit letter from the issuing agency (dated within the past <strong>12 months</strong>) plus most recent <strong>2 months</strong> of bank statements confirming deposit amounts.
          </li>
        </ol>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <section id="emergency-contact" aria-labelledby="heading-emergency-contact">
        <SubHeading id="heading-emergency-contact">7. Emergency Contact</SubHeading>
        <ol style={nestedListStyle}>
          <li>
            Emergency contact for someone <strong>not residing</strong> in the household
            (full name, address, email, and phone number).
          </li>
        </ol>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <section id="section-8" aria-labelledby="heading-section-8">
        <SubHeading id="heading-section-8">8. Section 8 / Housing Assistance Applicants (Additional Requirements)</SubHeading>
        <ol style={nestedListStyle}>
          <li>Active Housing Choice Voucher showing tenant name, bedroom size, issue date, and expiration date.</li>
          <li>Tenant Rent Portion Estimate, affordability worksheet, or equivalent from the assigned caseworker or Housing Authority.</li>
          <li>Completed RFTA (Request for Tenancy Approval) packet (tenant sections).</li>
          <li>Caseworker&apos;s full name, email address, and direct phone number.</li>
          <li>Proof that household composition matches the voucher.</li>
          <li>Housing Authority inspection and rent reasonableness approval are required prior to move-in.</li>
          <li>HAP Contract and Housing Authority lease addendum are required <strong>after approval</strong> and inspection.</li>
          <li>
            Section 8 applicants are subject to the <strong>same credit, background, and rental history requirements</strong>
            as all other applicants. No side payments are permitted.
          </li>
        </ol>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <section id="guarantor" aria-labelledby="heading-guarantor">
        <SubHeading id="heading-guarantor">9. If a Guarantor is Required</SubHeading>
        <Paragraph>
          A guarantor signs a separate guaranty agreement (not the lease) and is only liable if the primary tenant defaults. Guarantors are accepted only when requested by management — see <InlineLink href="/tenant-selection-criteria">Tenant Selection Criteria</InlineLink> for eligibility.
        </Paragraph>
        <ol style={nestedListStyle}>
          <li>Valid government-issued photo ID (color copy).</li>
          <li>Social Security Number verification (SS card, W-2, 1099, or most recent tax return; showing full SSN).</li>
          <li>Most recent <strong>90 days</strong> of pay stubs showing year-to-date earnings.</li>
          <li>Written employment verification (HR letter/email confirming start date, position, and current status).</li>
          <li>Bank statements for the most recent <strong>60 days</strong> (original bank-exported PDFs, all pages).</li>
          <li>If self-employed: most recent <strong>2 years</strong> of filed federal tax returns and last <strong>6 months</strong> of bank statements.</li>
          <li>
            Landlord reference information for the past <strong>24 months</strong> (landlord name, email, and phone number).
            If no rental history but paying a mortgage, provide the last <strong>24 months</strong> of mortgage payment history.
          </li>
          <li>Signed guaranty agreement (provided by management; separate from the lease).</li>
        </ol>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>

      <section id="cosigner" aria-labelledby="heading-cosigner">
        <SubHeading id="heading-cosigner">10. If a Co-Signer is Required</SubHeading>
        <Paragraph>
          A co-signer is <strong>not the same as a guarantor</strong>. A co-signer signs the lease itself as a co-tenant and is jointly and severally liable for all lease obligations from day one — regardless of whether the primary tenant pays. Co-signers must meet the full applicant qualification standards. See <InlineLink href="/tenant-selection-criteria">Tenant Selection Criteria</InlineLink> for eligibility.
        </Paragraph>
        <ol style={nestedListStyle}>
          <li>Valid government-issued photo ID (color copy).</li>
          <li>Social Security Number verification (SS card, W-2, 1099, or most recent tax return; showing full SSN).</li>
          <li>Most recent <strong>90 days</strong> of pay stubs showing year-to-date earnings.</li>
          <li>Written employment verification (HR letter/email confirming start date, position, and current status).</li>
          <li>Bank statements for the most recent <strong>60 days</strong> (original bank-exported PDFs, all pages).</li>
          <li>If self-employed: most recent <strong>2 years</strong> of filed federal tax returns and last <strong>6 months</strong> of bank statements.</li>
          <li>
            Landlord reference information for the past <strong>24 months</strong> (landlord name, email, and phone number).
            If no rental history but paying a mortgage, provide the last <strong>24 months</strong> of mortgage payment history.
          </li>
          <li>Completed rental application and consent to full credit, background, and rental history screening.</li>
        </ol>
        <BackToTop href="#page-top">↑ Back to top</BackToTop>
      </section>
    </div>
  );
};

export default ApplicationRequiredDocuments;
