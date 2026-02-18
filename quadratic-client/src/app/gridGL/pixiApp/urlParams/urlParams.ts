//! Loads URL params based on the current state of the app (user-focused: sheet, x, y, code for share links).

import { UrlParamsUser } from '@/app/gridGL/pixiApp/urlParams/UrlParamsUser';

class UrlParams {
  private urlParamsUser?: UrlParamsUser;

  init() {}

  show() {
    const params = new URLSearchParams(window.location.search);
    this.urlParamsUser = new UrlParamsUser(params);
  }
}

export const urlParams = new UrlParams();
