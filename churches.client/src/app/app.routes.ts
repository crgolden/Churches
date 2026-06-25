import { Routes } from '@angular/router';
import { authGuard } from '../auth/auth.guard';
import { modGuard } from '../auth/mod.guard';
import { SearchComponent } from '../churches/search/search.component';
import { ChurchListComponent } from '../churches/list/church-list.component';
import { ChurchDetailComponent } from '../churches/detail/church-detail.component';
import { ContributeComponent } from '../churches/contribute/contribute.component';
import { ModerationComponent } from '../admin/moderation/moderation.component';

export const routes: Routes = [
  { path: '', component: SearchComponent, title: 'Find Your Church Home' },
  { path: 'churches', component: ChurchListComponent, title: 'Browse Churches' },
  // The church name is set dynamically by ChurchDetailComponent once the church loads.
  { path: 'churches/:slug', component: ChurchDetailComponent, title: 'Church' },
  { path: 'contribute/:slug', component: ContributeComponent, canActivate: [authGuard], title: 'Suggest a Correction' },
  { path: 'admin/moderation', component: ModerationComponent, canActivate: [modGuard], title: 'Moderation' },
  { path: '**', redirectTo: '' },
];
