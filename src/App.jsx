import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container, Content } from './styles';
import Home from './components/Home';
import TenantSelectionCriteria from './components/TenantSelectionCriteria';
import ApplicationRequiredDocuments from './components/ApplicationRequiredDocuments';
import PropertyManagement from './components/PropertyManagement';
import ContactUs from './components/ContactUs';
import Privacy from './components/Privacy';
import Accessibility from './components/Accessibility';
import Footer from './components/Footer';
import ResponsiveNavbar from './components/ResponsiveNavbar';

const App = () => (
    <Router>
        <a href="#main-content" className="sr-only sr-only-focusable">
            Skip to main content
        </a>
        <ResponsiveNavbar />
        <Container id="main-content">
            <Content>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/tenant-selection-criteria" element={<TenantSelectionCriteria />} />
                    <Route path="/application-required-documents" element={<ApplicationRequiredDocuments />} />
                    <Route path="/property-management" element={<PropertyManagement />} />
                    <Route path="/contact-us" element={<ContactUs />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/accessibility" element={<Accessibility />} />
                </Routes>
            </Content>
        </Container>
        <Footer />
    </Router>
);

export default App;
