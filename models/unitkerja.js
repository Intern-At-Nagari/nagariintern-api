'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UnitKerja extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      UnitKerja.hasMany(models.Permintaan, { 
        foreignKey: 'unitKerjaId',
        as: 'PermintaanPengajuan'  // Alias untuk permintaan sebagai unit kerja yang diajukan
      });
      UnitKerja.hasMany(models.Permintaan, { 
        foreignKey: 'penempatan',
        as: 'PermintaanPenempatan'  // Alias untuk permintaan sebagai unit kerja penempatan
      });
      UnitKerja.hasMany(models.Karyawan, { foreignKey: 'unitKerjaId' });
    }
  }
  UnitKerja.init({
    name: {
      type : DataTypes.STRING,
      allowNull: false,
    },
    kuotaMhs: {
      type : DataTypes.INTEGER,
      allowNull: true,
    },
    kuotaSiswa: {
      type : DataTypes.INTEGER,
      allowNull: true,
    },
    tipe_cabang: {
      type : DataTypes.ENUM('pusat', 'utama', 'a', 'b', 'c'),
      allowNull : true
    },
  }, {
    sequelize,
    modelName: 'UnitKerja',
    tableName : 'unit_kerja',
    timestamps: true,
  });
  return UnitKerja;
};