import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChurchApiService } from '../../shared/church.service';
import { Church } from '../../shared/models';

const CORRECTABLE_FIELDS = [
  'canonicalName', 'street', 'city', 'state', 'zip',
  'phoneNumber', 'website', 'emailAddress', 'primaryLanguage',
] as const;

@Component({
  selector: 'app-contribute',
  templateUrl: './contribute.component.html',
  styleUrl: './contribute.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContributeComponent implements OnInit {
  private readonly api = inject(ChurchApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly church = signal<Church | null>(null);
  protected readonly field = signal('canonicalName');
  protected readonly newValue = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly fields = CORRECTABLE_FIELDS;

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) return;
    this.api.getChurchBySlug(slug).subscribe({
      next: c => this.church.set(c),
      error: () => this.router.navigate(['/']),
    });
  }

  protected submit(): void {
    const c = this.church();
    if (!c || !this.field() || !this.newValue().trim()) return;
    const fieldKey = this.field() as keyof Church;
    const oldValue = c[fieldKey] != null ? String(c[fieldKey]) : null;
    if (this.newValue().trim() === oldValue) {
      this.error.set('This field already has that value. Please enter a different correction.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.submitCorrection(c.id, this.field(), oldValue, this.newValue().trim()).subscribe({
      next: () => { this.submitted.set(true); this.submitting.set(false); },
      error: () => { this.error.set('Failed to submit. Please try again.'); this.submitting.set(false); },
    });
  }
}
