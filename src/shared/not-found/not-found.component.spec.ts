import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RESPONSE_INIT } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { NotFoundComponent } from './not-found.component';
import { SeoService } from '../seo.service';

describe('NotFoundComponent', () => {
  let fixture: ComponentFixture<NotFoundComponent>;

  async function setup(responseInit: ResponseInit | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideRouter([]), { provide: RESPONSE_INIT, useValue: responseInit }],
    }).compileComponents();

    fixture = TestBed.createComponent(NotFoundComponent);
  }

  it('sets response status to 404 when RESPONSE_INIT is provided', async () => {
    const responseInit: ResponseInit = {};
    await setup(responseInit);

    fixture.detectChanges();

    expect(responseInit.status).toBe(404);
  });

  it('does not throw when RESPONSE_INIT is null', async () => {
    await setup(null);

    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('calls SeoService.setNoIndex', async () => {
    await setup(null);
    const seo = TestBed.inject(SeoService);
    const spy = vi.spyOn(seo, 'setNoIndex');

    fixture.detectChanges();

    expect(spy).toHaveBeenCalled();
  });

  it('sets a title and description meta tag', async () => {
    await setup(null);
    const meta = TestBed.inject(Meta);

    fixture.detectChanges();

    expect(meta.getTag('name="description"')?.content).toBeTruthy();
  });
});
