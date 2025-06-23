//! Loads and sets the URL params based on the current state of the app.
//!
//! There are two types of URL params: user-focused ones, and dev-focused one.
//! The dev-focused ones are triggered by `debugFlags.saveURLState = true;` and
//! save the entire state of the app. User-focused ones are limited to x, y,
//! sheet, and code editor only.

import { debugFlag } from '@/app/debugFlags/debugFlags';
import { UrlParamsDev } from '@/app/gridGL/pixiApp/urlParams/UrlParamsDev';
import { UrlParamsUser } from '@/app/gridGL/pixiApp/urlParams/UrlParamsUser';

const UPDATE_INTERVAL = 100;

class UrlParams {
  private urlParamsDev?: UrlParamsDev;
  private urlParamsUser?: UrlParamsUser;

  init() {}

  show() {
    const params = new URLSearchParams(window.location.search);
    if (debugFlag('debugSaveURLState') || params.has('state')) {
      this.urlParamsDev = new UrlParamsDev(params);
      if (this.urlParamsDev.noUpdates) return;
    } else {
      this.urlParamsUser = new UrlParamsUser(params);
    }
    setInterval(this.update, UPDATE_INTERVAL);
  }

  update = () => {
    if (debugFlag('debugSaveURLState') && this.urlParamsDev) {
      this.urlParamsDev.updateParams();
    } else if (!debugFlag('debugSaveURLState') && this.urlParamsUser) {
      // Removed by design. Uncomment this to start including user-focused URL params.
      // this.urlParamsUser.updateParams();
    }
  };
}

export const urlParams = new UrlParams();
