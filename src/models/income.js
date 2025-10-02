const { DataTypes } = require("sequelize");
const sequelize = require("../../index");
const User = require("./user");

const Income = sequelize.define("Income", {
    source: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL, allowNull: false },
}, {
    tableName: "incomes",
    timestamps: true
});

// relation
User.hasMany(Income, { foreignKey: "user_id" });
Income.belongsTo(User, { foreignKey: "user_id" });

module.exports = Income;
