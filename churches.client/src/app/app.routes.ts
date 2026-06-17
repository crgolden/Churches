import { Routes } from '@angular/router';
import { authGuard } from '../auth/auth.guard';
import { modGuard } from '../auth/mod.guard';
import { SearchComponent } from '../churches/search/search.component';
import { ChurchListComponent } from '../churches/list/church-list.component';
import { ChurchDetailComponent } from '../churches/detail/church-detail.component';
import { ContributeComponent } from '../churches/contribute/contribute.component';
import { ModerationComponent } from '../admin/moderation/moderation.component';

export const routes: Routes = [
  { path: '', component: SearchComponent },
  { path: 'churches', component: ChurchListComponent },
  { path: 'churches/:slug', component: ChurchDetailComponent },
  { path: 'contribute/:slug', component: ContributeComponent, canActivate: [authGuard] },
  { path: 'admin/moderation', component: ModerationComponent, canActivate: [modGuard] },
  { path: '**', redirectTo: '' },
];
