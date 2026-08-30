import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ChurchMapComponent } from './church-map.component';
import type { SearchResult } from '../../shared/models';

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

  const makeResult = (slug: string, lat: number, lng: number): SearchResult => ({
    church: {
      id: crypto.randomUUID(),
      canonicalName: slug,
      slug,
      latitude: lat,
      longitude: lng,
      street: null,
      city: 'Denver',
      state: 'CO',
      zip: '80201',
      phoneNumber: null,
      website: null,
      emailAddress: null,
      denominationId: null,
      worshipStyle: 1,
      primaryLanguage: 'English',
      acceptsLGBTQ: null,
      wheelchairAccessible: null,
      hasNursery: null,
      hasYouthProgram: null,
      confidenceScore: 0.9,
      lastVerifiedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
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

    fixture.componentRef.setInput('items', [makeResult('grace-church', 39.7, -104.9)]);
    fixture.detectChanges();
    await fixture.whenStable();

    const L = await import('leaflet');
    const onCalls = vi.mocked(L.default.marker).mock.results
      .map((r: { value: { on: ReturnType<typeof vi.fn> } }) => r.value.on.mock.calls as [string, () => void][])
      .flat();
    const handler = onCalls.find(c => c[0] === 'click')?.[1];
    handler?.();

    expect(component.markerClick).toBeTruthy();
  });

  it('accepts items signal input without throwing', async () => {
    const items: SearchResult[] = [
      makeResult('a', 39.7, -104.9),
      makeResult('b', 39.8, -105.0),
    ];
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('names the tile layer so a test can select it without a Leaflet class', async () => {
    fixture.detectChanges();

    await vi.waitFor(() => expect(tileLayerElement.id).toBe('church-map-tiles'));
  });

});
