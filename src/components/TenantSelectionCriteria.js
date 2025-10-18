import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph, nestedListStyle } from '../styles';

const TenantSelectionCriteria = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Tenant Selection Criteria</title>
            </Helmet>

            <Heading>Tenant Selection Criteria</Heading>

            <Paragraph>
                Use this quick checklist to confirm eligibility. You must meet all items below.
            </Paragraph>

            <nav aria-label="Table of contents">
                <h2>Contents</h2>
                <ol>
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
                    <li><a href="#pets">Pets</a></li>
                </ol>
            </nav>

            <section id="at-a-glance">
                <h2>At a glance</h2>
                <ul>
                    <li>Employment: 24+ months of verifiable work history</li>
                    <li>Income: Gross monthly income ≥ 3× monthly rent (or your portion if using housing assistance)</li>
                    <li>Rental history: 24+ months of verifiable rental or mortgage payments</li>
                    <li>Credit: Minimum score of 650</li>
                    <li>Background: No criminal convictions, evictions, bankruptcies, or housing-related collections/negatives</li>
                </ul>
            </section>

            <section id="details">
                <h2>Details</h2>

                <h3 id="employment">Employment</h3>
                <ul>
                    <li>At least 24 months of verifiable employment history</li>
                </ul>

                <h3 id="income">Income</h3>
                <ul>
                    <li>Gross monthly income must be at least 3× the monthly rent</li>
                </ul>

                <h3 id="rental-history">Rental history</h3>
                <ul>
                    <li>At least 24 months of verifiable rental or mortgage payment history</li>
                </ul>

                <h3 id="credit">Credit</h3>
                <ul>
                    <li>Minimum credit score of 650</li>
                </ul>

                <h3 id="background">Background</h3>
                <ul>
                    <li>No criminal convictions, evictions, bankruptcies, or housing-related collections/negatives on the credit report</li>
                </ul>
            </section>

            <section id="housing-assistance">
                <h2>Housing Assistance (Section 8 and others)</h2>
                <ul style={nestedListStyle}>
                    <li>All applicants are screened using the same criteria for rental history, credit, criminal background, and references</li>
                    <li>Income requirement is based on your portion of rent as determined by the Housing Authority</li>
                    <li>Provide: valid voucher, RFTA packet, and your caseworker’s contact information</li>
                    <li>No side payments; all rent amounts must be approved and documented by the Housing Authority</li>
                    <li>Voucher must be active and valid through the expected lease start date</li>
                    <li>Move-in requires Housing Authority inspection and rent reasonableness approval</li>
                </ul>
            </section>

            <section id="pets">
                <h2>Pets</h2>

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