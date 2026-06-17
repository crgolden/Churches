import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChurchDetailComponent } from './church-detail.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ChurchDetailComponent', () => {
  let component: ChurchDetailComponent;
  let fixture: ComponentFixture<ChurchDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChurchDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChurchDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
