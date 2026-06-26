import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

/**
 * Logs application startup errors in the browser console.
 */
function handleBootstrapError(error: unknown): void {
  console.error(error);
}

bootstrapApplication(AppComponent, appConfig).catch(handleBootstrapError);