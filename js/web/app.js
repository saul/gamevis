(function () {
  "use strict";

  var db = require('remote').require('./js/db');
  var models = require('remote').require('./js/models');

  const overviewData = {
    pos_x: -2400,
    pos_y: 3383,
    scale: 4.4,
    zoom: 1.1
  };

  var app = new Vue({
    el: '#app',
    data: {
      filters: [],
      events: []
    }
  });

  db.query(`SELECT DISTINCT name
FROM events
WHERE events.session_id = :sessionId
AND events.data ? 'user_entindex'
ORDER BY name`, {
      type: db.QueryTypes.SELECT,
      replacements: {sessionId: 1},
    })
    .then(results => {
      app.events = results.map(x => x.name);
      //$('#eventName').selectize();
    });

  var $canvas = $('canvas');
  var heatmap = createWebGLHeatmap({canvas: $canvas[0], intensityToAlpha: true});

  $('#eventForm').submit(e => {
    // perform the query
    var queryString = `SELECT *, ((
	SELECT entity_props.value
	FROM entity_props
	WHERE entity_props.index = (events.data->>'user_entindex')::int
	AND entity_props.tick <= events.tick
	AND entity_props.prop = 'DT_CSLocalPlayerExclusive.m_vecOrigin'
	AND entity_props.session_id = events.session_id
	ORDER BY entity_props.tick DESC
	LIMIT 1
)->>'value') AS position
FROM events
WHERE events.name = :event
AND events.session_id = :sessionId`;

    app.filters.forEach(filter => {
      queryString += `\nAND ((
	SELECT entity_props.value
	FROM entity_props
	WHERE entity_props.index = (events.data->>'user_entindex')::int
	AND entity_props.tick <= events.tick
	AND entity_props.prop = ${db.escape(filter.prop)}
	AND entity_props.session_id = events.session_id
	ORDER BY entity_props.tick DESC
	LIMIT 1
)->>'value')::text = ${db.escape(filter.value)}`;
    });

    var intensity = parseFloat($('#intensity').val());

    db.query(queryString, {
        type: db.QueryTypes.SELECT,
        replacements: {
          event: $('#eventName').val(),
          sessionId: $('#sessionId').val()
        }
      })
      .then(function (results) {
        heatmap.clear();

        var points = results.map(row => {
          var position = JSON.parse(row.position);
          var x = (position.x - overviewData.pos_x) / overviewData.scale;
          var y = (overviewData.pos_y - position.y) / overviewData.scale;

          const size = 30;

          return {x, y, size, intensity};
        });

        heatmap.addPoints(points);
      });

    return false;
  });

  var uid = 0;

  $('[data-action="addFilter"]').click(() => {
    app.filters.push({
      id: uid++,
      prop: '',
      constraint: '=',
      value: ''
    });
  });

  $(document).on('click', '[data-action="removeFilter"]', event => {
    var $target = $(event.target);
    var index = parseInt($target.closest('.filter').attr('data-index'));
    console.log('removing', index);

    app.filters.splice(index, 1);
  });

  function tick() {
    heatmap.update();
    heatmap.display();
    window.requestAnimationFrame(tick);
  }

  window.requestAnimationFrame(tick);
})();
