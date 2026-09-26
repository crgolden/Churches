export const JSON_LD_ELEMENT_ID = 'app-json-ld';

export const CANONICAL_REL = 'canonical';

export const CANONICAL_LINK_SELECTOR = `link[rel="${CANONICAL_REL}"]`;

export const JSON_LD_MIME_TYPE = 'application/ld+json';

export const TWITTER_CARD = 'summary';

export const OgTypes = {
  website: 'website',
  place: 'place',
} as const;

export const JsonLdKeys = {
  context: '@context',
  graph: '@graph',
  type: '@type',
} as const;

export const SchemaTypes = {
  church: 'Church',
  postalAddress: 'PostalAddress',
  geoCoordinates: 'GeoCoordinates',
  breadcrumbList: 'BreadcrumbList',
  listItem: 'ListItem',
} as const;

export const HOME_CRUMB = 'Home';

export const SchemaProperties = {
  streetAddress: 'streetAddress',
  telephone: 'telephone',
  sameAs: 'sameAs',
  geo: 'geo',
  latitude: 'latitude',
} as const;

export const MetaNames = {
  description: 'description',
  robots: 'robots',
  twitterCard: 'twitter:card',
} as const;

export const MetaProperties = {
  ogTitle: 'og:title',
  ogDescription: 'og:description',
  ogUrl: 'og:url',
  ogType: 'og:type',
} as const;
