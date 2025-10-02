const { DataTypes } = require("sequelize");
const sequelize = require("../../index");

const User = sequelize.define("User", {
    telegram_id: { type: DataTypes.BIGINT, unique: true },
    firstname: { type: DataTypes.STRING },
    lastname: { type: DataTypes.STRING },
    username: { type: DataTypes.STRING }
}, {
    tableName: "users",
    timestamps: true
});

module.exports = User;
