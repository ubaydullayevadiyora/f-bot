const { DataTypes } = require("sequelize");
const sequelize = require("../../index");
const User = require("./user");

const Expense = sequelize.define("Expense", {
    title: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL, allowNull: false },
    category: { type: DataTypes.STRING }
}, {
    tableName: "expenses",
    timestamps: true
});

// relation
User.hasMany(Expense, { foreignKey: "user_id" });
Expense.belongsTo(User, { foreignKey: "user_id" });

module.exports = Expense;
