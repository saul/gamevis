/**
 * Command-line module that imports CSGO demo files into Gamevis.
 *
 * @module importers/csgo/import
 */

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
var XXHash = require('xxhash');
var config = require('../../config.json');

var db = require('../../js/db.js');
var models = require('../../js/models.js');

/**
 * Imports a demofile buffer into the database.
 * @param {PgClient} client
 * @param {Buffer} buffer - Demo file buffer
 * @param {number} session_id - New session ID
 * @param callback
 */
function importDemoBuffer(client, buffer, session_id, callback) {
  var demo = new demofile.DemoFile();
  var pace;
  var players = new Array(256);
  const ENTITY_UPDATE_TIME_INTERVAL = 0.2; // number of seconds between flushing entity updates
  var tickInterval;
  var lastEntityUpdateFlushTick = 0;
  var bufferedEntityUpdates = new Map();
  var entityPositions = {};

  // Skip uninteresting properties that change often
  var skipProps = ['m_flSimulationTime', 'm_nTickBase', 'm_flGroundAccelLinearFracLastTime', 'm_nResetEventsParity', 'm_nNewSequenceParity', 'm_nAnimationParity'];

  var eventStream = client.query(copyFrom("COPY events (session_id, tick, name, data, locations, entities) FROM STDIN WITH NULL 'null'"));

  var tempDeferredFilename = 'deferred_' + Math.random() + '.tmp';
  var entityPropStream = fs.createWriteStream(tempDeferredFilename);

  /**
   * Find the entity index of a user ID
   * @param {number} userId
   * @returns {number} entity index
   */
  function entityIndexOfUserId(userId) {
    var index = players.findIndex(player => player && player.userId === userId);

    // entity index is player slot + 1
    if (index >= 0) {
      return index + 1;
    }
  }

  /**
   * Writes all accumulated entity updates to the entity_props stream.
   */
  function flushAccumulatedEntityUpdates() {
    for (var update of bufferedEntityUpdates.values()) {
      writeRow(entityPropStream, update);
    }

    bufferedEntityUpdates.clear();
    lastEntityUpdateFlushTick = demo.currentTick;
  }

  /**
   * Write an array of values to a stream as TSV
   * @param {Writable} stream
   * @param {Array.<*>} values
   */
  function writeRow(stream, values) {
    var row = values.map(val => {
      switch (typeof val) {
        case 'object':
          return JSON.stringify(val);
        case 'string':
        case 'number':
          return val;
        default:
          throw Error(`Cannot serialise value of type ${typeof val}`);
      }
    }).join('\t');

    stream.write(row + '\n');
  }

  demo.on('start', () => {
    console.log('Parsed header:');
    console.log(demo.header);

    // Calculate the amount of time between ticks
    tickInterval = demo.header.playbackTime / demo.header.playbackTicks;
    console.log('Tick interval:', tickInterval, ', Tick rate:', Math.round(1 / tickInterval));

    pace = require('pace')({total: demo.header.playbackTicks, maxBurden: 0.1});
  });

  demo.on('tickend', tick => {
    pace.op(tick);

    // if we've moved back in time, or the interval has elapsed, flush entity updates
    if ((demo.currentTick - lastEntityUpdateFlushTick) * tickInterval > ENTITY_UPDATE_TIME_INTERVAL || demo.currentTick < lastEntityUpdateFlushTick) {
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
          var stream = client.query(copyFrom("COPY entity_props (session_id, index, tick, prop, value) FROM STDIN WITH NULL 'null'"));
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
      })
      .catch(callback);
  });

  /**
   * Convert and cell and cell normal to a world-space coordinate.
   * @param {number} cell
   * @param {number} f
   * @returns {number} world-space coordinate
   */
  function coordFromCell(cell, f) {
    const CELL_BITS = 5;
    const MAX_COORD_INTEGER = 16384;

    return ((cell * (1 << CELL_BITS)) - MAX_COORD_INTEGER) + f;
  }

  demo.entities.on('change', e => {
    if (skipProps.indexOf(e.varName) !== -1) {
      return;
    }

    assert(e.newValue != null);

    var fullPropName = `${e.tableName}.${e.varName}`;
    var newValue = e.newValue;

    if (['DT_BaseEntity.m_vecOrigin', 'DT_BaseEntity.m_cellX', 'DT_BaseEntity.m_cellY', 'DT_BaseEntity.m_cellZ'].indexOf(fullPropName) !== -1) {
      fullPropName = 'position';

      var cellX = e.entity.getProp('DT_BaseEntity', 'm_cellX');
      var cellY = e.entity.getProp('DT_BaseEntity', 'm_cellY');
      var cellZ = e.entity.getProp('DT_BaseEntity', 'm_cellZ');
      var cellPos = e.entity.getProp('DT_BaseEntity', 'm_vecOrigin');

      if([cellX, cellY, cellZ, cellPos].indexOf(undefined) !== -1) {
        return;
      }

      newValue = {
        x: coordFromCell(cellX, cellPos.x),
        y: coordFromCell(cellY, cellPos.y),
        z: coordFromCell(cellZ, cellPos.z)
      };

      entityPositions[e.entity.index] = newValue;
    } else if (fullPropName === 'DT_CSLocalPlayerExclusive.m_vecOrigin') {
      fullPropName = 'position';

      var z = e.entity.getProp('DT_CSLocalPlayerExclusive', 'm_vecOrigin[2]');
      if (z == null) {
        return;
      }

      newValue = {
        x: e.newValue.x,
        y: e.newValue.y,
        z
      };

      entityPositions[e.entity.index] = newValue;
    } else if (fullPropName === 'DT_CSLocalPlayerExclusive.m_vecOrigin[2]') {
      fullPropName = 'position';

      var xyPos = e.entity.getProp('DT_CSLocalPlayerExclusive', 'm_vecOrigin');
      if (xyPos == null) {
        return;
      }

      newValue = {
        x: xyPos.x,
        y: xyPos.y,
        z: e.newValue
      };

      entityPositions[e.entity.index] = newValue;
    }

    var updateHash = XXHash.hash(new Buffer(e.entity.index + fullPropName), 0xCAFEBABE);

    bufferedEntityUpdates.set(updateHash, [
      session_id,
      e.entity.index,
      demo.currentTick,
      fullPropName,
      {value: newValue}
    ]);
  });

  demo.gameEvents.on('event', e => {
    var entities = {};
    var locations = {};
    var anyEntities = false;

    function addEntity(key, index) {
      assert(entities[key] === undefined, 'entity multiply defined for event');

      if (index === undefined) {
        console.log('unknown entity index for key:', key, 'on', e.name);
        return;
      }

      entities[key] = index;
      locations[key] = entityPositions[index];

      anyEntities = true;
    }

    _.forOwn(e.event, (value, key) => {
      if (value <= 0) {
        return;
      }

      // `player` without the `id` suffix refers to an entity index
      if (key === 'player') {
        addEntity('player', value);
        return;
      }

      // add entities directly
      if (key === 'entindex' || key === 'index' || key === 'entityid') {
        addEntity('entity', value);
        return;
      }

      // strip `id` suffix
      if (key.endsWith('id')) {
        key = key.slice(0, key.length - 2);
      }

      if (key === 'victim' || key === 'user') {
        key = 'player';
      }

      else if (['player', 'attacker', 'assister'].indexOf(key) === -1) {
        return;
      }

      addEntity(key, entityIndexOfUserId(value));
    });

    writeRow(eventStream, [
      session_id,
      demo.currentTick,
      e.name,
      e.event,
      anyEntities ? locations : null,
      anyEntities ? entities : null
    ]);

    // if this event referenced any entities, flush all accumulated updates
    // TODO: we should only flush updates for affected entities
    if (anyEntities) {
      flushAccumulatedEntityUpdates();
    }
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

/**
 * Imports a CSGO demo file into the database.
 * @param {string} path - Path to demo file
 * @returns {Promise}
 */
function importDemoFile(path) {
  console.log('Connecting to database...');
  var client = new pg.Client(config.connectionString);

  var query = Promise.promisify(client.query, {context: client});

  return Promise.all([
      Promise.promisify(client.connect, {context: client})(),
      Promise.promisify(fs.readFile)(path)
    ])

    .then(fulfilled => {
      console.log('Starting transaction...');

      return [
        ...fulfilled,
        query('BEGIN')
      ];
    })

    // Parse the demo header in and create a session
    .then(fulfilled => {
      var buffer = fulfilled[1];
      var header = demofile.parseHeader(buffer);

      console.log('Creating session...');

      return [
        ...fulfilled,
        query('INSERT INTO sessions (title, level, game, data, tickrate) VALUES ($1, $2, $3, $4, $5) RETURNING id', [
          header.serverName,
          header.mapName,
          header.gameDirectory,
          JSON.stringify({header}),
          Math.round(header.playbackTicks / header.playbackTime)
        ])
      ];
    })

    // Import the buffer into the session
    .spread((client, buffer, _, session) => {
      var session_id = session.rows[0].id;
      console.log('Importing session to %d', session_id);

      return Promise.promisify(importDemoBuffer)(client, buffer, session_id);
    })

    .then(() => {
      console.log('Committing transaction...');
      return query('COMMIT');
    })

    .catch(e => {
      console.error(e.stack);

      console.log('ERROR!! Rolling back...');
      return query('ROLLBACK');
    })

    .then(() => {
      console.log('Closing connection...');
      client.end();
      pg.end();
    });
}

console.log('Synchronising database...');

db.sync()
  .then(() => {
    return importDemoFile(process.argv[2]);
  })
  .then(() => {
    console.log('The end.');
  });
