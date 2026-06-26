import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { PollDetailComponent } from './features/poll-detail/poll-detail.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
  },
  {
    path: 'poll/:id',
    component: PollDetailComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];