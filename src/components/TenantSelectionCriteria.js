import React from 'react';
import {Helmet} from 'react-helmet';
import {Heading, Paragraph} from '../styles';

const TenantSelectionCriteria = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Tenant Selection Criteria</title>
            </Helmet>
            <Heading>Tenant Selection Criteria</Heading>
            <Paragraph>
                <ul>
                    <li>Minimum of 24 months verifiable employment history.</li>
                    <li>Documented monthly gross income must be at least 3x the monthly rent.</li>
                    <li>Minimum of 24 months verifiable rental history or mortgage payment paid on time.</li>
                    <li>Minimum 650 credit score.</li>
                    <li>No criminal convictions, evictions, bankruptcies, or any housing related collections or
                        negatives on the credit report.
                    </li>
                    <li>Pet Criteria
                        <ul>
                            <li>No prohibited breeds of dogs include Akitas Inu, Alaskan Malamute, American Bull Dog,
                                American Staffordshire Terrier, American Pit Bull Terrier, Beauceron, Boerboel, Bull
                                Mastiff / American Bandogge /Bully Kutta (any other Mastiff breed), Cane Corso,
                                Caucasian Ovcharka (Mountain Dogs), Chow Chow, Doberman Pinscher (miniature Dobermans
                                acceptable), Dogo Argentino, English Bull Terrier, Fila Brasileiro (aka Brazilian
                                Mastiff), German Shepherds, Giant Schnauzer, Great Dane, Gull Dong (aka Pakistani Bull
                                Dog), Gull Terrier, Husky or Siberian Husky, Japanese Tosa / Tosa Inu / Tosa Ken, Korean
                                Jindo, Perro de Presa Canario, “Pit Bull”, Rhodesian Ridgeback, Rottweiler,
                                Staffordshire Bull Terrier, Thai Ridgeback Wolf or Wolf hybrid, &amp; any mixed breed
                                dog containing any of the aforementioned breeds.
                            </li>
                            <li>No Exotic, farm, or saddle animals include but are not limited to hoofed animals,
                                livestock, reptiles, primates, and fowl.
                            </li>
                            <li>No caged animals.</li>
                        </ul>
                    </li>
                </ul>
            </Paragraph>
        </div>
    );
};

export default TenantSelectionCriteria;