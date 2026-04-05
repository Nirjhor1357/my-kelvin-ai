import * as Sentry from "@sentry/node";

let initialized = false;

export function initializeMonitoring(dsn?: string): void {
  if (!dsn || initialized) {
    return;
  }

  Sentry.init({ dsn });
  initialized = true;
}

export { Sentry };
