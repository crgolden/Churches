import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Church, WORSHIP_STYLES } from './models';
import { injectOrigin } from './origin';
import { PageTitles, pageTitle } from './page-title';
import { CHURCHES_URL, churchUrl } from '../app/app-paths';
import {
  CANONICAL_LINK_SELECTOR,
  CANONICAL_REL,
  HOME_CRUMB,
  JSON_LD_ELEMENT_ID,
  JSON_LD_MIME_TYPE,
  JsonLdKeys,
  MetaNames,
  MetaProperties,
  OgTypes,
  SchemaProperties,
  SchemaTypes,
  TWITTER_CARD,
} from './seo-contract';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);
  private readonly origin = injectOrigin();

  setPage(ogTitle: string, description: string, canonicalPath: string): void {
    const canonicalUrl = `${this.origin}${canonicalPath}`;
    this.meta.updateTag({ name: MetaNames.description, content: description });
    this.setCanonical(canonicalUrl);
    this.meta.updateTag({ property: MetaProperties.ogTitle, content: ogTitle });
    this.meta.updateTag({ property: MetaProperties.ogDescription, content: description });
    this.meta.updateTag({ property: MetaProperties.ogUrl, content: canonicalUrl });
    this.meta.updateTag({ property: MetaProperties.ogType, content: OgTypes.website });
    this.meta.updateTag({ name: MetaNames.twitterCard, content: TWITTER_CARD });
  }

  setChurchMeta(church: Church): void {
    const worshipStyleLabel =
      WORSHIP_STYLES.find(s => s.value === church.worshipStyle)?.label ?? 'Christian';
    const description =
      `${church.canonicalName} — a ${worshipStyleLabel} church in ${church.city}, ${church.state}. ` +
      'Find service times, location, and more.';
    const canonicalPath = churchUrl(church.slug);
    const canonicalUrl = `${this.origin}${canonicalPath}`;

    this.title.setTitle(pageTitle(church.canonicalName));
    this.meta.updateTag({ name: MetaNames.description, content: description });
    this.setCanonical(canonicalUrl);
    this.meta.updateTag({ property: MetaProperties.ogTitle, content: church.canonicalName });
    this.meta.updateTag({ property: MetaProperties.ogDescription, content: description });
    this.meta.updateTag({ property: MetaProperties.ogUrl, content: canonicalUrl });
    this.meta.updateTag({ property: MetaProperties.ogType, content: OgTypes.place });
    this.meta.updateTag({ name: MetaNames.twitterCard, content: TWITTER_CARD });
    this.setJsonLd(this.buildChurchJsonLd(church, canonicalUrl));
  }

  setNoIndex(): void {
    this.meta.updateTag({ name: MetaNames.robots, content: 'noindex' });
  }

  removeJsonLd(): void {
    const existing = this.document.getElementById(JSON_LD_ELEMENT_ID);
    existing?.remove();
  }

  private setCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>(CANONICAL_LINK_SELECTOR);
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', CANONICAL_REL);
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data: object): void {
    this.removeJsonLd();
    const script = this.document.createElement('script');
    script.id = JSON_LD_ELEMENT_ID;
    script.setAttribute('type', JSON_LD_MIME_TYPE);
    script.text = JSON.stringify(data);
    this.document.head.appendChild(script);
  }

  private buildChurchJsonLd(church: Church, canonicalUrl: string): object {
    const address: Record<string, string> = {
      [JsonLdKeys.type]: SchemaTypes.postalAddress,
      addressLocality: church.city,
      addressRegion: church.state,
      postalCode: church.zip,
      addressCountry: 'US',
    };
    if (church.street) {
      address[SchemaProperties.streetAddress] = church.street;
    }

    const churchNode: Record<string, unknown> = {
      [JsonLdKeys.type]: SchemaTypes.church,
      name: church.canonicalName,
      address,
      url: canonicalUrl,
    };

    if (church.latitude && church.longitude) {
      churchNode[SchemaProperties.geo] = {
        [JsonLdKeys.type]: SchemaTypes.geoCoordinates,
        [SchemaProperties.latitude]: church.latitude,
        longitude: church.longitude,
      };
    }

    if (church.phoneNumber) {
      churchNode[SchemaProperties.telephone] = church.phoneNumber;
    }

    if (church.website) {
      churchNode[SchemaProperties.sameAs] = church.website;
    }

    const breadcrumb = {
      [JsonLdKeys.type]: SchemaTypes.breadcrumbList,
      itemListElement: [
        {
          [JsonLdKeys.type]: SchemaTypes.listItem,
          position: 1,
          name: HOME_CRUMB,
          item: this.origin,
        },
        {
          [JsonLdKeys.type]: SchemaTypes.listItem,
          position: 2,
          name: PageTitles.browseChurches,
          item: `${this.origin}${CHURCHES_URL}`,
        },
        {
          [JsonLdKeys.type]: SchemaTypes.listItem,
          position: 3,
          name: church.canonicalName,
          item: canonicalUrl,
        },
      ],
    };

    return {
      [JsonLdKeys.context]: 'https://schema.org',
      [JsonLdKeys.graph]: [churchNode, breadcrumb],
    };
  }
}
