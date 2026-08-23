const publicUrl = process.env.PUBLIC_URL || '';
const OFFLINE_STATUS_EVENT = 'fliplet-offline-status';

function reportOfflineStatus(status, message = '') {
  const detail = { status, message };
  window.__flipletOfflineStatus = detail;
  window.dispatchEvent(new CustomEvent(OFFLINE_STATUS_EVENT, { detail }));
}

function getAppBaseUrl() {
  const normalizedPublicUrl = publicUrl.replace(/\/$/, '');
  return new URL(`${normalizedPublicUrl}/`, window.location.origin);
}

function watchRegistration(registration) {
  const watchWorker = (worker) => {
    if (!worker) return;

    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') {
        reportOfflineStatus('ready');
      } else if (worker.state === 'redundant' && !registration.active) {
        reportOfflineStatus(
          'error',
          'Offline setup failed. Stay online and reload to try again.'
        );
      }
    });
  };

  if (registration.active) {
    reportOfflineStatus('ready');
  }
  watchWorker(registration.installing);
  registration.addEventListener('updatefound', () => {
    watchWorker(registration.installing);
  });

  navigator.serviceWorker.ready
    .then(() => reportOfflineStatus('ready'))
    .catch(() =>
      reportOfflineStatus(
        'error',
        'Offline setup failed. Stay online and reload to try again.'
      )
    );
}

export function register() {
  if (!('serviceWorker' in navigator)) {
    reportOfflineStatus(
      'unsupported',
      'This browser cannot save Fliplet for offline use.'
    );
    return;
  }

  reportOfflineStatus('preparing');

  const appBaseUrl = getAppBaseUrl();
  const serviceWorkerUrl = new URL('service-worker.js', appBaseUrl);
  const pageWasControlled = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!pageWasControlled || refreshing) {
      return;
    }

    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
        scope: appBaseUrl.pathname,
      });

      watchRegistration(registration);
      await registration.update();
    } catch (error) {
      // An installed worker continues serving the cached app while offline.
      console.warn('Fliplet could not check for an offline update.', error);
      if (navigator.serviceWorker.controller) {
        reportOfflineStatus('ready');
      } else {
        reportOfflineStatus(
          'error',
          'Offline setup failed. Stay online and reload to try again.'
        );
      }
    }
  });
}

export function unregister() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const appBaseUrl = getAppBaseUrl();

  navigator.serviceWorker
    .getRegistration(appBaseUrl.href)
    .then((registration) => {
      if (registration?.scope === appBaseUrl.href) {
        return registration.unregister();
      }

      return false;
    })
    .catch(() => {});
}
