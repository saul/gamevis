(function () {
  "use strict";

  const _ = require('lodash');
  const db = require('remote').require('./js/db');
  const models = require('remote').require('./js/models');

  let $canvas = null;
  let heatmap = null;

  const app = new Vue({
    el: '#app',
    data: {
      selectedSession: null,
      selectedEvent: null,
      selectedLocation: null,
      sessions: [],
      filters: [],
      events: [],
      querying: false,
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
          });
      },
      addFilter() {
        this.filters.push({
          id: Math.random(),
          target: null,
          prop: '',
          constraint: '=',
          value: ''
        });
      },
      removeFilter(event) {
        let $target = $(event.target);
        let index = parseInt($target.closest('.filter').attr('data-index'));

        this.filters.splice(index, 1);
      },
      updateVis() {
        // perform the query
        let queryString = `SELECT *, (events.locations ->> :location) AS position
      FROM events
      WHERE events.name = :event
      AND events.session_id = :sessionId
      AND events.locations ? :location`;

        this.filters.forEach(filter => {
          if (filter.target === '_event') {
            queryString += `\nAND events.data->>${db.escape(filter.prop)} = ${db.escape(filter.value)}`;
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
        )->>'value')::text = ${db.escape(filter.value)}`;
          }
        });

        let intensity = parseFloat($('#intensity').val());

        this.querying = true;

        console.log(' *** Query');

        heatmap.clear();
        console.time('query');

        db.query(queryString, {
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

            let points = results.map(row => {
              let position = JSON.parse(row.position);
              let x = (position.x - overviewData.pos_x) / overviewData.scale;
              let y = (overviewData.pos_y - position.y) / overviewData.scale;

              return {x, y, scale: overviewData.scale, intensity};
            });

            heatmap.addPoints(points);
            console.timeEnd('render');

            this.querying = false;
          });
      }
    },
    ready() {
      $canvas = $('canvas');
      heatmap = createWebGLHeatmap({canvas: $canvas[0], intensityToAlpha: true});

      this.$watch('selectedSession', () => {
        heatmap.clear();

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
          });

        $canvas.css('background-image', `url(overviews/${this.selectedSession.game}/${this.selectedSession.level}.png)`);
        $canvas.css('background-color', 'black');
      });
    }
  });

  window.app = app;
  app.refreshSessions();

  function tick() {
    heatmap.update();
    heatmap.display();
    window.requestAnimationFrame(tick);
  }

  window.requestAnimationFrame(tick);
})();
