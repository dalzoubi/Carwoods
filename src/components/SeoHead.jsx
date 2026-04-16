import { useContext } from 'react';
import { Helmet } from 'react-helmet-async';
import { LanguageContext } from '../LanguageContext';
import { supportedLanguages } from '../seo/publicRoutes';

const SITE_URL = 'https://carwoods.com';
const SITE_NAME = 'Carwoods';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

const localeMap = { en: 'en_US', es: 'es_US', fr: 'fr_FR', ar: 'ar_SA' };

export default function SeoHead({
  title,
  description,
  path,
  ogType = 'website',
  ogImage,
  noIndex = false,
  jsonLd,
}) {
  const langCtx = useContext(LanguageContext);
  const currentLanguage = langCtx?.currentLanguage || 'en';
  const direction = langCtx?.direction || 'ltr';
  const canonicalUrl = `${SITE_URL}${path}`;
  const image = ogImage || DEFAULT_OG_IMAGE;
  const locale = localeMap[currentLanguage] || 'en_US';

  return (
    <Helmet htmlAttributes={{ lang: currentLanguage, dir: direction }}>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={locale} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Hreflang alternates */}
      {supportedLanguages.map((lang) => (
        <link
          key={lang}
          rel="alternate"
          hrefLang={lang}
          href={canonicalUrl}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />

      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd])}
        </script>
      )}
    </Helmet>
  );
}
