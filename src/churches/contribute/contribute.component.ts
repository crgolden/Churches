import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonPrimaryDirective, CardDirective } from '@crgolden/modules/primitives';
import { ChurchApiService } from '../../shared/church.service';
import { Church, Denomination, UNKNOWN_WORSHIP_STYLE_LABEL, WORSHIP_STYLES } from '../../shared/models';
import { RouteDataKeys } from '../../app/app-paths';
import {
  CORRECTABLE_FIELDS,
  CorrectableField,
  CorrectableFieldKeys,
  FieldKind,
  FieldKinds,
} from '../../shared/correctable-fields';
import { AriaRoles } from '../../shared/aria-roles';
import { CONTRIBUTE_ERROR_MESSAGES, ContributeError, ContributeErrors } from './contribute-errors';

@Component({
  selector: 'app-contribute',
  imports: [ButtonPrimaryDirective, CardDirective],
  templateUrl: './contribute.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContributeComponent implements OnInit {
  protected readonly ariaRoles = AriaRoles;

  private readonly api = inject(ChurchApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  public readonly church = signal<Church | null>(null);
  public readonly field = signal<string>(CorrectableFieldKeys.canonicalName);
  public readonly newValue = signal('');
  public readonly submitting = signal(false);
  public readonly submitted = signal(false);
  public readonly error = signal<ContributeError | null>(null);
  protected readonly fields = CORRECTABLE_FIELDS;

  protected readonly errorMessage = computed(() => {
    const error = this.error();
    return error === null ? null : CONTRIBUTE_ERROR_MESSAGES[error];
  });

  protected readonly submissionAnnouncement = computed(() =>
    this.submitted() ? 'Your correction has been submitted for review.' : null,
  );

  protected readonly worshipStyles = WORSHIP_STYLES;
  protected readonly denominations = signal<Denomination[]>([]);

  protected readonly kind = computed<FieldKind>(
    () => CORRECTABLE_FIELDS.find(f => f.key === this.field())?.kind ?? FieldKinds.text,
  );

  protected readonly currentValue = computed(() => {
    const church = this.church();
    if (church === null) {
      return null;
    }

    const current = church[this.field() as CorrectableField];
    if (current === null || current === undefined) {
      return null;
    }

    return this.describe(current);
  });

  ngOnInit(): void {
    this.church.set(this.route.snapshot.data[RouteDataKeys.church] as Church);
    this.denominations.set((this.route.snapshot.data[RouteDataKeys.denominations] ?? []) as Denomination[]);
  }

  private describe(current: string | number | boolean): string {
    switch (this.kind()) {
      case FieldKinds.worshipStyle:
        return WORSHIP_STYLES.find(s => s.value === current)?.label ?? UNKNOWN_WORSHIP_STYLE_LABEL;
      case FieldKinds.denomination:
        return this.denominations().find(d => d.id === current)?.name ?? String(current);
      case FieldKinds.boolean:
        return current === true ? 'Yes' : 'No';
      default:
        return String(current);
    }
  }

  public onFieldChange(field: string): void {
    this.field.set(field);
    this.newValue.set('');
    this.error.set(null);
  }

  public submit(): void {
    const c = this.church();
    if (!c || !this.field() || !this.newValue().trim()) return;
    const fieldKey = this.field() as CorrectableField;
    const current = c[fieldKey];
    const oldValue = current != null ? String(current) : null;
    if (this.newValue().trim() === oldValue) {
      this.error.set(ContributeErrors.alreadyHasValue);
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.submitCorrection(c.id, this.field(), oldValue, this.newValue().trim()).subscribe({
      next: () => { this.submitted.set(true); this.submitting.set(false); },
      error: () => { this.error.set(ContributeErrors.submitFailed); this.submitting.set(false); },
    });
  }
}
