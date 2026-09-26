import { ChangeDetectionStrategy, Component, OnInit, inject, signal, RESPONSE_INIT } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import {
  ButtonGhostDirective,
  ButtonSecondaryDirective,
  CardDirective,
  PageContainerDirective,
  PageSectionDirective,
} from '@crgolden/modules/primitives';
import { EyebrowDirective, InlineDeleteButtonDirective } from '../../shared/primitives/primitives';
import { ChurchApiService } from '../../shared/church.service';
import { AuthService } from '../../auth/auth.service';
import { SearchContextService } from '../../shared/search-context.service';
import { SeoService } from '../../shared/seo.service';
import {
  Campus,
  Church,
  DAYS_OF_WEEK,
  ServiceSchedule,
  UNKNOWN_WORSHIP_STYLE_LABEL,
  US_STATES,
  WORSHIP_STYLES,
} from '../../shared/models';
import { LocationMapComponent, MapPoint } from '../map/location-map.component';
import { RouteDataKeys } from '../../app/app-paths';
import { AriaRoles } from '../../shared/aria-roles';

export const CHURCH_NOT_FOUND = 'Church not found.';

@Component({
  selector: 'app-church-detail',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    LocationMapComponent,
    ButtonGhostDirective,
    ButtonSecondaryDirective,
    CardDirective,
    EyebrowDirective,
    InlineDeleteButtonDirective,
    PageContainerDirective,
    PageSectionDirective,
  ],
  templateUrl: './church-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChurchDetailComponent implements OnInit {
  protected readonly ariaRoles = AriaRoles;

  private readonly api = inject(ChurchApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT);
  public slug: string | null = null;

  protected readonly auth = inject(AuthService);
  protected readonly lastSearch = inject(SearchContextService).lastSearch;
  public readonly church = signal<Church | null>(null);
  protected readonly loading = signal(false);
  public readonly error = signal<string | null>(null);
  public readonly curationError = signal<string | null>(null);
  public readonly pendingDeleteId = signal<string | null>(null);
  protected readonly worshipStyles = WORSHIP_STYLES;
  protected readonly daysOfWeek = DAYS_OF_WEEK;

  public readonly scheduleForm = this.fb.nonNullable.group({
    dayOfWeek: 0,
    startTime: '',
    description: '',
  });

  protected readonly ministryForm = this.fb.nonNullable.group({
    name: '',
    description: '',
  });

  public readonly campusForm = this.fb.nonNullable.group({
    name: '',
    street: '',
    city: '',
    state: this.fb.control<string | null>(null),
    zip: '',
    latitude: this.fb.control<number | null>(null),
    longitude: this.fb.control<number | null>(null),
  });

  protected readonly usStates = US_STATES;

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug');
    this.applyChurch((this.route.snapshot.data[RouteDataKeys.church] ?? null) as Church | null);
  }

  private applyChurch(church: Church | null): void {
    if (church === null) {
      this.error.set(CHURCH_NOT_FOUND);
      if (this.responseInit) {
        this.responseInit.status = 404;
      }
      this.seo.setNoIndex();
      return;
    }
    this.error.set(null);
    this.church.set(church);
    this.seo.setChurchMeta(church);
  }

  public worshipStyleLabel(value: number): string {
    return this.worshipStyles.find(s => s.value === value)?.label ?? UNKNOWN_WORSHIP_STYLE_LABEL;
  }

  public scheduleLabel(schedule: ServiceSchedule): string {
    const day = DAYS_OF_WEEK.find(d => d.value === schedule.dayOfWeek)?.label;
    const time = schedule.startTime.slice(0, 5);
    return [day, time].filter(Boolean).join(' ');
  }

  public campusAddress(campus: Campus): string {
    return [campus.street, campus.city, campus.state, campus.zip].filter(Boolean).join(', ');
  }

  public mapPoints(): MapPoint[] {
    const c = this.church();
    if (!c) return [];
    const points: MapPoint[] = [];
    if (c.latitude && c.longitude) {
      points.push({ lat: c.latitude, lng: c.longitude, label: c.canonicalName });
    }
    for (const campus of c.campuses) {
      if (campus.latitude && campus.longitude) {
        points.push({ lat: campus.latitude, lng: campus.longitude, label: campus.name });
      }
    }
    return points;
  }

  public addSchedule(): void {
    const c = this.church();
    const v = this.scheduleForm.getRawValue();
    if (!c || !v.startTime) return;
    this.curationError.set(null);
    this.api
      .createSchedule(c.id, { dayOfWeek: v.dayOfWeek, startTime: v.startTime, description: v.description || null })
      .subscribe({
        next: () => {
          this.scheduleForm.reset({ dayOfWeek: 0, startTime: '', description: '' });
          this.reload();
        },
        error: (err: HttpErrorResponse) => this.curationError.set(this.curationFailure('add the service time', err)),
      });
  }

  protected addMinistry(): void {
    const c = this.church();
    const v = this.ministryForm.getRawValue();
    if (!c || !v.name) return;
    this.curationError.set(null);
    this.api.createMinistry(c.id, { name: v.name, description: v.description || null }).subscribe({
      next: () => {
        this.ministryForm.reset({ name: '', description: '' });
        this.reload();
      },
      error: (err: HttpErrorResponse) => this.curationError.set(this.curationFailure('add the ministry', err)),
    });
  }

  public addCampus(): void {
    const c = this.church();
    const v = this.campusForm.getRawValue();
    if (!c) return;
    if (!v.name || !v.city || !v.state || !v.zip) {
      this.curationError.set('A campus needs a name, city, state and ZIP code.');
      return;
    }
    this.curationError.set(null);
    this.api
      .createCampus(c.id, {
        name: v.name,
        street: v.street || null,
        city: v.city,
        state: v.state,
        zip: v.zip,
        latitude: v.latitude ?? 0,
        longitude: v.longitude ?? 0,
      })
      .subscribe({
        next: () => {
          this.campusForm.reset({ name: '', street: '', city: '', state: null, zip: '', latitude: null, longitude: null });
          this.reload();
        },
        error: (err: HttpErrorResponse) => this.curationError.set(this.curationFailure('add the campus', err)),
      });
  }

  public askToDelete(id: string): void {
    this.curationError.set(null);
    this.pendingDeleteId.set(id);
  }

  public cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  protected confirmDeleteSchedule(id: string): void {
    this.runDelete(this.api.deleteSchedule(id), 'delete the service time');
  }

  public confirmDeleteMinistry(id: string): void {
    this.runDelete(this.api.deleteMinistry(id), 'delete the ministry');
  }

  protected confirmDeleteCampus(id: string): void {
    this.runDelete(this.api.deleteCampus(id), 'delete the campus');
  }

  public encodeAddress(church: Church): string {
    return encodeURIComponent(
      [church.street, church.city, church.state, church.zip].filter(Boolean).join(', ')
    );
  }

  private runDelete(request: Observable<void>, action: string): void {
    this.curationError.set(null);
    request.subscribe({
      next: () => {
        this.pendingDeleteId.set(null);
        this.reload();
      },
      error: (err: HttpErrorResponse) => {
        this.pendingDeleteId.set(null);
        this.curationError.set(this.curationFailure(action, err));
      },
    });
  }

  private curationFailure(action: string, err: HttpErrorResponse): string {
    const reason = typeof err.error === 'string' && err.error.trim() ? err.error.trim() : err.message;
    return `Couldn’t ${action}: ${reason}`;
  }

  public loadChurch(): void {
    if (!this.slug) return;
    this.loading.set(true);
    this.api.getChurchBySlug(this.slug).subscribe({
      next: c => {
        this.church.set(c);
        this.seo.setChurchMeta(c);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(CHURCH_NOT_FOUND);
        this.loading.set(false);
        if (this.responseInit) {
          this.responseInit.status = 404;
        }
        this.seo.setNoIndex();
      },
    });
  }

  private reload(): void {
    this.loadChurch();
  }
}
