'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('permintaan', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      type: {
        type: Sequelize.ENUM('mahasiswa', 'siswa'),
        allowNull: false
      },
      ptId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'perguruan_tinggi',
          key: 'id'
        }
      },
      prodiId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'prodi',
          key: 'id'
        }
      },
      smkId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'smk',
          key: 'id'
        }
      },
      jurusanId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'jurusan',
          key: 'id'
        }
      },
      tanggalMulai: {
        type: Sequelize.DATE,
        allowNull: false
      },
      tanggalSelesai: {
        type: Sequelize.DATE,
        allowNull: false
      },
      unitKerjaId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'unit_kerja',
          key: 'id'
        }
      },
      statusId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'status',
          key: 'id'
        }
      },
      statusState:{
        type : Sequelize.ENUM('completed', 'rejected', 'reject'),
        allowNull: false,
        defaultValue: 'completed'
      },
      penempatan: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'unit_kerja',
          key: 'id'
        }
      },
      keterangan: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      jadwalId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'jadwal',
          key: 'id'
        }
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('permintaan');
  }
};