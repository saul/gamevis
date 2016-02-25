var Sequelize = require('sequelize');
const config = require('../config.json');

module.exports = new Sequelize(config.connectionString, {
  maxConcurrentQueries: 100,
  native: true,
  define: {
    timestamps: false,
    underscored: true
  },
  pool: {maxConnections: 10, maxIdleTime: 30}
});
