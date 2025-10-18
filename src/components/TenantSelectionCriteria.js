import React from 'react';
import {Helmet} from 'react-helmet';
import {Heading, Paragraph, nestedListStyle} from '../styles';

const TenantSelectionCriteria = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Tenant Selection Criteria</title>
            </Helmet>
            <Heading>Tenant Selection Criteria</Heading>
            <Paragraph>
                <ol>
                    <li>At least 24 months of verifiable employment history.</li>
                    <li>Monthly gross income must be at least 3 times the monthly rent.</li>
                    <li>At least 24 months of verifiable rental or mortgage payment history.</li>
                    <li>Minimum credit score of 650.</li>
                    <li>No criminal convictions, evictions, bankruptcies, or housing-related collections/negatives on the credit report.</li>
                    <li>
                        Section 8 and Other Housing Assistance Applicants:
                        <ol style={nestedListStyle}>
                            <li>All applicants, including those using Housing Choice Vouchers (Section 8), are evaluated using the same screening criteria for rental history, credit, criminal background, and references.</li>
                            <li>Income requirements are based on the tenant’s portion of rent as determined by the Housing Authority, not the full contract rent amount.</li>
                            <li>Applicants must provide a valid voucher, RFTA packet, and contact information for their caseworker.</li>
                            <li>No side payments are permitted. All rent amounts must be approved and documented through the Housing Authority.</li>
                            <li>The voucher must be active and valid through the expected lease start date.</li>
                            <li>All Section 8 units are subject to inspection and rent reasonableness approval by the Housing Authority before move-in.</li>
                        </ol>
                    </li>
                    <li>Pet Criteria
                        <ol style={nestedListStyle}>
                            <li>Prohibited Dog Breeds:
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
                            </li>
                            <li>Prohibited Animals:
                                <ul>
                                    <li>Exotic animals</li>
                                    <li>Farm animals (e.g., hoofed animals, livestock)</li>
                                    <li>Saddle animals</li>
                                    <li>Reptiles</li>
                                    <li>Primates</li>
                                    <li>Fowl</li>
                                </ul>
                            </li>
                            <li>Caged Animals:
                                <ul>
                                    <li>No caged animals allowed</li>
                                </ul>
                            </li>
                        </ol>
                    </li>

                </ol>
            </Paragraph>
        </div>
    );
};

export default TenantSelectionCriteria;