import { ChangeDetectionStrategy, Component, OnInit, inject, RESPONSE_INIT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ButtonPrimaryDirective, PageContainerDirective } from '@crgolden/modules/primitives';
import { SeoService } from '../seo.service';
import { PageTitles, pageTitle } from '../page-title';
import { MetaNames } from '../seo-contract';

export const NOT_FOUND_DESCRIPTION = 'The page you requested could not be found.';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, ButtonPrimaryDirective, PageContainerDirective],
  templateUrl: './not-found.component.html',
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
    this.title.setTitle(pageTitle(PageTitles.pageNotFound));
    this.meta.updateTag({ name: MetaNames.description, content: NOT_FOUND_DESCRIPTION });
    this.seo.setNoIndex();
  }
}
