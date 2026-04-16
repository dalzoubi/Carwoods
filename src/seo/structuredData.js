export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Carwoods',
  legalName: 'Alzoubi Motors LLC',
  url: 'https://carwoods.com',
  logo: 'https://carwoods.com/logo512.png',
  contactPoint: {
    '@type': 'ContactPoint',
    url: 'https://carwoods.com/contact-us',
    contactType: 'customer support',
    email: 'support@carwoods.com',
  },
  sameAs: [],
};

export const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: 'Carwoods',
  url: 'https://carwoods.com/property-management',
  logo: 'https://carwoods.com/logo512.png',
  email: 'support@carwoods.com',
  areaServed: {
    '@type': 'City',
    name: 'Houston',
    addressRegion: 'TX',
    addressCountry: 'US',
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Houston',
    addressRegion: 'TX',
    addressCountry: 'US',
  },
  description:
    'Licensed Houston property manager offering full-service leasing, tenant screening, maintenance coordination, and reporting.',
  priceRange: '$$',
};

export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Carwoods',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://carwoods.com',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free tier with 1 property, tenant portal, and maintenance requests',
  },
  description:
    'Property management portal with tenant maintenance requests, notifications, and AI-powered routing for self-managing landlords.',
};

export function buildFaqSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
}
