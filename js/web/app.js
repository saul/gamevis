(function () {
  "use strict";

  var _ = require('lodash');
  var Promise = require('bluebird');
  var db = require('remote').require('./js/db');
  var models = require('remote').require('./js/models');

  var app = new Vue({
    el: '#app',
    data: {
      selectedSession: null,
      selectedEvent: null,
      selectedLocation: null,
      sessions: [],
      filters: [],
      events: [],
      querying: false
    },
    methods: {
      refreshSessions: function () {
        models.Session.findAll({
            attributes: ['id', 'level', 'title', 'game'],
            order: [['id', 'DESC']]
          })
          .then(sessions => {
            this.sessions = sessions.map(x => _.toPlainObject(x.get({plain: true})));
            console.log('Got sessions:', this.sessions);
          });
      }
    }
  });

  window.app = app;

  app.refreshSessions();

  var $canvas = $('canvas');
  var heatmap = createWebGLHeatmap({canvas: $canvas[0], intensityToAlpha: true});

  $('#sessionId').change(() => {
    heatmap.clear();

    db.query(`SELECT DISTINCT ON (name) name, locations, entities
FROM events
WHERE events.session_id = :sessionId
AND events.locations IS NOT NULL
ORDER BY name`, {
        type: db.QueryTypes.SELECT,
        replacements: {sessionId: app.selectedSession.id}
      })
      .then(results => {
        app.events = results.map(row => {
          return {
            name: row.name,
            locations: _.keys(row.locations),
            entities: _.keys(row.entities)
          }
        });

        console.log('Got events:', app.events);
      });

    $canvas.css('background-image', `url(overviews/${app.selectedSession.game}/${app.selectedSession.level}.png)`);
    $canvas.css('background-color', 'black');
  });

  $('#eventForm').submit(e => {
    // perform the query
    var queryString = `SELECT *, (events.locations ->> :location) AS position
      FROM events
      WHERE events.name = :event
      AND events.session_id = :sessionId
      AND events.locations ? :location`;

    app.filters.forEach(filter => {
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

    var intensity = parseFloat($('#intensity').val());

    app.querying = true;

    console.log(' *** Query');

    heatmap.clear();
    console.time('query');

    db.query(queryString, {
        type: db.QueryTypes.SELECT,
        replacements: {
          event: app.selectedEvent.name,
          sessionId: app.selectedSession.id,
          location: app.selectedLocation
        }
      })
      .then(results => {
        console.timeEnd('query');

        console.log('Query returned %d rows', results.length);

        var overviewData = require(`./overviews/${app.selectedSession.game}/${app.selectedSession.level}.json`);

        console.time('render');

        var points = results.map(row => {
          var position = JSON.parse(row.position);
          var x = (position.x - overviewData.pos_x) / overviewData.scale;
          var y = (overviewData.pos_y - position.y) / overviewData.scale;

          return {x, y, scale: overviewData.scale, intensity};
        });

        heatmap.addPoints(points);
        console.timeEnd('render');

        app.querying = false;
      });

    return false;
  });

  var uid = 0;

  $('[data-action="addFilter"]').click(() => {
    app.filters.push({
      id: uid++,
      target: null,
      prop: '',
      constraint: '=',
      value: ''
    });
  });

  $(document).on('click', '[data-action="removeFilter"]', event => {
    var $target = $(event.target);
    var index = parseInt($target.closest('.filter').attr('data-index'));

    app.filters.splice(index, 1);
  });

  function tick() {
    heatmap.update();
    heatmap.display();
    window.requestAnimationFrame(tick);
  }

  window.requestAnimationFrame(tick);
})();
