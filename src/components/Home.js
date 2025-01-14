import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph } from '../styles';

const Home = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Home</title>
            </Helmet>
            <Heading>Carwoods: Where Houston Finds Home</Heading>
            <Paragraph>
                Finding your perfect rental property has never been easier. Our dedicated team of professionals works tirelessly to ensure your experience is seamless and your stay is nothing short of exceptional. With properties available nationwide, we’re here to help you feel at home, wherever you go.
                Crafting Comfort, One Home at a Time.
            </Paragraph>
        </div>
    );
};

export default Home;
