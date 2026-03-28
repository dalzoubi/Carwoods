import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { Heading, Paragraph, Button } from '../styles';
import theme from '../theme';

const InternalLink = styled(Link)`
    color: ${theme.palette.primary.main};
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.2s;

    &:hover {
        color: ${theme.palette.primary.dark};
    }

    &:visited {
        color: ${theme.palette.primary.dark};
    }

    &:focus-visible {
        outline: 2px solid ${theme.palette.primary.light};
        outline-offset: 2px;
        border-radius: 2px;
    }
`;

const HAR_AGENT_URL = 'https://www.har.com/dennis-alzoubi/agent_dalzoubi';

const ContactUs = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Contact Us</title>
                <meta
                    name="description"
                    content="Start with our Apply page for leasing steps and documents. Contact our HAR.com agent when you need direct help after following that process."
                />
            </Helmet>
            <Heading>Contact Us</Heading>
            <Paragraph>
                For rental applications and most leasing-related questions, please begin with our{' '}
                <InternalLink to="/apply">Apply</InternalLink> page. It explains eligibility, required documentation,
                and how to submit through the listing channel. Following that workflow first allows us to assist you
                efficiently and consistently.
            </Paragraph>
            <Paragraph>
                If you have already worked through those steps, or you have a matter that cannot be addressed there—such
                as property management services or another topic that requires direct outreach—please contact our
                licensed agent on HAR.com (Houston Association of Realtors). We encourage using this channel when
                self-service options are not sufficient.
            </Paragraph>
            <p>
                <Button
                    href={HAR_AGENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Contact our agent on HAR.com (opens in new tab)"
                >
                    Contact Our Agent on HAR.com
                </Button>
            </p>
        </div>
    );
};

export default ContactUs;
