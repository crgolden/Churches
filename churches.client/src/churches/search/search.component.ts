import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WORSHIP_STYLES } from '../../shared/models';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent {
  private readonly router = inject(Router);

  protected readonly keyword = signal('');
  protected readonly state = signal('');
  protected readonly worshipStyle = signal<number | null>(null);
  protected readonly wheelchairAccessible = signal<boolean | null>(null);
  protected readonly lat = signal<number | null>(null);
  protected readonly lng = signal<number | null>(null);
  protected readonly locating = signal(false);
  protected readonly worshipStyles = WORSHIP_STYLES;

  protected useLocation(): void {
    if (!navigator.geolocation) return;
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.lat.set(pos.coords.latitude);
        this.lng.set(pos.coords.longitude);
        this.locating.set(false);
      },
      () => this.locating.set(false)
    );
  }

  protected search(): void {
    const params: Record<string, string> = {};
    const kw = this.keyword().trim();
    if (kw) params['q'] = kw;
    const st = this.state().trim();
    if (st) params['state'] = st;
    const ws = this.worshipStyle();
    if (ws != null) params['worshipStyle'] = String(ws);
    const wa = this.wheelchairAccessible();
    if (wa != null) params['wheelchairAccessible'] = String(wa);
    const lat = this.lat();
    const lng = this.lng();
    if (lat != null && lng != null) {
      params['lat'] = String(lat);
      params['lng'] = String(lng);
    }
    this.router.navigate(['/churches'], { queryParams: params });
  }
}
