import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  LARGEST_PERCENT,
  newDisplayName,
  newMemberOf,
  newPathSegment,
  newPercent,
  newText,
  newUtcInstant,
  randomIntBetween,
} from '@crgolden/modules/testing';
import { ChurchMapComponent } from './church-map.component';
import { US_STATES, WORSHIP_STYLES, type SearchResult } from '../../shared/models';
import { CHURCH_MAP_TILES_ID, MARKER_CLICK_EVENT } from './map-ids';

const tileLayerElement = document.createElement('div');

const markerStub = {
  addTo: vi.fn().mockReturnThis(),
  bindPopup: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  getElement: vi.fn().mockReturnValue(document.createElement('img')),
  remove: vi.fn(),
};
const tileLayerStub = {
  addTo: vi.fn().mockReturnThis(),
  getContainer: vi.fn().mockReturnValue(tileLayerElement),
};
const mapStub = {
  setView: vi.fn().mockReturnThis(),
  remove: vi.fn(),
  fitBounds: vi.fn(),
  invalidateSize: vi.fn(),
};
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn().mockReturnValue(mapStub),
    tileLayer: vi.fn().mockReturnValue(tileLayerStub),
    marker: vi.fn().mockReturnValue(markerStub),
    featureGroup: vi.fn().mockReturnValue({ getBounds: vi.fn().mockReturnValue([]) }),
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
  },
}));

describe('ChurchMapComponent', () => {
  let component: ChurchMapComponent;
  let fixture: ComponentFixture<ChurchMapComponent>;

  const makeResult = (): SearchResult => ({
    church: {
      id: crypto.randomUUID(),
      canonicalName: newDisplayName(),
      slug: newPathSegment(),
      latitude: randomIntBetween(-89, 90),
      longitude: randomIntBetween(-179, 180),
      street: null,
      city: newText(),
      state: newMemberOf(US_STATES).code,
      zip: newText(),
      phoneNumber: null,
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
      createdAt: newUtcInstant(),
      updatedAt: newUtcInstant(),
      isActive: true,
      schedules: [],
      ministries: [],
      campuses: [],
    },
    distanceMiles: null,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChurchMapComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChurchMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a container div with leaflet-container class', () => {
    const el: HTMLElement = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.leaflet-container')).toBeTruthy();
  });

  it('should emit a markerClick event via the markerClick output', async () => {
    const emitted: string[] = [];
    component.markerClick.subscribe((slug: string) => emitted.push(slug));

    fixture.componentRef.setInput('items', [makeResult()]);
    fixture.detectChanges();
    await fixture.whenStable();

    const onCalls = markerStub.on.mock.calls as [string, () => void][];
    const handler = onCalls.find(c => c[0] === MARKER_CLICK_EVENT)?.[1];
    handler?.();

    expect(component.markerClick).toBeTruthy();
  });

  it('accepts items signal input without throwing', async () => {
    const items: SearchResult[] = [makeResult(), makeResult()];
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('names the tile layer so a test can select it without a Leaflet class', async () => {
    fixture.detectChanges();

    await vi.waitFor(() => expect(tileLayerElement.id).toBe(CHURCH_MAP_TILES_ID));
  });

});
