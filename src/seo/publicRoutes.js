const publicRoutes = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/property-management', priority: 0.8, changefreq: 'monthly' },
  { path: '/features', priority: 0.8, changefreq: 'monthly' },
  { path: '/pricing', priority: 0.8, changefreq: 'monthly' },
  { path: '/for-property-managers', priority: 0.8, changefreq: 'monthly' },
  { path: '/apply', priority: 0.7, changefreq: 'monthly' },
  { path: '/tenant-selection-criteria', priority: 0.7, changefreq: 'monthly' },
  { path: '/application-required-documents', priority: 0.7, changefreq: 'monthly' },
  { path: '/contact-us', priority: 0.6, changefreq: 'monthly' },
  { path: '/privacy', priority: 0.3, changefreq: 'yearly' },
  { path: '/terms-of-service', priority: 0.3, changefreq: 'yearly' },
  { path: '/accessibility', priority: 0.3, changefreq: 'yearly' },
];

export const supportedLanguages = ['en', 'es', 'fr', 'ar'];

export default publicRoutes;
