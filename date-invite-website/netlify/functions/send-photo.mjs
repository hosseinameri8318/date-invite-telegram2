// Telegram photo relay for Netlify Functions.
// Keep TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Netlify's environment settings.

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export default async (request) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "روش درخواست پشتیبانی نمی‌شود." }, 405);
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return json({ ok: false, error: "تنظیمات ارسال عکس هنوز کامل نشده است." }, 500);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  // The browser upload is capped at 4 MB to stay below serverless request-size limits.
  if (contentLength > 5 * 1024 * 1024) {
    return json({ ok: false, error: "حجم درخواست بیش از حد مجاز است؛ عکس کوچک‌تری انتخاب کن." }, 413);
  }

  let fields;
  try {
    fields = await request.formData();
  } catch {
    return json({ ok: false, error: "فایل عکس قابل خواندن نیست؛ دوباره انتخابش کن." }, 400);
  }

  const photo = fields.get("photo");
  if (!photo || typeof photo.arrayBuffer !== "function" || photo.size === 0) {
    return json({ ok: false, error: "فایل عکس پیدا نشد." }, 400);
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return json({ ok: false, error: "حجم عکس نباید بیشتر از ۴ مگابایت باشد." }, 413);
  }
  if (!photo.type || !photo.type.startsWith("image/")) {
    return json({ ok: false, error: "فایل انتخاب‌شده باید عکس باشد." }, 415);
  }

  const telegramForm = new FormData();
  telegramForm.append("chat_id", chatId);
  telegramForm.append("caption", "عکس چشم آپلودشده از سایت دعوت دیت 💗");
  telegramForm.append("photo", photo, (photo.name || "eye-photo.jpg").replace(/[\r\n]/g, "_"));

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: telegramForm,
    });
    const telegramResult = await telegramResponse.json().catch(() => ({}));
    if (!telegramResponse.ok || !telegramResult.ok) {
      console.error("Telegram sendPhoto failed", telegramResult.error_code || telegramResponse.status);
      return json({ ok: false, error: "تلگرام نتوانست عکس را دریافت کند. دوباره امتحان کن." }, 502);
    }
    return json({ ok: true });
  } catch (error) {
    console.error("Telegram request failed", error?.name || "unknown error");
    return json({ ok: false, error: "ارتباط با تلگرام برقرار نشد. کمی بعد دوباره امتحان کن." }, 502);
  }
};
