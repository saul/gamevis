(function () {
  "use strict";

  window.$ = window.jQuery = window.require('jquery');
  require('dist/components/bootstrap/dist/js/bootstrap');
  require('dist/components/webgl-heatmap/webgl-heatmap');

  const _ = window.require('lodash');
  const assert = window.require('assert');

  window.db = window.require('remote').require('./js/db');
  window.models = window.require('remote').require('./js/models');

  const Vue = window.require('vue');
  Vue.config.debug = true;

  Vue.component('gv-canvas', require('components/Canvas.vue'));
  Vue.component('gv-query-form', require('components/QueryForm.vue'));
  Vue.component('gv-heatmap-visualisation', require('components/HeatmapVisualisation.vue'));
  Vue.component('gv-game-level-select', require('components/GameLevelSelect.vue'));
  Vue.component('gv-session-select', require('components/SessionSelect.vue'));

  window.app = new Vue(require('components/App.vue'));
})();
