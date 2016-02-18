(function () {
  "use strict";

  // jQuery
  window.$ = window.jQuery = window.require('jquery');

  // Bootstrap
  require('dist/components/bootstrap/dist/js/bootstrap');

  // WebGL heatmap
  require('dist/components/webgl-heatmap/webgl-heatmap');

  // seiyria/bootstrap-slider
  require('dist/components/seiyria-bootstrap-slider/dist/css/bootstrap-slider.css');

  // vis.js
  require('dist/components/vis/dist/vis.css');

  // font-awesome
  require('dist/components/components-font-awesome/css/font-awesome.css');

  // fontawesome-iconpicker
  require('dist/components/fontawesome-iconpicker/dist/css/fontawesome-iconpicker.css');

  window.db = window.require('./js/db');
  window.models = window.require('./js/models');

  const Vue = window.require('vue');
  Vue.config.debug = true;

  Vue.component('gv-canvas', require('components/Canvas.vue'));
  Vue.component('gv-query-form', require('components/QueryForm.vue'));
  Vue.component('gv-heatmap-visualisation', require('components/HeatmapVisualisation.vue'));
  Vue.component('gv-game-level-select', require('components/GameLevelSelect.vue'));
  Vue.component('gv-session-select', require('components/SessionSelect.vue'));
  Vue.component('gv-timeline-visualisation', require('components/TimelineVisualisation.vue'));
  Vue.component('gv-timeline-events', require('components/TimelineEvents.vue'));
  Vue.component('gv-timeline-canvas', require('components/TimelineCanvas.vue'));
  Vue.component('gv-timeline-event-continuous', require('components/TimelineEventContinuous.vue'));
  Vue.component('gv-timeline-event-discontinuous', require('components/TimelineEventDiscontinuous.vue'));
  Vue.component('gv-timeline-event-timeline', require('components/TimelineEventTimeline.vue'));
  Vue.component('gv-timeline', require('components/Timeline.vue'));

  Vue.component('iconpicker', require('components/Iconpicker.vue'));

  window.app = new Vue(require('components/App.vue'));
})();
