import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then(({ HomeComponent }) => HomeComponent),
  },
  {
    path: 'poll/:id',
    loadComponent: () =>
      import('./features/poll-detail/poll-detail.component').then(
        ({ PollDetailComponent }) => PollDetailComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
