const D={
 TDM:["tdm","tdms","مندوب","المندوب","مندوبين","المناديب","مناديب","مندوب ميداني","مندوب مبيعات","مندوبب","مندوبن"],
 SUPERVISOR:["supervisor","sv","سوبرفايزر","سوبر فايزر","مشرف","المشرف","مشرفين"],
 RTM:["rtm","ار تي ام","مدير منطقة","مدير المنطقة"],DM:["dm","دي ام"],
 STORE:["store","stores","outlet","outlets","branch","branches","محل","المحل","محلات","فرع","الفرع","فروع","عميل","عملاء"],
 VISIT:["visit","visits","زيارة","زياره","زيارات","زار","اتزار","اتزارت","تمت زيارته"],
 GORILLA:["gorilla","gorila","gorlla","gorrila","جوريلا","غوريلا","جورلا","جوريلا انرجي","جوريلا إنرجي"],
 POSM:["posm","pos","مواد دعاية","مواد دعايه","دعايا","دعاية","مواد دعائية","بوستر","بوسترات","راك","شيلف توكر","شيلف ستريب","كونتر توب","ستيكر","ستيكر 3 باك"],
 ERROR:["error","errors","خطأ","خطا","اخطاء","أخطاء","غلط","اغلاط","مشاكل"],
 PRODUCT:["product","products","sku","skus","منتج","منتجات","صنف","اصناف","أصناف"],
 NEW_STORE:["new store","newadd","new add","محل جديد","محلات جديدة","فرع جديد","فروع جديدة"],
 MISSING:["missing","مسنج","ميسنج","ناقص","ناقصين","مفقود"],
 COVERAGE:["coverage","كفريج","تغطية","نسبة التغطية"],
 AVAILABILITY:["availability","available","افيلابيليتي","افيليبيلتي","توافر","متوفر"],
 MAP:["map","maps","خريطة","الخريطة","خريطه","ماب"],
 GIZA:["giza","جيزة","جيزه","الجيزة","الجيزه"],EAST:["east","ايست","شرق","الشرق"],WEST:["west","ويست","غرب","الغرب"],
 ALEX:["alex","alexandria","اسكندرية","إسكندرية","الاسكندرية","اسكندريه","اليكس"],CAIRO:["cairo","القاهرة","القاهره","قاهرة"],
 EXPORT:["excel","xlsx","اكسل","إكسل","اكسبورت","export","صدر","صدّر","تصدير","نزّل","نزل","نزلهولي","نزلهوملي"],
 SHOW:["show","view","اعرض","اعرضلي","وريني","هات","هاتلي","طلع","طلعلي","جيب","جيبلي"],
 COUNT:["count","كام","عدد","احسب","احسبلي"],TOP:["top","اكتر","أكتر","اعلى","أعلى","الأكثر"],BOTTOM:["bottom","اقل","أقل","الأقل"],
 COMPARE:["compare","comparison","قارن","قارنلي","مقارنة","مقارنه","مقابل","vs"],WITHOUT:["without","no","مفيش","مافيش","بدون","مش موجود","غير موجود"],
 WITH:["with","yes","فيه","موجود","عنده","عندهم"],TODAY:["today","النهاردة","النهارده","اليوم"],YESTERDAY:["yesterday","امبارح","أمبارح"],
 THIS_WEEK:["this week","الاسبوع ده","الأسبوع ده","الاسبوع الحالي"],LAST_WEEK:["last week","الاسبوع اللي فات","الأسبوع اللي فات","الاسبوع السابق"],
 WEEK1:["week 1","week1","w1","الاسبوع الاول","الأسبوع الأول"],WEEK2:["week 2","week2","w2","الاسبوع الثاني","الأسبوع الثاني","الاسبوع التاني"],
 CYCLE1:["cycle 1","cycle1","c1","سايكل 1","سايكل واحد","الدورة الاولى"],CYCLE2:["cycle 2","cycle2","c2","سايكل 2","سايكل اتنين","الدورة الثانية"]
};

// V4 schema vocabulary: exact Gorilla report concepts + colloquial/English aliases.
const V4={
SKU_ULTIMATE_250:["gorilla ultimate 250ml","ultimate 250","التيميت 250","التميت 250","جوريلا التيميت 250","الاسود 250"],
SKU_ULTIMATE_500:["gorilla ultimate 500ml","ultimate 500","التيميت 500","التميت 500","جوريلا التيميت 500","الاسود 500"],
SKU_MANGO_250:["gorilla mango coconut 250ml","mango coconut 250","mango 250","مانجو كوكونت 250","مانجو 250","جوريلا مانجو 250"],
SKU_MANGO_500:["gorilla mango coconut 500ml","mango coconut 500","mango 500","مانجو كوكونت 500","مانجو 500","جوريلا مانجو 500"],
SKU_WATERMELON_250:["gorilla watermelon melon 250ml","watermelon 250","واتر ميلون 250","واترملون 250","بطيخ 250","جوريلا بطيخ 250"],
SKU_WATERMELON_500:["gorilla watermelon melon 500ml","watermelon 500","واتر ميلون 500","واترملون 500","بطيخ 500","جوريلا بطيخ 500"],
FACING:["facing count","facings","facing","فيسنج","فيسنجات","عدد الفيسنج","عدد الواجهات"],
MAIN_DISPLAY:["main display","العرض الرئيسي","عرض رئيسي"],COLD_DISPLAY:["cold additional display","عرض اضافي مبرد","العرض المبرد"],
HOT_DISPLAY:["hot additional display","عرض اضافي ساخن","العرض الساخن"],
GORILLA_COOLER:["gorilla cooler","ثلاجة جوريلا","ثلاجه جوريلا"],GORILLA_COOLER_COUNT:["gorilla cooler count","عدد ثلاجات جوريلا","كام ثلاجة جوريلا"],
JUHAYNA_COOLER:["juhayna cooler","ثلاجة جهينة","ثلاجه جهينه"],PRIVATE_COOLER:["private cooler","الثلاجات الخاصة","ثلاجة خاصة"],
PEPSI_COOLER:["pepsi cooler","ثلاجة بيبسي","بيبسي كولر"],COKE_COOLER:["coca cola cooler","coke cooler","ثلاجة كوكاكولا","كوكا كولا كولر"],
REDBULL_COOLER:["red bull cooler","redbull cooler","ثلاجة ريدبول"],STING_COOLER:["sting cooler","ثلاجة ستينج","ثلاجة ستنج"],
MONSTER_COOLER:["monster cooler","ثلاجة مونستر","ثلاجة مونيستور"],OPEN_COOLER:["open display cooler","ثلاجة عرض مفتوحة","ثلاجات العرض المفتوحة"],
OTHER_COOLER:["other cooler","ثلاجات اخرى","ثلاجة اخرى"],
COMP_REDBULL:["red bull","redbull","ريدبول","ريد بول"],COMP_MONSTER:["monster","مونستر","مونيستور"],
COMP_POWER_HORSE:["power horse","باور هورس"],COMP_STING:["sting","ستينج","ستنج"],COMP_FURY:["fury","فيوري","فيورى"],COMP_TWIST:["twist","تويست"],
POSTERS:["posters","poster","بوستر","بوسترات","بوستر عادي"],TRANSPARENT_POSTERS:["transparent posters","بوستر شفاف","بوسترات شفافة"],
PARASITE_RACK:["parasite rack","باراسيت راك","باراسايت راك"],SHELF_TALKER:["shelf talker","شيلف توكر"],COUNTER_TOP:["counter top","كونتر توب","كاونتر توب"],
SHELF_STRIPE:["shelf stripe","shelf strip","شيلف ستريب"],STICKER_3_PACK:["sticker 3 pack","ستيكر 3 باك","استيكر 3 باك"],
PALLET_WRAP:["pallet wrap","باليت راب"],STOPPER:["stopper","ستوبر"],PUSH_PULL:["push & pull door sticker","push pull sticker","بوش اند بول","ستيكر الباب"],
SHELF_IN_SHELF:["shelf in shelf","شيلف ان شيلف"],CARTON_DISPLAY:["carton display","كارتون ديسبلاي","كرتون ديسبلاي"],
VISIT_STATUS:["visit status","حالة الزيارة","حاله الزياره"],GOVERNORATE:["governorate","محافظة","المحافظة"],AREA:["area name","area","منطقة","المنطقة"],
CLIENT_CODE:["client code","كود العميل","كود الفرع","كود المحل"],CLIENT_ID:["client id","اي دي العميل","رقم العميل"],
DURATION:["total duration","duration","مدة الزيارة","وقت الزيارة"],START_TIME:["started at","start time","بداية الزيارة","وقت البداية"],END_TIME:["ended at","end time","نهاية الزيارة","وقت النهاية"],
JUHAYNA_PRODUCTS:["منتجات جهينة","بتتعامل في منتجات جهينة","juhayna products"],JUHAYNA_SOURCE:["بتجيب منتجات جهينة منين","مصدر جهينة","juhayna source"],
JUHAYNA_REP:["مندوب جهينة","juhayna rep"],WHOLESALER:["تاجر الجملة","اسم تاجر الجملة","wholesaler"],
GORILLA_PRESENCE:["منتجات جوريلا موجودة","وجود جوريلا","gorilla presence"],PRICE_250:["سعر جوريلا 250","سعر 250","gorilla 250 price"],
PRICE_500:["سعر جوريلا 500","سعر 500","gorilla 500 price"],PRICING:["تسعير جوريلا","فيه تسعير","pricing"],PLANOGRAM:["planogram","portfolio","بلانوجرام","البورتفوليو"],
HOTSPOT:["hotspot","هوت سبوت","مكان ظاهر","مكان واضح"],EXTRA_DISPLAY:["additional display","extra display","عرض اضافي","عرض إضافي"],
POSM_PRESENT:["مواد دعاية جوريلا","مواد دعايه جوريلا","gorilla posm"],SAMPLES:["free samples","sample delivery","تسليم العينات","عينات مجانية"],
STORE_TYPE:["store type","نوع المحل"],STORE_CLASS:["store classification","تصنيف المحل"],STRONG_STORE:["strong store","محل قوي","محل قوى"],
ENERGY_DRINKS:["energy drinks","مشروبات الطاقة","تواجد منتجات مشروبات الطاقة"],COOLER_RECOMMEND:["recommend gorilla cooler","مرشح لثلاجة جوريلا","ترشح المحل للحصول على ثلاجه جوريلا"],
NOTES:["general notes","notes","ملاحظات عامة","ملاحظات"],AVAILABILITY_FIELD:["availability","افيلابيليتي","افيليبيلتي","التوافر"],
DETAILS:["details","تفاصيل","التفاصيل"],GROUP:["group by","حسب","قسمهالي","قسم"],SORT:["sort","رتب","رتبلي","رتبهالي"],ONLY:["only","بس","فقط"],EXCEPT:["except","ماعدا","شيل"],
LAST_TWO_WEEKS:["last two weeks","اخر اسبوعين","آخر أسبوعين"],SAME_RESULT:["same as before","نفس اللي فات","زي اللي فات","دول بس"]
};
for(const [k,v] of Object.entries(V4))D[k]=[...(D[k]||[]),...v];

const SEMANTIC_VOCAB={
 REPORT:["report","تقرير","تقرير عن","اخرج تقرير","خرج تقرير","طلع تقرير","اعمل تقرير","عاوز تقرير","عايز تقرير"],
 PRESENCE:["presence","availability","تواجد","التواجد","عمل تواجد","حقق تواجد","جاب تواجد","موجود","وجود"],
 BEST:["best","top","highest","most","احسن","أحسن","الاحسن","الأحسن","افضل","أفضل","الافضل","الأفضل","اقوى","أقوى","اعلى","أعلى","اكتر","أكتر","الاكثر","الأكثر","الاول","الأول","رقم واحد"],
 WORST:["worst","bottom","lowest","least","اسوأ","أسوأ","اوحش","أوحش","اضعف","أضعف","اقل","أقل","الاقل","الأقل","الاخير","الأخير","اخر واحد","آخر واحد"],
 BY:["by","حسب","لكل","على مستوى","مقسم على","قسم حسب"],
 TOP_N:["top","اول","أول","احسن","أحسن","افضل","أفضل"],
 BOTTOM_N:["bottom","اخر","آخر","اسوأ","أسوأ","اوحش","أوحش","اضعف","أضعف"],
 EXPORT_REPORT:["خرجلي","اخرج","طلعلي","اعمللي","هاتلي التقرير"]
};
for(const [k,v] of Object.entries(SEMANTIC_VOCAB))D[k]=[...(D[k]||[]),...v];



export {D};
