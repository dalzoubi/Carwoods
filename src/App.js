import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container, Content } from './styles';
import Home from './components/Home';
import TenantSelectionCriteria from './components/TenantSelectionCriteria';
import ApplicationRequiredDocuments from './components/ApplicationRequiredDocuments';
import PropertyManagement from './components/PropertyManagement';
import Footer from './components/Footer';
import ResponsiveNavbar from './components/ResponsiveNavbar';

const App = () => (
  <Router>
    <ResponsiveNavbar />
    <Container>
      <Content>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tenant-selection-criteria" element={<TenantSelectionCriteria />} />
          <Route path="/application-required-documents" element={<ApplicationRequiredDocuments />} />
          <Route path="/property-management" element={<PropertyManagement />} />
        </Routes>
      </Content>
    </Container>
    <Footer />
  </Router>
);

export default App;
