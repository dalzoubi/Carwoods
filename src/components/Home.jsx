import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph, Button } from '../styles';

const Home = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Home</title>
                <meta name="description" content="Carwoods offers property management and rental services in Houston, TX. Find your next home with our dedicated team." />
            </Helmet>
            <Heading>Where Houston Finds Home</Heading>
            <Paragraph>
                Discover the ease of renting your dream property with us. Our dedicated team ensures a seamless experience and unparalleled comfort, offering a range of homes designed to fit your lifestyle. Proudly serving Houston and beyond, we’re here to make every house feel like home.
                Crafting Comfort, One Home at a Time.
            </Paragraph>
            <Paragraph>
                <Button as={Link} to="/apply">
                    Renting? Start here — How to apply
                </Button>
            </Paragraph>
        </div>
    );
};

export default Home;
