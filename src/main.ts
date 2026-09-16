import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Logs application startup errors in the browser console.
 */
function handleBootstrapError(error: unknown): void {
  console.error(error);
}

bootstrapApplication(App, appConfig).catch(handleBootstrapError);
