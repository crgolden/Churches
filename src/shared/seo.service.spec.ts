import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { newMemberOf, newText, randomIntBetween } from '@crgolden/modules/testing';
import { SeoService } from './seo.service';
import {
  CANONICAL_LINK_SELECTOR,
  HOME_CRUMB,
  JSON_LD_ELEMENT_ID,
  JSON_LD_MIME_TYPE,
  JsonLdKeys,
  OgTypes,
  SchemaProperties,
  SchemaTypes,
  TWITTER_CARD,
} from './seo-contract';
import { Church, US_STATES, WORSHIP_STYLES } from './models';
import { PageTitles, pageTitle } from './page-title';
import { churchUrl } from '../app/app-paths';

type JsonLdNode = Record<string, unknown>;

const WORSHIP_STYLE = newMemberOf(WORSHIP_STYLES);
const STATE = newMemberOf(US_STATES);

const CHURCH: Church = {
  id: crypto.randomUUID(),
  canonicalName: `Church ${crypto.randomUUID()}`,
  slug: crypto.randomUUID(),
  latitude: randomIntBetween(25, 45),
  longitude: randomIntBetween(-120, -70),
  street: `${Math.floor(Math.random() * 9000) + 100} Street ${crypto.randomUUID()}`,
  city: `City ${crypto.randomUUID()}`,
  state: STATE.code,
  zip: String(randomIntBetween(10000, 100000)),
  phoneNumber: `+1${Math.floor(Math.random() * 9e9) + 1e9}`,
  website: `https://example.invalid/${crypto.randomUUID()}`,
  emailAddress: null,
  denominationId: null,
  worshipStyle: WORSHIP_STYLE.value,
  primaryLanguage: newText(),
  acceptsLGBTQ: null,
  wheelchairAccessible: true,
  hasNursery: true,
  hasYouthProgram: true,
  confidenceScore: Math.random(),
  lastVerifiedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isActive: true,
  schedules: [],
  ministries: [],
  campuses: [],
};

const PAGE_TITLE = `Page ${crypto.randomUUID()}`;
const PAGE_DESCRIPTION = `Description ${crypto.randomUUID()}`;
const PAGE_PATH = `/${crypto.randomUUID()}`;

describe('SeoService', () => {
  let service: SeoService;
  let titleService: Title;
  let doc: Document;

  function jsonLdGraph(): JsonLdNode[] {
    const script = doc.getElementById(JSON_LD_ELEMENT_ID);
    const data = JSON.parse(script?.textContent ?? '{}') as Record<string, JsonLdNode[]>;
    return data[JsonLdKeys.graph];
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SeoService);
    titleService = TestBed.inject(Title);
    doc = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    doc.querySelector(CANONICAL_LINK_SELECTOR)?.remove();
    doc.getElementById(JSON_LD_ELEMENT_ID)?.remove();
    doc.querySelectorAll('meta[property^="og:"]').forEach(el => el.remove());
    doc.querySelector('meta[name="twitter:card"]')?.remove();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('setPage', () => {
    beforeEach(() => {
      service.setPage(PAGE_TITLE, PAGE_DESCRIPTION, PAGE_PATH);
    });

    it('leaves the document title untouched, because the route is its only writer', () => {
      const setByTheRoute = `Title ${crypto.randomUUID()}`;
      titleService.setTitle(setByTheRoute);

      service.setPage(PAGE_TITLE, PAGE_DESCRIPTION, PAGE_PATH);

      expect(titleService.getTitle()).toBe(setByTheRoute);
    });

    it('sets the description meta tag', () => {
      const tag = doc.querySelector('meta[name="description"]');
      expect(tag?.getAttribute('content')).toBe(PAGE_DESCRIPTION);
    });

    it('sets the canonical link href', () => {
      const link = doc.querySelector(CANONICAL_LINK_SELECTOR);
      expect(link?.getAttribute('href')?.endsWith(PAGE_PATH)).toBe(true);
    });

    it('sets og:title', () => {
      const tag = doc.querySelector('meta[property="og:title"]');
      expect(tag?.getAttribute('content')).toBe(PAGE_TITLE);
    });

    it('sets og:description', () => {
      const tag = doc.querySelector('meta[property="og:description"]');
      expect(tag?.getAttribute('content')).toBe(PAGE_DESCRIPTION);
    });

    it('sets og:url', () => {
      const tag = doc.querySelector('meta[property="og:url"]');
      expect(tag?.getAttribute('content')?.endsWith(PAGE_PATH)).toBe(true);
    });

    it('sets og:type to website', () => {
      const tag = doc.querySelector('meta[property="og:type"]');
      expect(tag?.getAttribute('content')).toBe(OgTypes.website);
    });

    it('sets twitter:card to summary', () => {
      const tag = doc.querySelector('meta[name="twitter:card"]');
      expect(tag?.getAttribute('content')).toBe(TWITTER_CARD);
    });
  });

  describe('setChurchMeta', () => {
    beforeEach(() => {
      service.setChurchMeta(CHURCH);
    });

    it('sets the document title to the church page title', () => {
      expect(titleService.getTitle()).toBe(pageTitle(CHURCH.canonicalName));
    });

    it('description includes church name, worship style, and city/state', () => {
      const tag = doc.querySelector('meta[name="description"]');
      const content = tag?.getAttribute('content');
      expect(content).toContain(CHURCH.canonicalName);
      expect(content).toContain(WORSHIP_STYLE.label);
      expect(content).toContain(CHURCH.city);
      expect(content).toContain(CHURCH.state);
    });

    it('canonical link ends with the church URL', () => {
      const link = doc.querySelector(CANONICAL_LINK_SELECTOR);
      expect(link?.getAttribute('href')?.endsWith(churchUrl(CHURCH.slug))).toBe(true);
    });

    it('sets og:title to church canonicalName', () => {
      const tag = doc.querySelector('meta[property="og:title"]');
      expect(tag?.getAttribute('content')).toBe(CHURCH.canonicalName);
    });

    it('sets og:type to place', () => {
      const tag = doc.querySelector('meta[property="og:type"]');
      expect(tag?.getAttribute('content')).toBe(OgTypes.place);
    });

    it('sets twitter:card to summary', () => {
      const tag = doc.querySelector('meta[name="twitter:card"]');
      expect(tag?.getAttribute('content')).toBe(TWITTER_CARD);
    });

    it('injects a JSON-LD script element', () => {
      const script = doc.getElementById(JSON_LD_ELEMENT_ID);
      expect(script).toBeTruthy();
      expect(script?.getAttribute('type')).toBe(JSON_LD_MIME_TYPE);
    });

    it('JSON-LD graph[0] has @type Church and correct name', () => {
      const node = jsonLdGraph()[0];
      expect(node[JsonLdKeys.type]).toBe(SchemaTypes.church);
      expect(node['name']).toBe(CHURCH.canonicalName);
    });

    it('JSON-LD Church node includes a PostalAddress', () => {
      const addr = jsonLdGraph()[0]['address'] as Record<string, string>;
      expect(addr[JsonLdKeys.type]).toBe(SchemaTypes.postalAddress);
      expect(addr[SchemaProperties.streetAddress]).toBe(CHURCH.street);
      expect(addr['addressLocality']).toBe(CHURCH.city);
      expect(addr['addressRegion']).toBe(CHURCH.state);
    });

    it('JSON-LD includes GeoCoordinates when lat/lng are non-zero', () => {
      const geo = jsonLdGraph()[0][SchemaProperties.geo] as JsonLdNode;
      expect(geo?.[JsonLdKeys.type]).toBe(SchemaTypes.geoCoordinates);
      expect(geo?.[SchemaProperties.latitude]).toBe(CHURCH.latitude);
    });

    it('JSON-LD omits GeoCoordinates when lat/lng are zero', () => {
      service.setChurchMeta({ ...CHURCH, latitude: 0, longitude: 0 });
      expect(jsonLdGraph()[0][SchemaProperties.geo]).toBeUndefined();
    });

    it('JSON-LD includes telephone when present', () => {
      expect(jsonLdGraph()[0][SchemaProperties.telephone]).toBe(CHURCH.phoneNumber);
    });

    it('JSON-LD includes sameAs when website present', () => {
      expect(jsonLdGraph()[0][SchemaProperties.sameAs]).toBe(CHURCH.website);
    });

    it('JSON-LD graph[1] is a BreadcrumbList from home through the churches list to this church', () => {
      const crumb = jsonLdGraph()[1] as { itemListElement: JsonLdNode[] } & JsonLdNode;
      expect(crumb[JsonLdKeys.type]).toBe(SchemaTypes.breadcrumbList);
      expect(crumb.itemListElement.map(item => item['name'])).toEqual([
        HOME_CRUMB,
        PageTitles.browseChurches,
        CHURCH.canonicalName,
      ]);
    });

    it('BreadcrumbList third item references the church canonical URL', () => {
      const items = (jsonLdGraph()[1] as { itemListElement: JsonLdNode[] }).itemListElement;
      expect((items[items.length - 1]['item'] as string).endsWith(churchUrl(CHURCH.slug))).toBe(true);
    });

    it('calling setChurchMeta twice replaces the JSON-LD script (no duplicates)', () => {
      service.setChurchMeta(CHURCH);
      const scripts = doc.querySelectorAll(`#${JSON_LD_ELEMENT_ID}`);
      expect(scripts.length).toBe(1);
    });
  });

  describe('removeJsonLd', () => {
    it('removes the JSON-LD script element when present', () => {
      service.setChurchMeta(CHURCH);
      expect(doc.getElementById(JSON_LD_ELEMENT_ID)).toBeTruthy();
      service.removeJsonLd();
      expect(doc.getElementById(JSON_LD_ELEMENT_ID)).toBeNull();
    });

    it('does not throw when no JSON-LD script is present', () => {
      expect(() => service.removeJsonLd()).not.toThrow();
    });
  });
});
