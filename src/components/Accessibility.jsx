import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph } from '../styles';

const Accessibility = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Accessibility Statement</title>
                <meta name="description" content="Carwoods LLC commitment to digital accessibility and WCAG compliance." />
            </Helmet>
            <Heading>Accessibility Statement</Heading>
            <Paragraph>
                Carwoods LLC is committed to ensuring our website is accessible to people with disabilities. We aim to comply with the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA.
            </Paragraph>

            <h2>Measures We Take</h2>
            <ul>
                <li>Semantic HTML and clear heading structure</li>
                <li>Keyboard navigable content with visible focus indicators</li>
                <li>Alternative text for images</li>
                <li>Color contrast that meets WCAG guidelines</li>
                <li>Skip links for keyboard users</li>
            </ul>

            <h2>Feedback</h2>
            <Paragraph>
                If you encounter any accessibility barriers on our site, please contact us through our <a href="/contact-us">Contact Us</a> page. We will work to address the issue promptly.
            </Paragraph>

            <Paragraph>
                <em>Last updated: February 2025</em>
            </Paragraph>
        </div>
    );
};

export default Accessibility;
