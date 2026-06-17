import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChurchListComponent } from './church-list.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ChurchListComponent', () => {
  let component: ChurchListComponent;
  let fixture: ComponentFixture<ChurchListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChurchListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChurchListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
