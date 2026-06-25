import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  input,
} from '@angular/core';
import type * as LeafletType from 'leaflet';

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
}

// A small standalone Leaflet map that plots a set of labelled points (used on the church-detail page
// to show the main church plus its campuses). Leaflet is dynamically imported so it stays out of the
// initial bundle.
@Component({
  selector: 'app-location-map',
  standalone: true,
  template: `
    <div #mapEl class="leaflet-container" style="width:100%;height:320px"></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly points = input<MapPoint[]>([]);

  @ViewChild('mapEl') private mapElRef?: ElementRef<HTMLDivElement>;
  private map: LeafletType.Map | null = null;
  private markers: LeafletType.Marker[] = [];

  ngAfterViewInit(): void {
    void this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['points'] && this.map) {
      void this.loadLeaflet().then(L => this.renderMarkers(L));
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  private async initMap(): Promise<void> {
    if (!this.mapElRef) return;
    const L = await this.loadLeaflet();
    this.fixDefaultIcon(L);
    this.map = L.map(this.mapElRef.nativeElement).setView([39.5, -98.35], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this.map);
    // Recompute size in case the container was laid out after Leaflet read it during init.
    this.map.invalidateSize();
    this.renderMarkers(L);
  }

  private async loadLeaflet(): Promise<typeof LeafletType> {
    const mod = await import('leaflet');
    return mod.default ?? mod;
  }

  private renderMarkers(L: typeof LeafletType): void {
    if (!this.map) return;
    for (const m of this.markers) {
      m.remove();
    }
    this.markers = [];
    for (const point of this.points()) {
      if (!point.lat || !point.lng) continue;
      const marker = L.marker([point.lat, point.lng]).addTo(this.map).bindPopup(point.label);
      this.markers.push(marker);
    }
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 14 });
    }
  }

  private fixDefaultIcon(L: typeof LeafletType): void {
    const iconProto = L.Icon.Default.prototype as { _getIconUrl?: unknown };
    delete iconProto._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      iconUrl: 'assets/marker-icon.png',
      shadowUrl: 'assets/marker-shadow.png',
    });
  }
}
