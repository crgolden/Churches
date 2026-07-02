import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Church, WORSHIP_STYLES } from './models';
import { injectOrigin } from './origin';

const JSON_LD_ELEMENT_ID = 'app-json-ld';

/**
 * Centralised SEO helper.  Inject into each public-facing component and call
 * the appropriate method after data loads so that title, description,
 * canonical link, Open Graph tags, and JSON-LD are all written into the
 * server-rendered HTML during SSR.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);
  private readonly origin = injectOrigin();

  /**
   * Sets the page title, description meta, canonical link, and Open Graph /
   * Twitter Card tags for a generic page.  No JSON-LD is emitted; call
   * setChurchMeta for detail pages that need structured data.
   */
  setPage(pageTitle: string, description: string, canonicalPath: string): void {
    const canonicalUrl = `${this.origin}${canonicalPath}`;
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.setCanonical(canonicalUrl);
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
  }

  /**
   * Sets all SEO metadata for a church detail page: title, description,
   * canonical link, Open Graph tags (type=place), Twitter Card, and a
   * JSON-LD script with Church + BreadcrumbList structured data.
   */
  setChurchMeta(church: Church): void {
    const worshipStyleLabel =
      WORSHIP_STYLES.find(s => s.value === church.worshipStyle)?.label ?? 'Christian';
    const description =
      `${church.canonicalName} — a ${worshipStyleLabel} church in ${church.city}, ${church.state}. ` +
      'Find service times, location, and more.';
    const canonicalPath = `/churches/${church.slug}`;
    const canonicalUrl = `${this.origin}${canonicalPath}`;

    this.title.setTitle(`${church.canonicalName} | Churches`);
    this.meta.updateTag({ name: 'description', content: description });
    this.setCanonical(canonicalUrl);
    this.meta.updateTag({ property: 'og:title', content: church.canonicalName });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:type', content: 'place' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    this.setJsonLd(this.buildChurchJsonLd(church, canonicalUrl));
  }

  /** Removes any JSON-LD script element previously injected by this service. */
  removeJsonLd(): void {
    const existing = this.document.getElementById(JSON_LD_ELEMENT_ID);
    existing?.parentNode?.removeChild(existing);
  }

  private setCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data: object): void {
    this.removeJsonLd();
    const script = this.document.createElement('script');
    script.id = JSON_LD_ELEMENT_ID;
    script.setAttribute('type', 'application/ld+json');
    script.text = JSON.stringify(data);
    this.document.head.appendChild(script);
  }

  private buildChurchJsonLd(church: Church, canonicalUrl: string): object {
    const address: Record<string, string> = {
      '@type': 'PostalAddress',
      addressLocality: church.city,
      addressRegion: church.state,
      postalCode: church.zip,
      addressCountry: 'US',
    };
    if (church.street) {
      address['streetAddress'] = church.street;
    }

    const churchNode: Record<string, unknown> = {
      '@type': 'Church',
      name: church.canonicalName,
      address,
      url: canonicalUrl,
    };

    if (church.latitude && church.longitude) {
      churchNode['geo'] = {
        '@type': 'GeoCoordinates',
        latitude: church.latitude,
        longitude: church.longitude,
      };
    }

    if (church.phoneNumber) {
      churchNode['telephone'] = church.phoneNumber;
    }

    if (church.website) {
      churchNode['sameAs'] = church.website;
    }

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: this.origin,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Browse Churches',
          item: `${this.origin}/churches`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: church.canonicalName,
          item: canonicalUrl,
        },
      ],
    };

    return {
      '@context': 'https://schema.org',
      '@graph': [churchNode, breadcrumb],
    };
  }
}
