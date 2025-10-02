const { Bot, Keyboard } = require("grammy");
const Expense = require("../models/expense");
const Income = require("../models/income");
const User = require("../models/user");
const config = require("config");
const { Op } = require("sequelize");
const sequelize = require("../../index");

const bot = new Bot(config.get("bot.token"));

// memory session (users event)
const incomeFlows = {};
const expenseFlows = {};

(async () => {
    try {
        await sequelize.sync();
        console.log("Database connected.");
        bot.start();
        console.log("Bot is running...");
    } catch (err) {
        console.error("DB connection error:", err);
    }
})();

const mainKeyboard = new Keyboard()
    .text("Balans").row()
    .text("Daromad qo'shish").row()
    .text("Xarajat qo'shish").row()
    .text("Hisobot");

// START COMMAND
bot.command("start", async (ctx) => {
    const telegram_id = ctx.from.id;
    const username = ctx.from.username || "";
    const firstname = ctx.from.first_name || "";
    const lastname = ctx.from.last_name || "";

    await User.findOrCreate({
        where: { telegram_id },
        defaults: { username, firstname, lastname },
    });

    await ctx.reply(
        `Salom! Men sizning daromad va xarajatlaringizni boshqarishda yordam beraman. Pastdagi tugmalar orqali botdan foydalanishingiz mumkin.`,
        { reply_markup: mainKeyboard }
    );
});

// BALANS
bot.hears("Balans", async (ctx) => {
    const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
    if (!user) return ctx.reply("Avval /start buyrug'ini bosing.");

    const incomes = (await Income.sum("amount", { where: { user_id: user.id } })) || 0;
    const expenses = (await Expense.sum("amount", { where: { user_id: user.id } })) || 0;
    const balance = incomes - expenses;

    await ctx.reply(
        `Umumiy balans: ${balance.toLocaleString('uz-UZ')} so'm\n` +
        `Daromad: ${incomes.toLocaleString('uz-UZ')}\n` +
        `Xarajat: ${expenses.toLocaleString('uz-UZ')} so'm`
    );
});

// DAROMAD QO'SHISH
bot.hears("Daromad qo'shish", async (ctx) => {
    const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
    if (!user) return ctx.reply("Avval /start buyrug'ini bosing.");

    incomeFlows[ctx.from.id] = { step: "source" };
    await ctx.reply("Daromad manbasini kiriting:");
});

// XARAJAT QO'SHISH
bot.hears("Xarajat qo'shish", async (ctx) => {
    const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
    if (!user) return ctx.reply("Avval /start buyrug'ini bosing.");

    expenseFlows[ctx.from.id] = { step: "title" };
    await ctx.reply("Xarajat nomini kiriting:");
});

// HISOBOT
bot.hears("Hisobot", async (ctx) => {
    const reportKeyboard = new Keyboard()
        .text("Joriy hafta").text("Avvalgi hafta").row()
        .text("Joriy oy").text("Avvalgi oy").row()
        .text("Back to Main Menu"); // asosiy menyuga qaytish tugmasi

    await ctx.reply("Qaysi davr hisobotini ko'rmoqchisiz?", { reply_markup: reportKeyboard });
});

// REPORT LOGIC
bot.hears(/Joriy hafta|Avvalgi hafta|Joriy oy|Avvalgi oy/, async (ctx) => {
    const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
    if (!user) return ctx.reply("Avval /start buyrug'ini bosing.");

    const now = new Date();
    let startDate, endDate = now;

    switch (ctx.message.text) {
        case "Joriy hafta":
            startDate = new Date(); startDate.setDate(now.getDate() - 7);
            break;
        case "Avvalgi hafta":
            startDate = new Date(); startDate.setDate(now.getDate() - 14);
            endDate = new Date(); endDate.setDate(now.getDate() - 7);
            break;
        case "Joriy oy":
            startDate = new Date(); startDate.setDate(now.getDate() - 30);
            break;
        case "Avvalgi oy":
            startDate = new Date(); startDate.setMonth(now.getMonth() - 1);
            endDate = new Date(); endDate.setDate(now.getDate() - 30);
            break;
    }

    const totalIncome = parseFloat(await Income.sum("amount", {
        where: { user_id: user.id, createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } }
    })) || 0;

    const totalExpense = parseFloat(await Expense.sum("amount", {
        where: { user_id: user.id, createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } }
    })) || 0;

    await ctx.reply(
        `📊 Hisobot (${ctx.message.text}):\n` +
        `💰 Daromad: ${totalIncome.toLocaleString('uz-UZ')} so'm\n` +
        `💸 Xarajat: ${totalExpense.toLocaleString('uz-UZ')} so'm\n` +
        `🟢 Sof balans: ${(totalIncome - totalExpense).toLocaleString('uz-UZ')} so'm`,
        { reply_markup: mainKeyboard } // hisobotdan keyin asosiy menyuga qaytadi
    );
});

// Back to Main Menu button handler
bot.hears("Back to Main Menu", async (ctx) => {
    await ctx.reply("Asosiy menyu:", { reply_markup: mainKeyboard });
});

// SUM VALIDATION
const parseUZS = (text) => {
    const num = parseFloat(text.replace(/,/g, '.').replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num <= 0) return null;
    return num;
};

// INCOME & EXPENSE MESSAGE FLOW
bot.on("message", async (ctx) => {
    const userId = ctx.from.id;
    const user = await User.findOne({ where: { telegram_id: userId } });
    if (!user) return;

    // Daromad qo'shish flow
    if (incomeFlows[userId]) {
        const flow = incomeFlows[userId];
        if (flow.step === "source") {
            flow.source = ctx.message.text;
            flow.step = "amount";
            return ctx.reply("Summani O'zbek so'mida kiriting (masalan: 100000):");
        }
        if (flow.step === "amount") {
            const amount = parseUZS(ctx.message.text);
            if (amount === null) return ctx.reply("Iltimos, faqat musbat raqam kiriting.");
            await Income.create({ user_id: user.id, source: flow.source, amount });
            delete incomeFlows[userId];
            return ctx.reply(`Daromad qo'shildi!\nManba: ${flow.source}\nSumma: ${amount.toLocaleString('uz-UZ')} so'm`);
        }
    }

    // Xarajat qo'shish flow
    if (expenseFlows[userId]) {
        const flow = expenseFlows[userId];
        if (flow.step === "title") {
            flow.title = ctx.message.text;
            flow.step = "amount";
            return ctx.reply("Xarajat summasini O'zbek so'mida kiriting (masalan: 100000):");
        }
        if (flow.step === "amount") {
            const amount = parseUZS(ctx.message.text);
            if (amount === null) return ctx.reply("Iltimos, faqat musbat raqam kiriting.");
            flow.amount = amount;
            flow.step = "category";
            return ctx.reply("Kategoriyani kiriting (masalan: oziq-ovqat, transport, ko'ngilochar):");
        }
        if (flow.step === "category") {
            const category = ctx.message.text;
            await Expense.create({ user_id: user.id, title: flow.title, amount: flow.amount, category });
            delete expenseFlows[userId];
            return ctx.reply(`Xarajat qo'shildi!\nNomi: ${flow.title}\nSumma: ${flow.amount.toLocaleString('uz-UZ')} so'm\nKategoriya: ${category}`);
        }
    }
});

// GLOBAL ERROR HANDLER
bot.catch((err) => {
    console.error("Error in bot:", err);
});
