import { ChangeDetectionStrategy, Component, OnInit, inject, RESPONSE_INIT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { SeoService } from '../seo.service';

/**
 * Rendered for any unmatched route (`{ path: '**' }`) and for a church slug that
 * fails to resolve. Sets a real HTTP 404 during SSR (via RESPONSE_INIT) and a
 * noindex robots tag so unresolved URLs are never indexed or treated as soft 404s.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent implements OnInit {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT);

  ngOnInit(): void {
    if (this.responseInit) {
      this.responseInit.status = 404;
    }
    this.title.setTitle('Page Not Found | Churches');
    this.meta.updateTag({ name: 'description', content: 'The page you requested could not be found.' });
    this.seo.setNoIndex();
  }
}
