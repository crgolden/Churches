import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChurchApiService } from '../../shared/church.service';
import { AuthService } from '../../auth/auth.service';
import { Campus, Church, DAYS_OF_WEEK, ServiceSchedule, WORSHIP_STYLES } from '../../shared/models';
import { LocationMapComponent, MapPoint } from '../map/location-map.component';

@Component({
  selector: 'app-church-detail',
  imports: [RouterLink, ReactiveFormsModule, LocationMapComponent],
  templateUrl: './church-detail.component.html',
  styleUrl: './church-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChurchDetailComponent implements OnInit {
  private readonly api = inject(ChurchApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly fb = inject(FormBuilder);
  private readonly title = inject(Title);
  private slug: string | null = null;

  protected readonly auth = inject(AuthService);
  protected readonly church = signal<Church | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly worshipStyles = WORSHIP_STYLES;
  protected readonly daysOfWeek = DAYS_OF_WEEK;

  protected readonly scheduleForm = this.fb.nonNullable.group({
    dayOfWeek: 0,
    startTime: '',
    description: '',
  });

  protected readonly ministryForm = this.fb.nonNullable.group({
    name: '',
    description: '',
  });

  protected readonly campusForm = this.fb.nonNullable.group({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    latitude: 0,
    longitude: 0,
  });

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug');
    if (!this.slug) return;
    this.loadChurch();
  }

  protected worshipStyleLabel(value: number): string {
    return this.worshipStyles.find(s => s.value === value)?.label ?? 'Unknown';
  }

  protected scheduleLabel(schedule: ServiceSchedule): string {
    const day = DAYS_OF_WEEK.find(d => d.value === schedule.dayOfWeek)?.label ?? '';
    // startTime arrives as "HH:mm:ss"; show "HH:mm".
    const time = schedule.startTime.slice(0, 5);
    return `${day} ${time}`.trim();
  }

  protected campusAddress(campus: Campus): string {
    return [campus.street, campus.city, campus.state, campus.zip].filter(Boolean).join(', ');
  }

  protected mapPoints(): MapPoint[] {
    const c = this.church();
    if (!c) return [];
    const points: MapPoint[] = [];
    if (c.latitude && c.longitude) {
      points.push({ lat: c.latitude, lng: c.longitude, label: c.canonicalName });
    }
    for (const campus of c.campuses ?? []) {
      if (campus.latitude && campus.longitude) {
        points.push({ lat: campus.latitude, lng: campus.longitude, label: campus.name });
      }
    }
    return points;
  }

  protected addSchedule(): void {
    const c = this.church();
    const v = this.scheduleForm.getRawValue();
    if (!c || !v.startTime) return;
    this.api
      .createSchedule(c.id, { dayOfWeek: v.dayOfWeek, startTime: v.startTime, description: v.description || null })
      .subscribe(() => {
        this.scheduleForm.reset({ dayOfWeek: 0, startTime: '', description: '' });
        this.reload();
      });
  }

  protected deleteSchedule(id: string): void {
    this.api.deleteSchedule(id).subscribe(() => this.reload());
  }

  protected addMinistry(): void {
    const c = this.church();
    const v = this.ministryForm.getRawValue();
    if (!c || !v.name) return;
    this.api.createMinistry(c.id, { name: v.name, description: v.description || null }).subscribe(() => {
      this.ministryForm.reset({ name: '', description: '' });
      this.reload();
    });
  }

  protected deleteMinistry(id: string): void {
    this.api.deleteMinistry(id).subscribe(() => this.reload());
  }

  protected addCampus(): void {
    const c = this.church();
    const v = this.campusForm.getRawValue();
    if (!c || !v.name || !v.city || !v.state || !v.zip) return;
    this.api
      .createCampus(c.id, {
        name: v.name,
        street: v.street || null,
        city: v.city,
        state: v.state,
        zip: v.zip,
        latitude: v.latitude,
        longitude: v.longitude,
      })
      .subscribe(() => {
        this.campusForm.reset({ name: '', street: '', city: '', state: '', zip: '', latitude: 0, longitude: 0 });
        this.reload();
      });
  }

  protected deleteCampus(id: string): void {
    this.api.deleteCampus(id).subscribe(() => this.reload());
  }

  protected back(): void {
    this.location.back();
  }

  protected encodeAddress(church: Church): string {
    return encodeURIComponent(
      [church.street, church.city, church.state, church.zip].filter(Boolean).join(', ')
    );
  }

  private loadChurch(): void {
    if (!this.slug) return;
    this.loading.set(true);
    this.api.getChurchBySlug(this.slug).subscribe({
      next: c => {
        this.church.set(c);
        this.title.setTitle(`${c.canonicalName} | Churches`);
        this.loading.set(false);
      },
      error: () => { this.error.set('Church not found.'); this.loading.set(false); },
    });
  }

  private reload(): void {
    this.loadChurch();
  }
}
