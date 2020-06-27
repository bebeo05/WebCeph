import React from 'react';
import ReactDOM from 'react-dom';
import ReduxApp, { store } from './ReduxApp';
import { Store } from 'redux';
import {
  setAppUpdateStatus,
  setAppInstallStatus,
  envLocalesChanged,
  connectionStatusChanged,
} from 'actions/env';
import { getNavigatorLanguages } from 'utils/locale';
import { isAppInstalled } from 'store/reducers/app';
import { isPersistedStateReady } from 'store/reducers/persistence';

declare var module: __WebpackModuleApi.Module;
declare var window: Window & {
  ResizeObserver?: ResizeObserver;
  __STORE__: Store<StoreState> | undefined;
};

if (!__DEBUG__ && location.protocol !== 'https:') {
  // Auto redirect to HTTPS version
  location.href = 'https:' + window.location.href.substring(window.location.protocol.length);
}

if (window.ResizeObserver === undefined) {
  window.ResizeObserver = require('resize-observer-polyfill').default;
}

let reg: ServiceWorkerRegistration;

const installOrUpdateApp = async () => {
  const state = store.getState();
  if (!reg) {
    const runtime = require('serviceworker-webpack-plugin/lib/runtime');
    reg = await runtime.register();
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      const setStatus = isAppInstalled(state) ? setAppUpdateStatus : setAppInstallStatus;
      if (newWorker) {
        // @TODO: get total size
        switch (newWorker.state) {
          case 'installing':
            store.dispatch(
              setStatus({ complete: false }),
            );
            break;
          case 'installed':
            store.dispatch(
              setStatus({ complete: true }),
            );
            break;
          default:
            break;
        }
      }
    });
  } else {
    // @TODO: does this actually update?
    await reg.update();
  }
};

if (!__DEBUG__ && 'serviceWorker' in navigator) {
  const unsubscribe = store.subscribe(() => {
    const state = store.getState();
    if (isPersistedStateReady(state)) {
      unsubscribe();
      installOrUpdateApp();
    }
  });
}

if (__DEBUG__) {
  // Expose store in development
  window.__STORE__ = store;
}

const handleConnectionChange = () => {
  console.info('Connection changed', navigator.onLine);
  store.dispatch(connectionStatusChanged({
    isOffline: !navigator.onLine,
  }));
};

window.addEventListener('online', handleConnectionChange);
window.addEventListener('offline', handleConnectionChange);

const handleLanguageChange = () => {
  console.info('Locales changed', getNavigatorLanguages());
  store.dispatch(envLocalesChanged(getNavigatorLanguages()));
};

window.addEventListener('languagechange', handleLanguageChange);

handleConnectionChange();
handleLanguageChange();

const rootEl = document.getElementById('container');

const render = (App: typeof ReduxApp) => ReactDOM.render(
  <App />,
  rootEl,
);

render(ReduxApp);

if (module.hot) {
  module.hot.accept('./ReduxApp', () => {
    const NextApp: typeof ReduxApp = require('./ReduxApp').default;
    render(NextApp);
  });
}
