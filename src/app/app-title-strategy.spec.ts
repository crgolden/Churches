import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { AppTitleStrategy } from './app-title-strategy';
import { newPathSegment } from '@crgolden/modules/testing';
import { SITE_NAME } from '../shared/page-title';

@Component({ template: '' })
class RoutedComponent {}

const ROUTE_TITLE = `Route ${crypto.randomUUID()}`;
const TITLED_PATH = newPathSegment();
const UNTITLED_PATH = newPathSegment();

describe('AppTitleStrategy', () => {
  let router: Router;
  let title: Title;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: TITLED_PATH, component: RoutedComponent, title: ROUTE_TITLE },
          { path: UNTITLED_PATH, component: RoutedComponent },
        ]),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    title = TestBed.inject(Title);
  });

  it('suffixes a route that declares a title', async () => {
    await router.navigate([TITLED_PATH]);

    expect(title.getTitle()).toBe(`${ROUTE_TITLE} | ${SITE_NAME}`);
  });

  it('leaves the title alone for a route that declares none, rather than writing a bare fallback', async () => {
    const setByTheComponentThatOwnsThisRoute = `Title ${crypto.randomUUID()}`;
    title.setTitle(setByTheComponentThatOwnsThisRoute);

    await router.navigate([UNTITLED_PATH]);

    expect(title.getTitle()).toBe(setByTheComponentThatOwnsThisRoute);
  });
});
