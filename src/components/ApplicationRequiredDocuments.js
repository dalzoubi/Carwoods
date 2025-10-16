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
                <ol>
                    <li>Personal Identification:
                        <ol style={nestedListStyle}>
                            <li>Copy of a valid Driver's License (color copy only).</li>
                            <li>Social Security Number verification (W2, Social Security Card, or Tax Return; color copy only).</li>
                        </ol>
                    </li>
                    <li>
                        If Employed:
                        <ol style={nestedListStyle}>
                            <li>Offer letter (if available).</li>
                            <li>Most recent pay stubs for the last 90 days (reflecting Year to Date earnings).</li>
                            <li>Bank statements for the last 60 days (original bank-exported PDF, all pages).</li>
                            <li>Instructions on how to contact HR for employment verification.</li>
                        </ol>
                    </li>
                    <li>
                        If Self-Employed:
                        <ol style={nestedListStyle}>
                            <li>Most recent year's Tax Return.</li>
                            <li>Last 6 months of bank statements (original bank-exported PDF, all pages).</li>
                            <li>Company certificate of formation or EIN.</li>
                        </ol>
                    </li>
                    <li>
                        Additional Requirements:
                        <ol style={nestedListStyle}>
                            <li>If no rental history and paying any mortgages, submit the last 24 months of payment history.</li>
                            <li>Other income (Child Support, Disability, Social Security, Retirement Benefits) requires proof of deposit (bank statement) and state-provided award letter.</li>
                            <li>Immunization Records and Photos of pets.</li>
                            <li>Emergency contact information for someone not living with you (full name, address, email and phone number).</li>
                            <li>Documentation for service animals or accessibility needs.</li>
                        </ol>
                    </li>
                    <li>
                        Section 8 Applicants (Additional Requirements):
                        <ol style={nestedListStyle}>
                            <li>Copy of the Housing Choice Voucher showing tenant name, bedroom size, issue & expiration date, and payment standard.</li>
                            <li>Completed RFTA (Request for Tenancy Approval) packet.</li>
                            <li>Tenant Rent Portion Estimate Sheet from the assigned caseworker.</li>
                            <li>Caseworker’s full name, email, and direct phone number for inspection and lease coordination.</li>
                            <li>Houston Housing Authority Lease Addendum (to be attached to your lease).</li>
                            <li>HAP Contract (signed after inspection; keep a copy for your records).</li>
                            <li>Proof of household composition matching the voucher (to prevent mismatch issues).</li>
                            <li>Voucher must be valid (not expired) at the time of lease signing and inspection.</li>
                            <li>Section 8 applicants are subject to the same credit, background, and rental history checks as all other applicants. No side payments are allowed.</li>
                        </ol>
                    </li>
                </ol>
            </Paragraph>
        </div>
    );
};

export default ApplicationRequiredDocuments;
