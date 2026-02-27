import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph, Button } from '../styles';

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
