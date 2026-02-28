import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, SubHeading, Paragraph, InlineLink } from '../styles';

const Privacy = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Privacy Policy</title>
                <meta name="description" content="Carwoods privacy policy — how we collect, use, and protect your information." />
            </Helmet>
            <Heading>Privacy Policy</Heading>
            <Paragraph>
                Carwoods (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This policy describes how we handle information when you use our website and services.
            </Paragraph>

            <SubHeading>Information We Collect</SubHeading>
            <Paragraph>
                When you visit our site, we may collect information you provide directly, such as when you contact us or submit an application. If you use third-party services (e.g., HAR.com for property inquiries or applications), their privacy policies govern that data.
            </Paragraph>

            <SubHeading>How We Use Information</SubHeading>
            <Paragraph>
                We use information to respond to inquiries, process applications, provide property management services, and comply with legal obligations. We do not sell your personal information.
            </Paragraph>

            <SubHeading>Third Parties</SubHeading>
            <Paragraph>
                Our site may link to external services (e.g., Texas Real Estate Commission, HAR.com). We are not responsible for their privacy practices. Please review their policies before sharing information.
            </Paragraph>

            <SubHeading>Contact</SubHeading>
            <Paragraph>
                For privacy-related questions or to request access to your information, contact us through our <InlineLink href="/contact-us">Contact Us</InlineLink> page.
            </Paragraph>

            <Paragraph>
                <em>Last updated: February 2025</em>
            </Paragraph>
        </div>
    );
};

export default Privacy;
