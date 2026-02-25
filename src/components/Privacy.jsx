import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph } from '../styles';

const Privacy = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Privacy Policy</title>
                <meta name="description" content="Carwoods LLC privacy policy — how we collect, use, and protect your information." />
            </Helmet>
            <Heading>Privacy Policy</Heading>
            <Paragraph>
                Carwoods LLC (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This policy describes how we handle information when you use our website and services.
            </Paragraph>

            <h2>Information We Collect</h2>
            <Paragraph>
                When you visit our site, we may collect information you provide directly, such as when you contact us or submit an application. If you use third-party services (e.g., HAR.com for property inquiries or applications), their privacy policies govern that data.
            </Paragraph>

            <h2>How We Use Information</h2>
            <Paragraph>
                We use information to respond to inquiries, process applications, provide property management services, and comply with legal obligations. We do not sell your personal information.
            </Paragraph>

            <h2>Third Parties</h2>
            <Paragraph>
                Our site may link to external services (e.g., Texas Real Estate Commission, HAR.com). We are not responsible for their privacy practices. Please review their policies before sharing information.
            </Paragraph>

            <h2>Contact</h2>
            <Paragraph>
                For privacy-related questions or to request access to your information, contact us through our <a href="/contact-us">Contact Us</a> page.
            </Paragraph>

            <Paragraph>
                <em>Last updated: February 2025</em>
            </Paragraph>
        </div>
    );
};

export default Privacy;
