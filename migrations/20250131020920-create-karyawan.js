'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('karyawan', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nama: {
        type: Sequelize.STRING,
        allowNull: true
      },
      nik: {
        type: Sequelize.STRING,
        allowNull: true
      },
      nomorHp: {
        type: Sequelize.STRING,
        allowNull: true
      },
      jabatan: {
        type: Sequelize.STRING,
        allowNull: true
      },
      unitKerjaId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        reference: {
          model: 'unit_kerja',
          key: 'id'
        }
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        reference: {
          model: 'users',
          key: 'id'
        }
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
    await queryInterface.dropTable('karyawan');
  }
};