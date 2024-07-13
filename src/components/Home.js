import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph } from '../styles';

const Home = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Home</title>
            </Helmet>
            <Heading>Welcome to Your Future Home!</Heading>
            <Paragraph>
                Carwoods® makes it easy for you to rent a real estate property. Our team of professionals works around the clock to ensure you have a pleasant stay at one of our properties nationwide.
            </Paragraph>
        </div>
    );
};

export default Home;
