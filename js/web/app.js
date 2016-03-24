/**
 * Root module.
 * Registers all Vue.js components and initialises Bootstrap and other dependencies.
 *
 * @module web/app
 */
(function () {
  "use strict";

  // jQuery
  window.$ = window.jQuery = window.require('jquery');

  // Bootstrap
  require('dist/components/bootstrap/dist/js/bootstrap');

  // WebGL heatmap
  require('dist/components/webgl-heatmap/webgl-heatmap');

  // vis.js
  require('dist/components/vis/dist/vis.css');

  // font-awesome
  require('dist/components/components-font-awesome/css/font-awesome.css');

  // fontawesome-iconpicker
  require('dist/components/fontawesome-iconpicker/dist/css/fontawesome-iconpicker.css');

  // select2
  // Note: we need to require it through node instead of Browserify, otherwise
  // select2 loads a separate instance of jQuery instead of using the one we've
  // already loaded
  window.require('./dist/components/select2/dist/js/select2');
  require('dist/components/select2/dist/css/select2.css');

  window.db = window.require('./js/db');
  window.models = window.require('./js/models');
  
  window.remote = window.require('remote');

  const Vue = window.require('vue');
  Vue.config.debug = true;
  Vue.config.convertAllProperties = true;

  Vue.component('gv-alerts', require('components/Alerts.vue'));
  Vue.component('gv-radio-list', require('components/RadioList.vue'));
  Vue.component('gv-event-filter', require('components/EventFilter.vue'));
  Vue.component('gv-event-filter-list', require('components/EventFilterList.vue'));
  Vue.component('gv-game-level-select', require('components/GameLevelSelect.vue'));
  Vue.component('gv-session-select', require('components/SessionSelect.vue'));
  Vue.component('gv-visualisation-tab', require('components/VisualisationTab.vue'));
  Vue.component('gv-event-list', require('components/EventList.vue'));
  Vue.component('gv-webgl-renderer', require('components/WebGLRenderer.vue'));
  Vue.component('gv-vis-continuous', require('components/VisContinuous.vue'));
  Vue.component('gv-vis-discontinuous', require('components/VisDiscontinuous.vue'));
  Vue.component('gv-vis-timeline', require('components/VisTimeline.vue'));
  Vue.component('gv-vis-heatmap', require('components/VisHeatmap.vue'));
  Vue.component('gv-heatmap-gradient-select', require('components/HeatmapGradientSelect.vue'));
  Vue.component('gv-timeline', require('components/Timeline.vue'));

  Vue.component('iconpicker', require('components/Iconpicker.vue'));

  /**
   * Singleton instance of the `App` component.
   * Accessible via `window.app`.
   *
   * @global
   * @type {module:components/App}
   * @name window.app
   */
  window.app = new Vue(require('components/App.vue'));
})();
