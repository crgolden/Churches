import { Directive, RESPONSE_INIT, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, ActivatedRouteSnapshot, provideRouter } from '@angular/router';
import { RouteDataKeys } from '../../app/app-paths';
import {
  LARGEST_PERCENT,
  newDisplayName,
  newId,
  newMemberOf,
  newPercent,
  newText,
  randomIntBetween,
} from '@crgolden/modules/testing';
import { CssValues } from '../../../e2e/css-constants';
import { AuthService, type Session } from '../../auth/auth.service';
import { LOCATION_MAP_SELECTOR, LocationMapComponent, type MapPoint } from '../map/location-map.component';
import { BFF_USER_RELATIVE_PATH, ClaimTypes, MODERATOR_CLAIM_VALUE } from '../../shared/bff-contract';
import { US_STATES, WORSHIP_STYLES, type Church } from '../../shared/models';
import { resolveTestComponentResources } from '../../test-setup-resources.browser';
import { ChurchDetailComponent } from './church-detail.component';

const SUB_PIXEL_ROUNDING_TOLERANCE_PX = 1;
const VISITOR_SESSION = null;
const MODERATOR_SESSION: Session = [{ type: ClaimTypes.moderator, value: MODERATOR_CLAIM_VALUE }];

@Directive({ selector: LOCATION_MAP_SELECTOR })
class LocationMapStubDirective {
  readonly points = input<MapPoint[]>([]);
}

function newMappedChurch(): Church {
  return {
    id: newId(),
    canonicalName: newDisplayName(),
    slug: newText(),
    latitude: randomIntBetween(1, 90),
    longitude: randomIntBetween(1, 180),
    street: newDisplayName(),
    city: newText(),
    state: newMemberOf(US_STATES).code,
    zip: newText(),
    phoneNumber: newText(),
    website: null,
    emailAddress: null,
    denominationId: null,
    worshipStyle: newMemberOf(WORSHIP_STYLES).value,
    primaryLanguage: newText(),
    acceptsLGBTQ: null,
    wheelchairAccessible: null,
    hasNursery: null,
    hasYouthProgram: null,
    confidenceScore: newPercent() / LARGEST_PERCENT,
    lastVerifiedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
    schedules: [],
    ministries: [],
    campuses: [],
  };
}

function routeResolving(church: Church): Pick<ActivatedRoute, 'snapshot'> {
  const snapshot = new ActivatedRouteSnapshot();
  snapshot.params = { slug: church.slug };
  snapshot.data = { [RouteDataKeys.church]: church };
  return { snapshot };
}

async function renderChurch(session: Session | null): Promise<ComponentFixture<ChurchDetailComponent>> {
  await TestBed.configureTestingModule({
    imports: [ChurchDetailComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
      { provide: RESPONSE_INIT, useValue: {} },
      { provide: ActivatedRoute, useValue: routeResolving(newMappedChurch()) },
    ],
  })
    .overrideComponent(ChurchDetailComponent, {
      remove: { imports: [LocationMapComponent] },
      add: { imports: [LocationMapStubDirective] },
    })
    .compileComponents();
  await resolveTestComponentResources();
  TestBed.inject(AuthService).refresh();
  TestBed.inject(HttpTestingController).expectOne(BFF_USER_RELATIVE_PATH).flush(session);
  const fixture = TestBed.createComponent(ChurchDetailComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function requiredElementById(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`#${id} is not in the DOM, so it cannot be measured.`);
  }
  return element;
}

function present<T extends Element>(element: T | null): T {
  if (element === null) {
    throw new Error('The element under test is not in the DOM, so it cannot be measured.');
  }
  return element;
}

describe('ChurchDetailComponent layout in a real browser', () => {
  it('lines the Location heading up with the Contact heading', async () => {
    await renderChurch(VISITOR_SESSION);

    const contactLeft = requiredElementById('church-contact-heading').getBoundingClientRect().left;
    const locationLeft = requiredElementById('church-location-heading').getBoundingClientRect().left;

    expect(Math.abs(locationLeft - contactLeft)).toBeLessThan(SUB_PIXEL_ROUNDING_TOLERANCE_PX);
  });

  it("lays a moderator's add-a-service-time form out as a labelled grid with a gap between its rows", async () => {
    await renderChurch(MODERATOR_SESSION);

    const grid =getComputedStyle(requiredElementById('schedule-add-grid'));

    expect(present(document.querySelector('label[for="schedule-day"]')).checkVisibility()).toBe(true);
    expect(present(document.querySelector('label[for="schedule-time"]')).checkVisibility()).toBe(true);
    expect(grid.display).toBe(CssValues.grid);
    expect(grid.rowGap).not.toBe(CssValues.zeroLength);
    expect(grid.rowGap).not.toBe(CssValues.normal);
  });
});
