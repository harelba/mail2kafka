'use strict';

angular.module('srcApp.auth', [
  'srcApp.constants',
  'srcApp.util',
  'ngCookies',
  'ui.router'
])
  .config(function($httpProvider) {
    $httpProvider.interceptors.push('authInterceptor');
  });
