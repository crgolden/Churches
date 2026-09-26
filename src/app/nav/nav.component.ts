import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonGhostDirective, ButtonPrimarySmallDirective, PageContainerDirective } from '@crgolden/modules/primitives';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, ButtonGhostDirective, ButtonPrimarySmallDirective, PageContainerDirective],
  templateUrl: './nav.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavComponent {
  protected readonly auth = inject(AuthService);
  public readonly menuOpen = signal(false);
  public toggleMenu(): void { this.menuOpen.update(v => !v); }
}
