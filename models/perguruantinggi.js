'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PerguruanTinggi extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      PerguruanTinggi.hasMany(models.Permintaan , { foreignKey : 'ptId'  });
    }
  }
  PerguruanTinggi.init({
    name: {
      type : DataTypes.STRING,
      allowNull: false,
    }
  }, {
    sequelize,
    modelName: 'PerguruanTinggi',
    tableName : 'perguruan_tinggi',
    timestamps: false, 
  });
  return PerguruanTinggi;
};