'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rekap_kehadiran', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      karyawanId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Karyawan',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      tahun: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      bulan: {
        type: Sequelize.ENUM(
          'Januari',
          'Februari',
          'Maret',
          'April',
          'Mei',
          'Juni',
          'Juli',
          'Agustus',
          'September',
          'Oktober',
          'November',
          'Desember'
        ),
        allowNull: false
      },
      url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('rekap_kehadiran');
  }
};