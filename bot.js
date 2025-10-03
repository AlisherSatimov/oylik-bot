// bot.js
import dotenv from "dotenv";
import { Telegraf, Markup } from "telegraf";

dotenv.config();

if (!process.env.BOT_TOKEN) {
  console.error(
    "BOT_TOKEN .env da topilmadi. .env faylga BOT_TOKEN ni qo'ying."
  );
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// ==== Doimiy qiymatlar (web bilan mos) ====
const DAROMAD_SOLIGI = 0.13;
const ENG_KAM_ISH_HAQQI = 1271000;

// Oddiy in-memory session
const sessions = {};

// Yordamchi: musbat raqam tekshiruvi
function isPositiveNumber(v) {
  const n = Number(v);
  return !Number.isNaN(n) && n > 0;
}

// Soliq hisoblash
function calculationTax(salary) {
  return salary * DAROMAD_SOLIGI;
}

// Formulaga mos oylik
function calculationSalary(talabalar, rejaDars, dars, daraja) {
  const T = Number(talabalar);
  const R = Number(rejaDars);
  const H = Number(dars);
  const D = Number(daraja);

  return ((T * D * ENG_KAM_ISH_HAQQI) / R) * H;
}

// Formatlash
function fmt(n) {
  return Number(n).toLocaleString("en-DE") + " so'm";
}

// /start komandasi
bot.start((ctx) => {
  sessions[ctx.from.id] = { step: "student" };
  ctx.reply(
    "Salom 👋 Oylik hisoblash botiga xush kelibsiz.\n\nIltimos, talabalar sonini kiriting (butun son):",
    Markup.keyboard([["🔄 Qayta hisoblash"]]).resize()
  );
});

// Reply keyboarddagi tugma
bot.hears("🔄 Qayta hisoblash", (ctx) => {
  sessions[ctx.from.id] = { step: "student" };
  ctx.reply("🔄 Yangi hisoblash boshlanadi. Talabalar sonini kiriting:");
});

// Matnlarni step bo‘yicha qabul qilish
bot.on("text", (ctx) => {
  const id = ctx.from.id;
  if (!sessions[id]) sessions[id] = { step: "student" };
  const state = sessions[id];
  const text = String(ctx.message.text).trim();

  if (state.step === "student") {
    if (!isPositiveNumber(text)) {
      return ctx.reply("Iltimos musbat son kiriting — talabalar soni:");
    }
    state.students = Number(text);
    state.step = "plan";
    return ctx.reply(
      "📘 Reja bo'yicha o'tilishi kerak darslar sonini kiriting:"
    );
  }

  if (state.step === "plan") {
    if (!isPositiveNumber(text)) {
      return ctx.reply("Iltimos musbat son kiriting — reja darslar soni:");
    }
    state.plan = Number(text);
    state.step = "lesson";
    return ctx.reply("📚 Haqiqatan o'tilgan darslar sonini kiriting:");
  }

  if (state.step === "lesson") {
    if (!isPositiveNumber(text)) {
      return ctx.reply("Iltimos musbat son kiriting — o'tilgan darslar soni:");
    }
    state.lesson = Number(text);
    state.step = "degree";

    return ctx.reply(
      "Darajani tanlang:",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("18% (0.18)", "degree_0.18"),
          Markup.button.callback("20% (0.20)", "degree_0.2"),
        ],
        [
          Markup.button.callback("25% (0.25)", "degree_0.25"),
          Markup.button.callback("30% (0.30)", "degree_0.3"),
        ],
      ])
    );
  }

  return ctx.reply(
    "Agar yangi hisoblash xohlaysiz 🔄 Qayta hisoblash tugmasini bosing."
  );
});

// Daraja tugmasi bosilganda
bot.action(/degree_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();

  const id = ctx.from.id;
  const state = sessions[id];

  if (
    !state ||
    typeof state.students === "undefined" ||
    typeof state.plan === "undefined" ||
    typeof state.lesson === "undefined"
  ) {
    return ctx.reply(
      "Avval talabalar, reja va o'tilgan darslarni kiriting (boshlash uchun /start)."
    );
  }

  const degree = parseFloat(ctx.match[1]);
  if (Number.isNaN(degree) || degree <= 0) {
    return ctx.reply("Daraja qiymati noto'g'ri. Iltimos qayta urinib ko'ring.");
  }

  const salary = calculationSalary(
    state.students,
    state.plan,
    state.lesson,
    degree
  );
  const tax = calculationTax(salary);
  const net = salary - tax;

  await ctx.reply(
    `💰 Oylik hisob-kitob:
- Oylik kissaga: ${fmt(net)}
- Soliq (${DAROMAD_SOLIGI * 100}%): ${fmt(tax)}
- Aslida oylik: ${fmt(salary)}

👨‍🎓 Talabalar: ${state.students} ta
📘 Reja darslar: ${state.plan} ta
📚 Haqiqiy o'tilgan darslar: ${state.lesson} ta
🎓 Daraja: ${degree}`
  );

  state.step = "done";
});

// Botni ishga tushirish
bot.launch().then(() => console.log("Bot ishga tushdi."));
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
