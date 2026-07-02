import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
  inject,
  input,
  output,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type * as LeafletType from 'leaflet';
import type { SearchResult } from '../../shared/models';

@Component({
  selector: 'app-church-map',
  standalone: true,
  template: `
    <div #mapEl class="leaflet-container" style="width:100%;height:480px"></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChurchMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  readonly items = input<SearchResult[]>([]);
  readonly markerClick = output<string>();

  @ViewChild('mapEl') private mapElRef?: ElementRef<HTMLDivElement>;
  private map: LeafletType.Map | null = null;
  private markers: LeafletType.Marker[] = [];

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    void this.initMap();
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
    // The container is sized after the @if (showMap()) block reveals it, so Leaflet may have
    // read a zero/stale size during init — recompute now that it's laid out.
    this.map.invalidateSize();
    this.renderMarkers(L);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (changes['items'] && this.map) {
      void this.loadLeaflet().then(L => this.renderMarkers(L));
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
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
    const current = this.items();
    for (const item of current) {
      const lat = item.church.latitude;
      const lng = item.church.longitude;
      if (!lat || !lng) continue;
      const marker = L.marker([lat, lng])
        .addTo(this.map)
        .bindPopup(item.church.canonicalName);
      marker.on('click', () => this.markerClick.emit(item.church.slug));
      this.markers.push(marker);
    }
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds(), { padding: [40, 40] });
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
