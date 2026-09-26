import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageContainerDirective } from '@crgolden/modules/primitives';

@Component({
  selector: 'app-footer',
  imports: [PageContainerDirective],
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  protected readonly year = new Date().getFullYear();
}
