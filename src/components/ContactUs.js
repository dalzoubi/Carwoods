import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const ContactUs = () => {
    const navigate = useNavigate();
    const tabOpened = useRef(false); // Track if the tab has been opened

    useEffect(() => {
        if (!tabOpened.current) {
            // Open the link in a new tab
            window.open('https://www.har.com/dennis-alzoubi/agent_dalzoubi', '_blank', 'noopener,noreferrer');
            tabOpened.current = true; // Mark the tab as opened
        }

        // Redirect back to the home page (or another route)
        navigate('/');
    }, [navigate]);

    return null; // No UI needed
};

export default ContactUs;
