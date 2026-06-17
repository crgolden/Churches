import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChurchApiService } from '../../shared/church.service';
import { AuthService } from '../../auth/auth.service';
import { Church, WORSHIP_STYLES } from '../../shared/models';

@Component({
  selector: 'app-church-detail',
  imports: [RouterLink],
  templateUrl: './church-detail.component.html',
  styleUrl: './church-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChurchDetailComponent implements OnInit {
  private readonly api = inject(ChurchApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  protected readonly auth = inject(AuthService);
  protected readonly church = signal<Church | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly worshipStyles = WORSHIP_STYLES;

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) return;
    this.loading.set(true);
    this.api.getChurchBySlug(slug).subscribe({
      next: c => { this.church.set(c); this.loading.set(false); },
      error: () => { this.error.set('Church not found.'); this.loading.set(false); },
    });
  }

  protected worshipStyleLabel(value: number): string {
    return this.worshipStyles.find(s => s.value === value)?.label ?? 'Unknown';
  }

  protected back(): void {
    this.location.back();
  }

  protected encodeAddress(church: Church): string {
    return encodeURIComponent(
      [church.street, church.city, church.state, church.zip].filter(Boolean).join(', ')
    );
  }
}
