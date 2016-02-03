(function () {
  "use strict";

  const _ = require('lodash');
  const Promise = require('bluebird');
  const fs = require('fs');
  const path = require('path');
  const assert = require('assert');

  const db = require('remote').require('./js/db');
  const models = require('remote').require('./js/models');

  // path to the gradient textures directory
  const GRADIENT_BASE = 'img/gradients';

  Vue.config.debug = true;

  Vue.component('vis-canvas', {
    template: '#visCanvas',
    props: ['heatmap', 'gradientPath'],
    ready() {
      this.heatmap = createWebGLHeatmap({
        canvas: this.$el,
        intensityToAlpha: true,
        gradientTexture: 'img/gradients/spectrum.png'
      });

      this.$watch('gradientPath', () => {
        let image = new Image();
        image.onload = () => {
          return this.heatmap.gradientTexture.bind().upload(image);
        };
        image.src = this.gradientPath;
      });
    }
  });

  Vue.component('vis-query-form', {
    template: '#queryForm',
    props: ['heatmap', 'enabled', 'gradientPath', 'gradientTextures', 'readyToVisualise'],
    replace: false,
    data: function () {
      return {
        selectedSession: null,
        selectedEvent: null,
        selectedLocation: null,
        sessions: [],
        filters: [],
        events: [],
        points: [],
        comparators: [
          {
            text: '=',
            sql: '=',
            cast: 'text'
          },
          {
            text: '&ne;',
            sql: '!=',
            cast: 'text'
          },
          {
            text: '&lt;',
            sql: '<',
            cast: 'int'
          },
          {
            text: '&le;',
            sql: '<=',
            cast: 'int'
          },
          {
            text: '&gt;',
            sql: '>',
            cast: 'int'
          },
          {
            text: '&ge;',
            sql: '>=',
            cast: 'int'
          }
        ]
      };
    },
    computed: {
      readyToVisualise() {
        return this.selectedSession && this.selectedEvent && this.selectedLocation && this.gradientPath;
      }
    },
    ready() {
      this.$watch('selectedSession', () => {
        this.points = [];
        this.events = [];

        db.query(`SELECT DISTINCT ON (name) name, locations, entities
FROM events
WHERE events.session_id = :sessionId
AND events.locations IS NOT NULL
ORDER BY name`, {
            type: db.QueryTypes.SELECT,
            replacements: {sessionId: this.selectedSession.id}
          })
          .then(results => {
            this.events = results.map(row => {
              return {
                name: row.name,
                locations: _.keys(row.locations),
                entities: _.keys(row.entities)
              }
            });

            console.log('Got events:', this.events);
          })
          .catch(err => this.$dispatch('error', err));

        this.$dispatch('updateBackdrop', this.selectedSession);
      });

      this.$watch('points', () => {
        if (this.heatmap == null) {
          console.warn('no heatmap to update');
          return;
        }
        this.heatmap.clear();
        this.heatmap.addPoints(this.points);
      });

      this.refreshSessions();
    },
    methods: {
      refreshSessions() {
        models.Session.findAll({
            attributes: ['id', 'level', 'title', 'game'],
            order: [['id', 'DESC']]
          })
          .then(sessions => {
            this.sessions = sessions.map(x => _.toPlainObject(x.get({plain: true})));
            console.log('Got sessions:', this.sessions);
          })
          .catch(err => this.$dispatch('error', err));
      },
      addFilter() {
        this.filters.push({
          id: Math.random(),
          target: null,
          prop: '',
          comparator: null,
          value: ''
        });
      },
      removeFilter(index) {
        this.filters.splice(index, 1);
      },
      getResults(intensity) {
        let queryString = `SELECT *, (events.locations ->> :location) AS position
          FROM events
          WHERE events.name = :event
          AND events.session_id = :sessionId
          AND events.locations ? :location`;

        this.filters.forEach(filter => {
          if (filter.target === '_event') {
            queryString += `\nAND (events.data->>${db.escape(filter.prop)})::${filter.comparator.cast} ${filter.comparator.sql} ${db.escape(filter.value)}`;
          } else {
            queryString += `\nAND ((
              SELECT entity_props.value
              FROM entity_props
              WHERE entity_props.index = (events.entities->>${db.escape(filter.target)})::int
              AND entity_props.tick <= events.tick
              AND entity_props.prop = ${db.escape(filter.prop)}
              AND entity_props.session_id = events.session_id
              ORDER BY entity_props.tick DESC
              LIMIT 1
            )->>'value')::${filter.comparator.cast} ${filter.comparator.sql} ${db.escape(filter.value)}`;
          }
        });

        console.log(' *** Query');

        this.points = [];
        console.time('query');

        return db.query(queryString, {
            type: db.QueryTypes.SELECT,
            replacements: {
              event: this.selectedEvent.name,
              sessionId: this.selectedSession.id,
              location: this.selectedLocation
            }
          })
          .then(results => {
            console.timeEnd('query');

            console.log('Query returned %d rows', results.length);

            let overviewData = require(`./overviews/${this.selectedSession.game}/${this.selectedSession.level}.json`);

            console.time('render');

            this.points = results.map(row => {
              let position = JSON.parse(row.position);
              let x = (position.x - overviewData.pos_x) / overviewData.scale;
              let y = (overviewData.pos_y - position.y) / overviewData.scale;

              return {x, y, scale: overviewData.scale, intensity};
            });

            console.timeEnd('render');
          })
          .catch(err => this.$dispatch('error', err));
      },
    }
  });

  const app = new Vue({
    el: '#app',
    data: {
      queries: [],
      alerts: [],
      intensity: 0.5,
      querying: false,
      gradientTextures: []
    },
    computed: {
      readyToVisualise() {
        return this.queries.reduce((memo, q) => memo && q.readyToVisualise, true);
      }
    },
    methods: {
      onError(error) {
        this.alerts.push({
          className: 'danger',
          headline: error.name,
          text: error.message
        })
      },
      dismissAlert(index) {
        this.alerts.splice(index, 1);
      },
      visualise() {
        if (!this.readyToVisualise) {
          return this.alerts.push({
            className: 'warning',
            headline: 'All inputs must be complete to visualise'
          });
        }

        this.querying = true;

        Promise.map(
          this.$refs.query,
          q => q.getResults(this.intensity)
        ).finally(() => {
          this.querying = false;
        });
      },
      addQuery() {
        let i = this.queries.push({
          id: Math.random(),
          selected: false,
          heatmap: null,
          gradientPath: null,
          readyToVisualise: false
        });

        this.switchQueryTab(i - 1);
      },
      closeQuery(index) {
        console.log('closeQuery', index);

        // find index of the selected tab
        let selectedIndex = this.queries.findIndex(q => q.selected);

        this.queries.splice(index, 1);

        let closedSelected = index == selectedIndex;

        // no choice if there's no tabs remaining or only 1 left
        if (this.queries.length === 0) {
          return this.addQuery();
        }
        if (this.queries.length === 1) {
          return this.switchQueryTab(0);
        }

        // if the tab was selected upon closing, switch to the tab to the left
        if (closedSelected) {
          return this.switchQueryTab(Math.min(index, this.queries.length - 1));
        }

        if (index > selectedIndex) {
          return this.switchQueryTab(index - 1);
        }
      },
      switchQueryTab(index) {
        console.log('switchQueryTab', index);
        this.queries.forEach((q, i) => {
          q.selected = i == index
        });
      },
      tick() {
        window.requestAnimationFrame(this.tick.bind(this));

        this.queries.filter(q => q.heatmap)
          .forEach(q => {
            q.heatmap.update();
            q.heatmap.display();
          });
      },
      updateGradients(err, files) {
        assert.ifError(err);
        this.gradientTextures = files.filter(name => !name.startsWith('.'))
          .map(file => {
            return {
              path: path.join(GRADIENT_BASE, file),
              baseName: path.parse(file).name
            }
          });
      }
    },
    events: {
      error(err) {
        this.onError(err);
      },
      updateBackdrop(session) {
        $(this.$els.canvasBackdrop)
          .css('background-image', `url(overviews/${session.game}/${session.level}.png)`)
          .css('background-color', 'black');
      }
    },
    ready() {
      this.addQuery();
      this.tick();

      fs.readdir(GRADIENT_BASE, this.updateGradients.bind(this));
    }
  });

  window.app = app;
})();
