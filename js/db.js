'use strict';

var Sequelize = require('sequelize');
const config = require('../config.json');

let options = {
  maxConcurrentQueries: 100,
  native: false,
  define: {
    timestamps: false,
    underscored: true
  },
  pool: {maxConnections: 10, maxIdleTime: 30}
};

try {
  options.native = !!require('pg-native');
} catch (err) {
  // if pg-native can't be found, use the non-native version
}

module.exports = new Sequelize(config.connectionString, options);
