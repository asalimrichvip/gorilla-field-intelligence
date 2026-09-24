/**
 * =======================================================================
 * إضافة "aiInterpret" لمشروع Apps Script بتاعك — كل رسالة في مساعد Gorilla بتروح
 * لـ Gemini مباشرة (مش بس لما المساعد المحلي يفشل)، والفهم المحلي بيشتغل بس
 * لو الإنترنت/الكوتة اتقطعت مع Gemini.
 * =======================================================================
 * الخطوات:
 * 1) افتح مشروع Apps Script بتاعك (نفس اللي بيرجع البيانات للداشبورد).
 * 2) من القائمة الجانبية: Project Settings ⚙ → Script Properties → Add script property
 *    - Property: GEMINI_API_KEY
 *    - Value: المفتاح اللي هتاخده من https://aistudio.google.com/app/apikey (مجاني)
 * 3) الصق الكود ده في أي ملف .gs في نفس المشروع (أو ملف جديد).
 * 4) في الـ doPost بتاعك، جوه الـ switch/if بتاع "action"، ضيف السطر ده:
 *
 *      if (action === 'aiInterpret') return jsonResponse(handleAiInterpret(payload));
 *
 *    (لو الـ doPost بتاعك بيرجع النتيجة بطريقة مختلفة عن jsonResponse، استخدم نفس
 *     الطريقة اللي بترجع بيها باقي الـ actions عندك، المهم يرجع نفس شكل الـ JSON اللي هنا).
 * 5) اعمل Deploy → Manage deployments → New version، عشان التغيير يبقى فعّال.
 * =======================================================================
 */

function handleAiInterpret(payload) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return {ok: false, error: 'GEMINI_API_KEY غير مضبوط في Script Properties.'};

  var text = String(payload.text || '').trim();
  var columns = Array.isArray(payload.columns) ? payload.columns : [];
  if (!text) return {ok: false, error: 'لا يوجد نص للتحليل.'};

  // الأعمدة الفعلية الموجودة في بياناتك — عشان الموديل يختار اسم عمود حقيقي، مش يخترعه
  var columnList = columns.filter(function(c){return c && c.indexOf('_') !== 0;}).slice(0, 200).join(', ');

  var systemPrompt =
    'انت المحلل الوحيد لكل رسالة في مساعد تطبيق Gorilla Energy Drink لتتبع تواجد المنتج في المحلات — كل رسالة من المستخدم بتيجي لك مباشرة. ' +
    'مهمتك: ترجع JSON فقط، بدون أي نص أو شرح أو ```. الشكل المطلوب بالظبط:\n' +
    '{"smalltalk":"رد قصير أو null (لو الرسالة تحية أو شكر بس، مش طلب بيانات)",' +
    '"metric":"presence|visits|stores|errors|facings|field أو null لو مش فاهم الطلب خالص",' +
    '"clarify":"سؤال توضيحي قصير بالعربي أو null (استخدمه لو metric=null)",' +
    '"unclear":["كلمة من رسالة المستخدم نفسها مش متأكد من قصدها"] (مصفوفة فاضية لو كل حاجة واضحة),' +
    '"field":"اسم عمود حقيقي من القائمة أو null",' +
    '"sku":"Mango 250|Mango 500|Watermelon 250|Watermelon 500|Ultimate 250|Ultimate 500|null",' +
    '"absent":true/false,' +
    '"rate":true/false,' +
    '"rank":"best|worst|null",' +
    '"limit":رقم,' +
    '"group":"Rep|RTM|null",' +
    '"filters":[{"field":"اسم عمود","values":["قيمة"]}],' +
    '"from":"YYYY-MM-DD أو null",' +
    '"to":"YYYY-MM-DD أو null",' +
    '"aggregation":"sum|average",' +
    '"note":"جملة عربية قصيرة جدًا (أقل من 12 كلمة) توضح إزاي فهمت الطلب"}\n' +
    'قواعد: "metric":"presence" لأي سؤال عن تواجد/غياب المنتج. "absent":true لو السؤال عن اللي المنتج مش متواجد عندهم (بأي صيغة عامية: مافيش/مافيهاش/مش موجود/بدون...). ' +
    'استخدم بس أسماء أعمدة من القائمة دي فعليًا، ولو مفيش عمود مناسب سيب "field":null. ' +
    'لو الرسالة غامضة أو ناقصة معلومة أساسية (مثلاً ذكر منتج من غير حجم)، سيب "metric":null واكتب سؤال محدد في "clarify"، وحط الكلمة الغامضة في "unclear". ' +
    'الأعمدة المتاحة: ' + columnList;

  var body = {
    contents: [{parts: [{text: systemPrompt + '\n\nطلب المستخدم: ' + text}]}],
    generationConfig: {temperature: 0, responseMimeType: 'application/json'}
  };

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=' + apiKey;
  var response = null;
  var code = 0;
  var lastError = '';
  var retryDelays = [0, 1500, 3500, 7000];
  var transientCodes = {408:true, 429:true, 500:true, 502:true, 503:true, 504:true};

  for (var attempt = 0; attempt < retryDelays.length; attempt++) {
    if (retryDelays[attempt] > 0) Utilities.sleep(retryDelays[attempt]);
    try {
      response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(body),
        muteHttpExceptions: true
      });
      code = response.getResponseCode();
      if (code === 200) break;
      lastError = response.getContentText().slice(0, 300);
      if (!transientCodes[code]) break;
    } catch (e) {
      lastError = String(e && e.message ? e.message : e);
      code = 0;
      if (attempt === retryDelays.length - 1) break;
    }
  }

  if (!response || code !== 200) {
    return {
      ok: false,
      code: code || 'GEMINI_TEMP_UNAVAILABLE',
      retryable: code === 0 || !!transientCodes[code],
      error: 'Gemini غير متاح مؤقتًا بعد المحاولات التلقائية' + (code ? ' (' + code + ')' : '') + ': ' + lastError
    };
  }

  var data;
  try { data = JSON.parse(response.getContentText()); } catch (e) { return {ok: false, error: 'رد غير صالح من Gemini.'}; }

  var raw = data.candidates && data.candidates[0] && data.candidates[0].content &&
            data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
            data.candidates[0].content.parts[0].text;
  if (!raw) return {ok: false, error: 'Gemini لم يرجع محتوى (ممكن يكون رفض الطلب أو محتاج مراجعة الـ prompt).'};

  var plan;
  try { plan = JSON.parse(raw); } catch (e) { return {ok: false, error: 'تعذر قراءة رد Gemini كـ JSON.'}; }

  return {ok: true, plan: plan};
}

/**
 * لو مفيش عندك دالة jsonResponse بالفعل، استخدم دي (أو ما يعادلها في الكود بتاعك):
 *
 * function jsonResponse(obj) {
 *   return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
 * }
 */
