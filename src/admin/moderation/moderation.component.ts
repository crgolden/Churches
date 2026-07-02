import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ChurchApiService } from '../../shared/church.service';
import { PagedResult, UserCorrection } from '../../shared/models';

@Component({
  selector: 'app-moderation',
  imports: [DatePipe],
  templateUrl: './moderation.component.html',
  styleUrl: './moderation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationComponent implements OnInit {
  private readonly api = inject(ChurchApiService);

  protected readonly corrections = signal<PagedResult<UserCorrection> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.getCorrections(0).subscribe({
      next: result => { this.corrections.set(result); this.loading.set(false); },
      error: () => { this.error.set('Failed to load corrections.'); this.loading.set(false); },
    });
  }

  protected approve(id: string): void {
    this.api.approveCorrection(id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Failed to approve correction.'),
    });
  }

  protected reject(id: string): void {
    this.api.rejectCorrection(id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Failed to reject correction.'),
    });
  }
}
