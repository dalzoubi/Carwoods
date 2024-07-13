import React from 'react';
import {Helmet} from 'react-helmet';
import {Heading, Paragraph} from '../styles';

const ApplicationRequiredDocuments = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Application Required Documents</title>
            </Helmet>
            <Heading>Application Required Documents</Heading>
            <Paragraph>
                <ol>
                    <li>Copy of a valid Driver's License (A color copy is required; black and white copy will not be
                        accepted)
                    </li>
                    <li>Social Security Number verification (one of the following: W2, Social Security Card, Tax Return.
                        A color copy is required; black and white copy will not be accepted)
                    </li>
                    <li>If employed:
                        <ol>
                            <li>Offer letter (if available)</li>
                            <li>Most recent pay stubs for the last ninety (90) days reflecting Year to Date earnings.
                            </li>
                            <li>Bank statements for the last sixty (60) days – original bank-exported PDF, all pages.
                            </li>
                            <li>Instructions on how to contact HR for employment verification.</li>
                        </ol>
                    </li>
                    <li>If self-employed:
                        <ol>
                            <li>Most recent year Tax return.</li>
                            <li>Last six (6) months of bank statements – original bank-exported PDF, all pages.</li>
                            <li>Company certificate of formation or EIN.</li>
                        </ol>
                    </li>
                    <li>If there is no rental history and paying any mortgages, submit the last twenty-four (24) months
                        of payment history.
                    </li>
                    <li>Other Income: Child Support, Disability, Social Security, Retirement Benefits require a printout
                        of proof of deposit (bank statement) and the state provided award letter.
                    </li>
                    <li>Photos of pets.</li>
                </ol>
            </Paragraph>
        </div>
    );
};

export default ApplicationRequiredDocuments;