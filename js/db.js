var Sequelize = require('sequelize');

module.exports = new Sequelize('postgres://gamevis:gamevis@localhost:5432/gamevis', {
  maxConcurrentQueries: 100,
  native: true,
  define: {
    timestamps: false,
    underscored: true
  },
  pool: {maxConnections: 10, maxIdleTime: 30}
});
