import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph } from '../styles';
import theme from '../theme';

const HAR_AGENT_URL = 'https://www.har.com/dennis-alzoubi/agent_dalzoubi';

const ContactUs = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Contact Us</title>
                <meta name="description" content="Contact Carwoods LLC for property management and rental inquiries in Houston." />
            </Helmet>
            <Heading>Contact Us</Heading>
            <Paragraph>
                To inquire about available properties, submit an application, or discuss property management services, please visit our agent&apos;s profile on HAR.com (Houston Association of Realtors).
            </Paragraph>
            <Paragraph>
                You&apos;ll be able to view listings, request showings, and get in touch directly with our team.
            </Paragraph>
            <p>
                <a
                    href={HAR_AGENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Contact our agent on HAR.com (opens in new tab)"
                    style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        backgroundColor: theme.palette.primary.main,
                        color: theme.palette.text.primary,
                        borderRadius: `${theme.shape.borderRadius}px`,
                        fontWeight: 'bold',
                        textDecoration: 'none',
                    }}
                >
                    Contact Our Agent on HAR.com
                </a>
            </p>
        </div>
    );
};

export default ContactUs;
