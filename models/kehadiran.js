"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Kehadiran extends Model {
    static associate(models) {
      Kehadiran.belongsTo(models.Permintaan, {
        foreignKey: "permintaanId",
        as: "pesertamagang",
        onDelete: "CASCADE",
      });
    }
  }
  Kehadiran.init(
    {
      permintaanId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Permintaan",
          key: "id",
        },
      },

      totalKehadiran: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      bulan: {
        type: DataTypes.ENUM(
          "Januari",
          "Februari",
          "Maret",
          "April",
          "Mei",
          "Juni",
          "Juli",
          "Agustus",
          "September",
          "Oktober",
          "November",
          "Desember"
        ),
        allowNull: true,
      },
      tahun: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Kehadiran",
      tableName: "kehadiran",
      timestamps: true,
    }
  );
  return Kehadiran;
};
