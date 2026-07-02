import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { SeoService } from './seo.service';
import { Church } from './models';

/** A fully-populated Church fixture for use across spec blocks. */
const GRACE_CHURCH: Church = {
  id: 'church-1',
  canonicalName: 'Grace Community Church',
  slug: 'grace-community-church',
  latitude: 39.7392,
  longitude: -104.9903,
  street: '123 Main St',
  city: 'Denver',
  state: 'CO',
  zip: '80201',
  phoneNumber: '+1-303-555-0100',
  website: 'https://example.com',
  emailAddress: null,
  denominationId: null,
  worshipStyle: 1,
  primaryLanguage: 'en',
  acceptsLGBTQ: null,
  wheelchairAccessible: true,
  hasNursery: true,
  hasYouthProgram: true,
  confidenceScore: 0.95,
  lastVerifiedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  isActive: true,
};

describe('SeoService', () => {
  let service: SeoService;
  let titleService: Title;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SeoService);
    titleService = TestBed.inject(Title);
    doc = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    // Clean up injected DOM nodes between tests.
    doc.querySelector('link[rel="canonical"]')?.remove();
    doc.getElementById('app-json-ld')?.remove();
    doc.querySelectorAll('meta[property^="og:"]').forEach(el => el.remove());
    doc.querySelector('meta[name="twitter:card"]')?.remove();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('setPage', () => {
    beforeEach(() => {
      service.setPage('Browse Churches | Churches', 'Find a church near you.', '/churches');
    });

    it('sets the document title', () => {
      expect(titleService.getTitle()).toBe('Browse Churches | Churches');
    });

    it('sets the description meta tag', () => {
      const tag = doc.querySelector('meta[name="description"]');
      expect(tag?.getAttribute('content')).toBe('Find a church near you.');
    });

    it('sets the canonical link href', () => {
      const link = doc.querySelector('link[rel="canonical"]');
      expect(link?.getAttribute('href')).toMatch(/\/churches$/);
    });

    it('sets og:title', () => {
      const tag = doc.querySelector('meta[property="og:title"]');
      expect(tag?.getAttribute('content')).toBe('Browse Churches | Churches');
    });

    it('sets og:description', () => {
      const tag = doc.querySelector('meta[property="og:description"]');
      expect(tag?.getAttribute('content')).toBe('Find a church near you.');
    });

    it('sets og:url', () => {
      const tag = doc.querySelector('meta[property="og:url"]');
      expect(tag?.getAttribute('content')).toMatch(/\/churches$/);
    });

    it('sets og:type to website', () => {
      const tag = doc.querySelector('meta[property="og:type"]');
      expect(tag?.getAttribute('content')).toBe('website');
    });

    it('sets twitter:card to summary', () => {
      const tag = doc.querySelector('meta[name="twitter:card"]');
      expect(tag?.getAttribute('content')).toBe('summary');
    });
  });

  describe('setChurchMeta', () => {
    beforeEach(() => {
      service.setChurchMeta(GRACE_CHURCH);
    });

    it('sets the document title to "name | Churches"', () => {
      expect(titleService.getTitle()).toBe('Grace Community Church | Churches');
    });

    it('description includes church name, worship style, and city/state', () => {
      const tag = doc.querySelector('meta[name="description"]');
      const content = tag?.getAttribute('content') ?? '';
      expect(content).toContain('Grace Community Church');
      expect(content).toContain('Traditional');
      expect(content).toContain('Denver');
      expect(content).toContain('CO');
    });

    it('canonical link ends with /churches/:slug', () => {
      const link = doc.querySelector('link[rel="canonical"]');
      expect(link?.getAttribute('href')).toMatch(/\/churches\/grace-community-church$/);
    });

    it('sets og:title to church canonicalName', () => {
      const tag = doc.querySelector('meta[property="og:title"]');
      expect(tag?.getAttribute('content')).toBe('Grace Community Church');
    });

    it('sets og:type to place', () => {
      const tag = doc.querySelector('meta[property="og:type"]');
      expect(tag?.getAttribute('content')).toBe('place');
    });

    it('sets twitter:card to summary', () => {
      const tag = doc.querySelector('meta[name="twitter:card"]');
      expect(tag?.getAttribute('content')).toBe('summary');
    });

    it('injects a JSON-LD script element', () => {
      const script = doc.getElementById('app-json-ld');
      expect(script).toBeTruthy();
      expect(script?.getAttribute('type')).toBe('application/ld+json');
    });

    it('JSON-LD graph[0] has @type Church and correct name', () => {
      const script = doc.getElementById('app-json-ld');
      const data = JSON.parse(script?.textContent ?? '{}') as { '@graph': Record<string, unknown>[] };
      const node = data['@graph'][0];
      expect(node['@type']).toBe('Church');
      expect(node['name']).toBe('Grace Community Church');
    });

    it('JSON-LD Church node includes a PostalAddress', () => {
      const script = doc.getElementById('app-json-ld');
      const data = JSON.parse(script?.textContent ?? '{}') as { '@graph': Record<string, unknown>[] };
      const addr = data['@graph'][0]['address'] as Record<string, string>;
      expect(addr['@type']).toBe('PostalAddress');
      expect(addr['streetAddress']).toBe('123 Main St');
      expect(addr['addressLocality']).toBe('Denver');
      expect(addr['addressRegion']).toBe('CO');
    });

    it('JSON-LD includes GeoCoordinates when lat/lng are non-zero', () => {
      const script = doc.getElementById('app-json-ld');
      const data = JSON.parse(script?.textContent ?? '{}') as { '@graph': Record<string, unknown>[] };
      const geo = data['@graph'][0]['geo'] as Record<string, unknown>;
      expect(geo?.['@type']).toBe('GeoCoordinates');
      expect(geo?.['latitude']).toBe(39.7392);
    });

    it('JSON-LD omits GeoCoordinates when lat/lng are zero', () => {
      service.setChurchMeta({ ...GRACE_CHURCH, latitude: 0, longitude: 0 });
      const script = doc.getElementById('app-json-ld');
      const data = JSON.parse(script?.textContent ?? '{}') as { '@graph': Record<string, unknown>[] };
      expect(data['@graph'][0]['geo']).toBeUndefined();
    });

    it('JSON-LD includes telephone when present', () => {
      const script = doc.getElementById('app-json-ld');
      const data = JSON.parse(script?.textContent ?? '{}') as { '@graph': Record<string, unknown>[] };
      expect(data['@graph'][0]['telephone']).toBe('+1-303-555-0100');
    });

    it('JSON-LD includes sameAs when website present', () => {
      const script = doc.getElementById('app-json-ld');
      const data = JSON.parse(script?.textContent ?? '{}') as { '@graph': Record<string, unknown>[] };
      expect(data['@graph'][0]['sameAs']).toBe('https://example.com');
    });

    it('JSON-LD graph[1] is a BreadcrumbList with three items', () => {
      const script = doc.getElementById('app-json-ld');
      const data = JSON.parse(script?.textContent ?? '{}') as { '@graph': Record<string, unknown>[] };
      const crumb = data['@graph'][1] as { '@type': string; itemListElement: unknown[] };
      expect(crumb['@type']).toBe('BreadcrumbList');
      expect(crumb.itemListElement.length).toBe(3);
    });

    it('BreadcrumbList third item references the church canonical URL', () => {
      const script = doc.getElementById('app-json-ld');
      const data = JSON.parse(script?.textContent ?? '{}') as { '@graph': Record<string, unknown>[] };
      const items = (data['@graph'][1] as { itemListElement: Record<string, unknown>[] }).itemListElement;
      expect((items[2]['item'] as string)).toMatch(/\/churches\/grace-community-church$/);
    });

    it('calling setChurchMeta twice replaces the JSON-LD script (no duplicates)', () => {
      service.setChurchMeta(GRACE_CHURCH);
      const scripts = doc.querySelectorAll('#app-json-ld');
      expect(scripts.length).toBe(1);
    });
  });

  describe('removeJsonLd', () => {
    it('removes the JSON-LD script element when present', () => {
      service.setChurchMeta(GRACE_CHURCH);
      expect(doc.getElementById('app-json-ld')).toBeTruthy();
      service.removeJsonLd();
      expect(doc.getElementById('app-json-ld')).toBeNull();
    });

    it('does not throw when no JSON-LD script is present', () => {
      expect(() => service.removeJsonLd()).not.toThrow();
    });
  });
});
