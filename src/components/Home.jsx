import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph } from '../styles';

const Home = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Home</title>
            </Helmet>
            <Heading>Where Houston Finds Home</Heading>
            <Paragraph>
                Discover the ease of renting your dream property with us. Our dedicated team ensures a seamless experience and unparalleled comfort, offering a range of homes designed to fit your lifestyle. Proudly serving Houston and beyond, we’re here to make every house feel like home.
                Crafting Comfort, One Home at a Time.
            </Paragraph>
        </div>
    );
};

export default Home;
