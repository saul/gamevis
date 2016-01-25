'use strict';

var fs = require('fs');
var assert = require('assert');

var demofile = require('demofile');
var pace = require('pace');
var _ = require('lodash');
var async = require('async');
var Promise = require('bluebird');
var pg = require('pg');
var copyFrom = require('pg-copy-streams').from;

var db = require('../../js/db.js');
var models = require('../../js/models.js');

function importDemoBuffer(client, buffer, session, callback) {
  var demo = new demofile.DemoFile();
  var pace;
  var players = new Array(256);
  const ENTITY_UPDATE_TIME_INTERVAL = 0.2; // number of seconds between flushing entity updates
  var tickInterval;
  var lastEntityUpdateFlushTick = 0;
  var bufferedEntityUpdates = new Map();

  // Skip uninteresting properties that change often
  var skipProps = ['m_flSimulationTime', 'm_nTickBase', 'm_flGroundAccelLinearFracLastTime', 'm_nResetEventsParity', 'm_nNewSequenceParity', 'm_nAnimationParity'];

  var eventStream = client.query(copyFrom('COPY events (session_id, tick, name, data) FROM STDIN'));

  var tempDeferredFilename = 'deferred_' + Math.random() + '.tmp';
  var entityPropStream = fs.createWriteStream(tempDeferredFilename);

  function entityIndexOfUserId(userId) {
    var index = players.findIndex(player => player && player.userId === userId);

    // entity index is player slot + 1
    if (index >= 0) {
      return index + 1;
    }
  }

  function flushAccumulatedEntityUpdates() {
    for (var update of bufferedEntityUpdates.values()) {
      writeRow(entityPropStream, update);
    }

    bufferedEntityUpdates.clear();
    lastEntityUpdateFlushTick = demo.currentTick;
  }

  function writeRow(stream, values) {
    var row = values.map(val => {
      switch (typeof val) {
        case 'object':
          return JSON.stringify(val);
        case 'string':
        case 'number':
          return val;
        default:
          throw 'Cannot serialise value';
      }
    }).join('\t');

    stream.write(row + '\n');
  }

  demo.on('start', () => {
    console.log(demo.header);
    pace = require('pace')({total: demo.header.playbackTicks, maxBurden: 0.1});

    // Calculate the amount of time between ticks
    tickInterval = demo.header.playbackTime / demo.header.playbackTicks;
  });

  demo.on('tickend', tick => {
    pace.op(tick);

    if ((demo.currentTick - lastEntityUpdateFlushTick) * tickInterval > ENTITY_UPDATE_TIME_INTERVAL) {
      flushAccumulatedEntityUpdates();
    }
  });

  demo.on('end', () => {
    console.log('Closing streams...');

    Promise.all([
        Promise.promisify(eventStream.end, {context: eventStream})(),
        Promise.promisify(entityPropStream.end, {context: entityPropStream})()
      ])
      .then(() => {
        console.log('Copying entity property data to database...');

        return Promise.promisify(done => {
          var stream = client.query(copyFrom('COPY entity_props (session_id, index, tick, prop, value) FROM STDIN'));
          var fileStream = fs.createReadStream(tempDeferredFilename);

          fileStream.on('error', done);

          fileStream.pipe(stream)
            .on('finish', () => {
              console.log('Copied.');
              fs.unlink(tempDeferredFilename, done);
            })
            .on('error', done);
        })();
      })
      .then(() => {
        console.log('All streams closed.');
        callback(null);
      });
  });

  demo.entities.on('change', e => {
    if (skipProps.indexOf(e.varName) !== -1) {
      return;
    }

    var fullPropName = `${e.tableName}.${e.varName}`;

    bufferedEntityUpdates.set([e.entity.index, fullPropName], [
      session.id,
      e.entity.index,
      demo.currentTick,
      fullPropName,
      {value: e.newValue}
    ]);
  });

  demo.gameEvents.on('event', e => {
    _.forOwn(e.event, (value, key) => {
      if (key.endsWith('id')) {
        key = key.slice(0, key.length - 2);
      }

      if (key === 'victim' || key === 'player') {
        assert(e.data.userid === undefined, 'userid specified twice in same event');
        key = 'user';
      }

      if (['user', 'attacker', 'assister'].indexOf(key) === -1) {
        return;
      }

      e.event[`${key}_entindex`] = entityIndexOfUserId(value);
    });

    writeRow(eventStream, [
      session.id,
      demo.currentTick,
      e.name,
      e.event
    ]);
  });

  demo.stringTables.on('update', e => {
    if (e.table.name !== 'userinfo' || e.userData == null) {
      return;
    }

    players[e.entryIndex] = e.userData;
  });

  console.log('Parsing buffer...');
  demo.parse(buffer);
}

function importDemoFile(path) {
  console.log('Connecting to database...');
  var client = new pg.Client('postgres://gamevis:gamevis@localhost:5432/gamevis');

  return Promise.all([
      Promise.promisify(client.connect, {context: client})(),
      Promise.promisify(fs.readFile)(path)
    ])

    // Parse the demo header in and create a session
    .then(fulfilled => {
      var buffer = fulfilled[1];
      var header = demofile.parseHeader(buffer);

      console.log('Creating session...');
      return [...fulfilled, models.Session.create({level: header.mapName})];
    })

    // Import the buffer into the session
    .spread((client, buffer, session) => {
      return Promise.promisify(importDemoBuffer)(client, buffer, session)
        .then(() => {
          client.end();
          pg.end();
        });
    });
}

console.log('Synchronising database...');

db.sync()
  .then(() => {
    return importDemoFile(process.argv[2]);
  })
  .then(() => {
    console.log('Complete :)');
  });
