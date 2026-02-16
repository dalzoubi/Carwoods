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
        All documents listed below are required for <strong>each adult applicant (18 years or older)</strong>.
        Incomplete applications will <strong>not</strong> be processed.
        Providing documents does not guarantee approval.
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
          <strong>Pets, Service Animals, and Assistance Animals:</strong>
          <ol style={nestedListStyle}>
            <li>Clear photos of each pet (if applicable).</li>
            <li>Current vaccination records for pets.</li>
            <li>
              Requests for service or assistance animals must include documentation that complies with
              applicable Fair Housing guidelines. Online certificates alone are not sufficient.
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
            <li>Tenant Rent Portion Estimate / affordability worksheet from the assigned caseworker.</li>
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
          <strong>Required guarantor documents:</strong>
          <ol style={nestedListStyle}>
            <li>Valid government-issued photo ID (color copy).</li>
            <li>Social Security Number verification (SS card, W-2, 1099, or most recent tax return; partial redaction acceptable).</li>
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
