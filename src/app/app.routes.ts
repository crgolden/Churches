import { Routes } from '@angular/router';
import { authGuard } from '../auth/auth.guard';
import { modGuard } from '../auth/mod.guard';
import { SearchComponent } from '../churches/search/search.component';
import { ChurchListComponent } from '../churches/list/church-list.component';
import { ChurchDetailComponent } from '../churches/detail/church-detail.component';
import { ContributeComponent } from '../churches/contribute/contribute.component';
import { ModerationComponent } from '../admin/moderation/moderation.component';
import { NotFoundComponent } from '../shared/not-found/not-found.component';
import { denominationsResolver } from '../churches/search/denominations.resolver';
import { churchListResolver } from '../churches/list/church-list.resolver';
import { churchDetailResolver } from '../churches/detail/church-detail.resolver';
import { moderationResolver } from '../admin/moderation/moderation.resolver';
import { contributeChurchResolver } from '../churches/contribute/contribute.resolver';

export const routes: Routes = [
  {
    path: '',
    component: SearchComponent,
    resolve: { denominations: denominationsResolver },
    title: 'Find Your Church Home',
  },
  {
    path: 'churches',
    component: ChurchListComponent,
    resolve: { results: churchListResolver },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    title: 'Browse Churches',
  },
  {
    path: 'churches/:slug',
    component: ChurchDetailComponent,
    resolve: { church: churchDetailResolver },
    title: 'Church',
  },
  {
    path: 'contribute/:slug',
    component: ContributeComponent,
    canActivate: [authGuard],
    resolve: { church: contributeChurchResolver },
    title: 'Suggest a Correction',
  },
  {
    path: 'admin/moderation',
    component: ModerationComponent,
    canActivate: [modGuard],
    resolve: { corrections: moderationResolver },
    title: 'Moderation',
  },
  { path: '**', component: NotFoundComponent, title: 'Page Not Found' },
];
