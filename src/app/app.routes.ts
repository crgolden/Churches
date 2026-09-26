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
import { churchCountResolver } from '../churches/search/church-count.resolver';
import { churchListResolver } from '../churches/list/church-list.resolver';
import { churchDetailResolver } from '../churches/detail/church-detail.resolver';
import { moderationResolver } from '../admin/moderation/moderation.resolver';
import { contributeChurchResolver } from '../churches/contribute/contribute.resolver';
import { PageTitles } from '../shared/page-title';
import { AppPaths, RouteDataKeys } from './app-paths';

export const routes: Routes = [
  {
    path: '',
    component: SearchComponent,
    resolve: {
      [RouteDataKeys.denominations]: denominationsResolver,
      [RouteDataKeys.churchCount]: churchCountResolver,
    },
    title: PageTitles.home,
  },
  {
    path: AppPaths.churches,
    component: ChurchListComponent,
    resolve: { [RouteDataKeys.results]: churchListResolver },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    title: PageTitles.browseChurches,
  },
  {
    path: `${AppPaths.churches}/:slug`,
    component: ChurchDetailComponent,
    resolve: { [RouteDataKeys.church]: churchDetailResolver },
  },
  {
    path: `${AppPaths.contribute}/:slug`,
    component: ContributeComponent,
    canActivate: [authGuard],
    resolve: {
      [RouteDataKeys.church]: contributeChurchResolver,
      [RouteDataKeys.denominations]: denominationsResolver,
    },
    title: PageTitles.suggestACorrection,
  },
  {
    path: AppPaths.adminModeration,
    component: ModerationComponent,
    canActivate: [modGuard],
    resolve: { [RouteDataKeys.corrections]: moderationResolver },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    title: PageTitles.moderation,
  },
  { path: '**', component: NotFoundComponent, title: PageTitles.pageNotFound },
];
