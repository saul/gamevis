var Sequelize = require('sequelize');
var db = require('./db');

var Session = db.define('session', {
  level: {type: Sequelize.STRING, allowNull: false}
});

var Player = db.define('player', {
  tick: {type: Sequelize.INTEGER, allowNull: false},
  name: {type: Sequelize.STRING, allowNull: false},
  guid: {type: Sequelize.INTEGER, allowNull: false},
  data: {type: Sequelize.JSONB, allowNull: false}
});

Player.belongsTo(Session, {allowNull: false});

var Event = db.define('event', {
  tick: {type: Sequelize.INTEGER, allowNull: false},
  name: {type: Sequelize.STRING, allowNull: false},
  data: {type: Sequelize.JSONB, allowNull: false}
}, {
  indexes: [
    {
      fields: ['name', 'session_id']
    },
    {
      fields: ['data'],
      using: 'gin',
      operator: 'jsonb_ops'
    }
  ]
});

Event.belongsTo(Session, {allowNull: false});

var EntityProp = db.define('entity_prop', {
  index: {type: Sequelize.INTEGER, allowNull: false},
  tick: {type: Sequelize.INTEGER, allowNull: false},
  prop: {type: Sequelize.STRING, allowNull: false},
  value: {type: Sequelize.JSONB, allowNull: false}
}, {
  indexes: [
    {
      fields: ['index', 'prop', 'session_id']
    },
    {
      method: 'BTREE',
      fields: ['tick']
    },
    {
      fields: ['value'],
      using: 'gin',
      operator: 'jsonb_path_ops'
    }
  ]
});

EntityProp.belongsTo(Session, {allowNull: false});

module.exports = {
  Session,
  Event,
  EntityProp
};
