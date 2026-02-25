import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph, nestedListStyle } from '../styles';

const ApplicationRequiredDocuments = () => {
  return (
    <div>
      <Helmet>
        <title>Carwoods - Application Required Documents</title>
      </Helmet>

      <Heading>Application Required Documents</Heading>

      <Paragraph>
        We appreciate your interest in our properties. We do not discriminate based on race, color, religion, sex, familial status, national origin, disability, or other protected characteristics under the Texas Fair Housing Act.
      </Paragraph>

      <Paragraph>
        All documents listed below are required for <strong>each adult applicant (18 years or older)</strong>.
        Incomplete applications will <strong>not</strong> be processed.
        Providing documents does not guarantee approval.
        Documents are handled confidentially and used only for screening purposes.
        Please also review our <a href="/tenant-selection-criteria">Tenant Selection Criteria</a> for full eligibility requirements.
      </Paragraph>

      <ol>
        <li>
          <strong>Personal Identification (All Adults 18+):</strong>
          <ol style={nestedListStyle}>
            <li>Valid government-issued photo ID (Driver's License or State ID, color copy).</li>
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
        </li>

        <li>
          <strong>If Employed:</strong>
          <ol style={nestedListStyle}>
            <li>Most recent <strong>90 days</strong> of pay stubs showing year-to-date earnings.</li>
            <li>Written employment verification (HR letter or email confirming start date, position, and current status).</li>
            <li>
              Bank statements for the most recent <strong>60 days</strong>
              (original bank-exported PDF, all pages, <strong>must clearly show the applicant’s full name and current address</strong>).
            </li>
            <li>Employer or HR contact information for verification (name, email, direct phone number).</li>
          </ol>
        </li>

        <li>
          <strong>If Self-Employed:</strong>
          <ol style={nestedListStyle}>
            <li>Most recent <strong>two (2) years</strong> of filed federal tax returns.</li>
            <li>
              Last <strong>6 months</strong> of bank statements
              (original bank-exported PDF, all pages, <strong>must clearly show the applicant’s full name and current address</strong>).
            </li>
            <li>Business documentation (EIN letter, certificate of formation, or business license).</li>
          </ol>
        </li>

        <li>
          <strong>Rental History & Other Income:</strong>
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
        </li>

        <li>
          <strong>Pets and Assistance Animals:</strong>
          <ol style={nestedListStyle}>
            <li>
              <strong>Pets (if applicable):</strong> Clear photos of each pet and current vaccination records.
            </li>
            <li>
              <strong>Service Animals:</strong> Under the Fair Housing Act and Texas Property Code, service animals are dogs (or miniature horses) individually trained to perform specific tasks directly related to a person's disability. We will not request documentation proving the animal is a certified or trained service animal, nor will we require the animal to demonstrate its task. However, we may ask:
              <ul style={nestedListStyle}>
                <li>Whether the applicant has a disability-related need for the animal (yes/no only — we will not ask for the nature or extent of the disability).</li>
                <li>What specific task or work the animal has been trained to perform.</li>
              </ul>
              No pet deposit, pet fee, or pet rent may be charged for a service animal. The applicant remains liable for any damage caused by the animal beyond normal wear and tear.
            </li>
            <li>
              <strong>Emotional Support Animals (ESA) and Other Assistance Animals:</strong> When the disability-related need for an ESA or other assistance animal is not obvious or known, we may request <strong>reliable documentation</strong> from a licensed healthcare professional (physician, psychiatrist, therapist, or other licensed mental health professional) currently treating the applicant. The letter must:
              <ul style={nestedListStyle}>
                <li>Be written on the provider's official letterhead.</li>
                <li>Include the provider's name, license type, license number, state of licensure, and direct contact information.</li>
                <li>Confirm that the applicant has a disability (without disclosing the specific diagnosis).</li>
                <li>State that the animal provides disability-related support or therapeutic benefit.</li>
                <li>Be dated within the past <strong>12 months</strong>.</li>
              </ul>
              <strong>Online certificates, registry IDs, vest documentation, or letters from internet-based services are not accepted</strong> and do not constitute reliable documentation under HUD guidelines. No pet deposit, pet fee, or pet rent may be charged for an approved assistance animal. The applicant remains liable for damage caused by the animal beyond normal wear and tear.
            </li>
          </ol>
        </li>

        <li>
          <strong>Applicants Receiving Government or Other Benefits:</strong>
          <ol style={nestedListStyle}>
            <li>
              <strong>VA (Veterans Affairs) Benefits:</strong>
              <ul style={nestedListStyle}>
                <li>Current VA Benefits Award Letter (dated within the past <strong>12 months</strong>) showing benefit type, monthly amount, and effective date.</li>
                <li>Most recent <strong>2 months</strong> of bank statements confirming VA deposit amounts.</li>
                <li>DD-214 (Certificate of Release or Discharge from Active Duty) is accepted as supplemental identity verification but is not required.</li>
              </ul>
            </li>
            <li>
              <strong>Social Security (SSA) or Supplemental Security Income (SSI):</strong>
              <ul style={nestedListStyle}>
                <li>Current SSA Award Letter or Benefit Verification Letter (obtainable at ssa.gov) dated within the past <strong>12 months</strong>, showing monthly benefit amount.</li>
                <li>Most recent <strong>2 months</strong> of bank statements confirming SSA/SSI deposit amounts.</li>
              </ul>
            </li>
            <li>
              <strong>Social Security Disability Insurance (SSDI):</strong>
              <ul style={nestedListStyle}>
                <li>Current SSDI Award Letter dated within the past <strong>12 months</strong>, showing monthly benefit amount and disability onset date.</li>
                <li>Most recent <strong>2 months</strong> of bank statements confirming SSDI deposit amounts.</li>
              </ul>
            </li>
            <li>
              <strong>Retirement / Pension Income:</strong>
              <ul style={nestedListStyle}>
                <li>Most recent pension or retirement benefit statement (e.g., TCDRS, TRS, FERS, or private pension) dated within the past <strong>12 months</strong>.</li>
                <li>Most recent <strong>2 months</strong> of bank statements confirming deposit amounts.</li>
              </ul>
            </li>
            <li>
              <strong>Child Support or Spousal Maintenance:</strong>
              <ul style={nestedListStyle}>
                <li>Court order or divorce decree showing the awarded amount and duration.</li>
                <li>Most recent <strong>3 months</strong> of bank statements or OAG (Texas Office of the Attorney General) payment history confirming consistent receipt.</li>
              </ul>
            </li>
            <li>
              <strong>All Other Benefits:</strong> Official award or benefit letter from the issuing agency (dated within the past <strong>12 months</strong>) plus most recent <strong>2 months</strong> of bank statements confirming deposit amounts.
            </li>
          </ol>
        </li>

        <li>
          <strong>Emergency Contact:</strong>
          <ol style={nestedListStyle}>
            <li>
              Emergency contact for someone <strong>not residing</strong> in the household
              (full name, address, email, and phone number).
            </li>
          </ol>
        </li>

        <li>
          <strong>Section 8 / Housing Assistance Applicants (Additional Requirements):</strong>
          <ol style={nestedListStyle}>
            <li>Active Housing Choice Voucher showing tenant name, bedroom size, issue date, and expiration date.</li>
            <li>Tenant Rent Portion Estimate, affordability worksheet, or equivalent from the assigned caseworker or Housing Authority.</li>
            <li>Completed RFTA (Request for Tenancy Approval) packet (tenant sections).</li>
            <li>Caseworker's full name, email address, and direct phone number.</li>
            <li>Proof that household composition matches the voucher.</li>
            <li>
              Housing Authority inspection and rent reasonableness approval are required prior to move-in.
            </li>
            <li>
              HAP Contract and Housing Authority lease addendum are required <strong>after approval</strong> and inspection.
            </li>
            <li>
              Section 8 applicants are subject to the <strong>same credit, background, and rental history requirements</strong>
              as all other applicants. No side payments are permitted.
            </li>
          </ol>
        </li>

        <li>
          <strong>If a guarantor is required:</strong> Guarantors apply only when requested by management (see <a href="/tenant-selection-criteria">Tenant Selection Criteria</a> for when a guarantor may be considered). Required guarantor documents:
          <ol style={nestedListStyle}>
            <li>Valid government-issued photo ID (color copy).</li>
            <li>Social Security Number verification (SS card, W-2, 1099, or most recent tax return; showing full SSN).</li>
            <li>Most recent 2 pay stubs (or last 90 days where applicable) showing year-to-date earnings.</li>
            <li>Written employment verification (HR letter/email confirming start date, position, and current status).</li>
            <li>Bank statements for the most recent 60 days (original bank-exported PDFs, all pages).</li>
            <li>If self-employed: most recent 2 years of filed federal tax returns and last 6 months of bank statements.</li>
          </ol>
        </li>
      </ol>
    </div>
  );
};

export default ApplicationRequiredDocuments;
