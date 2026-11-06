// Arabic spelling of common Egyptian / Arab customer names, for the printed
// tickets. Each line: Arabic = English spellings customers use.

const NAMES: Record<string, string[]> = {
  "محمد": ["mohamed", "mohammed", "muhammad", "mohamad", "mohammad", "muhammed", "mohmed", "mhmd", "mohamd"],
  "أحمد": ["ahmed", "ahmad", "ahmd"],
  "محمود": ["mahmoud", "mahmud", "mahmod"],
  "مصطفى": ["mostafa", "mustafa", "moustafa", "mostfa"],
  "علي": ["ali", "aly"],
  "عمر": ["omar", "omer", "umar"],
  "عمرو": ["amr", "amro"],
  "حسن": ["hassan", "hasan"],
  "حسين": ["hussein", "hussien", "husein", "hosein", "hussain"],
  "حسام": ["hossam", "hosam", "husam"],
  "خالد": ["khaled", "khalid"],
  "كريم": ["karim", "kareem"],
  "يوسف": ["youssef", "yousef", "yousif", "yusuf", "youssif", "yossef"],
  "إبراهيم": ["ibrahim", "ebrahim", "brahim"],
  "إسماعيل": ["ismail", "esmail", "ismael"],
  "طارق": ["tarek", "tarik", "tareq"],
  "شريف": ["sherif", "sharif"],
  "وليد": ["walid", "waleed"],
  "هشام": ["hesham", "hisham"],
  "عادل": ["adel", "adil"],
  "سامح": ["sameh"],
  "سامي": ["samy", "sami"],
  "مجدي": ["magdy", "magdi"],
  "مدحت": ["medhat", "midhat"],
  "رامي": ["ramy", "rami"],
  "تامر": ["tamer", "tamir"],
  "ياسر": ["yasser", "yaser"],
  "ياسين": ["yassin", "yasin", "yaseen", "yassine"],
  "هاني": ["hany", "hani"],
  "إيهاب": ["ehab", "ihab"],
  "عماد": ["emad", "imad"],
  "أيمن": ["ayman", "aiman"],
  "أشرف": ["ashraf"],
  "أديب": ["adeeb", "adib"],
  "أسامة": ["osama", "usama", "ossama"],
  "أنس": ["anas"],
  "أمير": ["amir", "ameer"],
  "باسم": ["bassem", "basem"],
  "بلال": ["belal", "bilal"],
  "جمال": ["gamal", "jamal"],
  "جلال": ["galal", "jalal"],
  "حازم": ["hazem", "hazim"],
  "حمدي": ["hamdy", "hamdi"],
  "حمادة": ["hamada"],
  "حامد": ["hamed", "hamid"],
  "خليل": ["khalil"],
  "رضا": ["reda", "rida"],
  "رأفت": ["raafat", "rafat"],
  "زياد": ["ziad", "zyad", "ziyad"],
  "سعيد": ["saeed", "said", "saed"],
  "سيد": ["sayed", "sayyed", "sayd"],
  "صلاح": ["salah"],
  "صبري": ["sabry", "sabri"],
  "صابر": ["saber"],
  "عاطف": ["atef"],
  "عصام": ["essam", "issam", "esam"],
  "علاء": ["alaa", "ala"],
  "عبده": ["abdo", "abdou"],
  "فارس": ["fares", "faris"],
  "فاروق": ["farouk", "farouq", "faruk"],
  "فتحي": ["fathy", "fathi"],
  "فؤاد": ["fouad", "fuad"],
  "فيصل": ["faisal", "feisal"],
  "ماجد": ["maged", "majed"],
  "مالك": ["malek", "malik"],
  "مازن": ["mazen"],
  "مراد": ["mourad", "murad", "morad"],
  "مروان": ["marwan"],
  "مسعد": ["mosaad", "mos3ad", "mossad", "mosad"],
  "معتز": ["moataz", "motaz", "moetaz"],
  "منير": ["mounir", "monir"],
  "مؤمن": ["moamen", "momen", "mo2men"],
  "ناصر": ["nasser", "naser"],
  "نبيل": ["nabil", "nabeel"],
  "نادر": ["nader"],
  "نصر": ["nasr"],
  "هيثم": ["haitham", "haytham"],
  "وائل": ["wael", "wail"],
  "يحيى": ["yehia", "yahia", "yahya", "yehya"],
  "يس": ["yassen"],
  "سليمان": ["soliman", "suleiman", "sulaiman"],
  "شوقي": ["shawky", "shawki", "shawqi"],
  "شكري": ["shokry", "shukri"],
  "رمضان": ["ramadan"],
  "رفعت": ["refaat", "rifaat"],
  "رشاد": ["rashad"],
  "رشدي": ["roshdy", "rushdi"],
  "رجب": ["ragab", "rajab"],
  "سمير": ["samir", "sameer"],
  "سعد": ["saad"],
  "سالم": ["salem", "salim"],
  "سلامة": ["salama"],
  "شادي": ["shady", "shadi"],
  "شهاب": ["shehab", "shihab"],
  "طه": ["taha"],
  "عزت": ["ezzat", "izzat"],
  "عثمان": ["osman", "othman"],
  "عيد": ["eid"],
  "عوض": ["awad"],
  "غريب": ["ghareeb", "gharib"],
  "قاسم": ["kassem", "qasem", "kasem"],
  "كمال": ["kamal"],
  "لطفي": ["lotfy", "lotfi"],
  "مجد": ["magd", "majd"],
  "منصور": ["mansour"],
  "موسى": ["moussa", "mousa", "musa"],
  "نور": ["nour", "noor", "nur"],
  "نورهان": ["nourhan", "norhan"],
  "هادي": ["hady", "hadi"],
  "حمزة": ["hamza", "hamzah"],
  "آدم": ["adam"],
  "إسلام": ["islam", "eslam"],
  "سيف": ["seif", "saif", "sayf"],
  "زكريا": ["zakaria", "zakarya"],
  "عبدالله": ["abdallah", "abdullah", "abdalla", "abdulla"],
  "جرجس": ["gerges", "girgis"],
  "مينا": ["mina", "meena"],
  "بيتر": ["peter"],
  "مايكل": ["michael", "mikhail"],
  "جورج": ["george"],
  // Women
  "فاطمة": ["fatma", "fatima", "fatimah", "fatmah"],
  "مريم": ["mariam", "maryam", "meriam", "mariem"],
  "سارة": ["sara", "sarah"],
  "نادية": ["nadia", "nadya"],
  "ندى": ["nada"],
  "نهى": ["noha", "nuha"],
  "نهال": ["nehal"],
  "هبة": ["heba", "hiba"],
  "هالة": ["hala"],
  "هدى": ["hoda", "huda"],
  "دينا": ["dina", "deena"],
  "رنا": ["rana"],
  "رانيا": ["rania", "ranya"],
  "ريهام": ["reham"],
  "رحاب": ["rehab"],
  "رضوى": ["radwa"],
  "سلمى": ["salma"],
  "سمر": ["samar"],
  "سماح": ["samah"],
  "شيماء": ["shaimaa", "shimaa", "shaima", "shymaa"],
  "شيرين": ["sherine", "shereen", "sherin"],
  "غادة": ["ghada"],
  "منى": ["mona", "muna"],
  "منة": ["menna", "mena", "menah"],
  "منار": ["manar"],
  "مها": ["maha"],
  "مي": ["mai", "may"],
  "ميار": ["mayar"],
  "نرمين": ["nermeen", "nermin"],
  "نيرة": ["nayera", "naira", "nayra"],
  "ياسمين": ["yasmin", "yasmine", "yasmeen", "jasmine"],
  "آية": ["aya", "ayah"],
  "إيمان": ["eman", "iman"],
  "أسماء": ["asmaa", "asma"],
  "أميرة": ["amira", "ameera"],
  "أمل": ["amal"],
  "إسراء": ["esraa", "israa", "esra"],
  "بسمة": ["basma"],
  "جيهان": ["gihan", "jihan", "gehan"],
  "حنان": ["hanan"],
  "خديجة": ["khadija", "khadiga"],
  "داليا": ["dalia", "dalya"],
  "رشا": ["rasha"],
  "رغدة": ["raghda"],
  "روان": ["rawan"],
  "زينب": ["zeinab", "zainab", "zaynab"],
  "سهى": ["soha", "suha"],
  "سوزان": ["suzan", "susan"],
  "عبير": ["abeer", "abir"],
  "علياء": ["alia", "aliaa", "alyaa"],
  "عزة": ["azza"],
  "فرح": ["farah"],
  "لبنى": ["lobna", "lubna"],
  "لمياء": ["lamia", "lamiaa"],
  "ليلى": ["laila", "layla", "leila"],
  "مروة": ["marwa"],
  "مريهان": ["merhan", "mirhan"],
  "ناهد": ["nahed"],
  "نجلاء": ["naglaa", "najlaa"],
  "نسمة": ["nesma", "nisma"],
  "نيفين": ["nevin", "neveen"],
  "هند": ["hend", "hind"],
  "وفاء": ["wafaa", "wafa"],
  "ولاء": ["walaa"],
  "يارا": ["yara"],
  "يمنى": ["yomna", "yumna"],
  "جنى": ["jana", "gana"],
  "حبيبة": ["habiba"],
  "ملك": ["malak"],
  "لينا": ["lina", "leena"],
  "رهف": ["rahaf"],
  "شهد": ["shahd"],
  "ريم": ["reem", "rim"],
  "رحمة": ["rahma"],
  "سلوى": ["salwa"],
  "عفاف": ["afaf"],
  "ماجدة": ["magda"],
  "ميرنا": ["mirna", "merna"],
  "نانسي": ["nancy"],
  "إنجي": ["engy", "engi", "ingy"],
  "فوال": ["fawal"],
  "بشير": ["beshir", "bashir", "basheer"],
  "جمعة": ["gomaa", "goma", "jumaa"],
  "خطاب": ["khattab"],
  "درويش": ["darwish"],
  "رزق": ["rizk", "rezk"],
  "زكي": ["zaki", "zaky"],
  "سرور": ["sorour", "srour"],
  "شاهين": ["shahin", "shaheen"],
  "شعبان": ["shaaban", "shabaan"],
  "صادق": ["sadek", "sadiq"],
  "عرفة": ["arafa"],
  "عطية": ["attia", "atia"],
  "غنيم": ["ghoneim", "ghonim"],
  "فرج": ["farag", "faraj"],
  "فهمي": ["fahmy", "fahmi"],
  "متولي": ["metwally", "metwaly"],
  "مرسي": ["morsy", "morsi"],
  "مكي": ["makky"],
  "نجيب": ["naguib", "nagib", "najib"],
  "هلال": ["helal", "hilal"],
  "يونس": ["younes", "yunus", "younis"],
  "نجار": ["naggar"],
  "شافعي": ["shafei", "shafey"],
  "حجازي": ["hegazy", "hijazi"],
  "بدوي": ["badawy", "badawi"],
  "عيسى": ["eissa", "issa"],
  "إمام": ["emam", "imam"],
  "جاد": ["gad"],
  "رياض": ["riad", "riyad"],
  "سلطان": ["sultan", "soltan"],
  "شلبي": ["shalaby", "shalabi"],
  "قطب": ["kotb", "qutb"],
  "محفوظ": ["mahfouz"],
  "مختار": ["mokhtar"],
  "منتصر": ["montaser"],
  "نصار": ["nassar"],
  "هيكل": ["heikal"],
  "وهبة": ["wahba"],
  "سيدة": ["sayeda"],
  "جميلة": ["gamila", "jamila"],
};

// Attribute names that follow "Abd/Abdel" — "Abdel Rahman" → "عبد الرحمن".
const ABD_SUFFIX: Record<string, string> = {
  rahman: "الرحمن",
  rahim: "الرحيم",
  raheem: "الرحيم",
  aziz: "العزيز",
  hamid: "الحميد",
  hameed: "الحميد",
  kader: "القادر",
  qader: "القادر",
  kadir: "القادر",
  moneim: "المنعم",
  monem: "المنعم",
  fattah: "الفتاح",
  latif: "اللطيف",
  lateef: "اللطيف",
  halim: "الحليم",
  karim: "الكريم",
  kareem: "الكريم",
  wahab: "الوهاب",
  salam: "السلام",
  ghany: "الغني",
  ghani: "الغني",
  maksoud: "المقصود",
  nasser: "الناصر",
  naser: "الناصر",
  hady: "الهادي",
  hadi: "الهادي",
  razek: "الرازق",
  gawad: "الجواد",
  gwad: "الجواد",
  magid: "المجيد",
  maguid: "المجيد",
  sattar: "الستار",
  mohsen: "المحسن",
  baset: "الباسط",
  khalek: "الخالق",
  alim: "العليم",
  aleem: "العليم",
  wahed: "الواحد",
  hakim: "الحكيم",
  hay: "الحي",
  mageed: "المجيد",
  galil: "الجليل",
  tawab: "التواب",
  allah: "الله",
};

const LOOKUP = new Map<string, string>();
for (const [ar, variants] of Object.entries(NAMES)) {
  for (const v of variants) LOOKUP.set(v, ar);
}

const ABD_RE = /^(?:abd|abdel|abdul|abdal|abdl|abd-el|abd-al)(?:-)?(.*)$/;

function word(token: string): string | null {
  const t = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!t) return null;
  const direct = LOOKUP.get(t);
  if (direct) return direct;
  // "Abdelrahman", "Abdulaziz"
  const abd = ABD_RE.exec(t);
  if (abd && abd[1]) {
    const rest = abd[1].replace(/^(el|al|ul)/, "");
    const suffix = ABD_SUFFIX[rest] ?? ABD_SUFFIX[abd[1]];
    if (suffix) return suffix === "الله" ? "عبدالله" : `عبد ${suffix}`;
  }
  // "Elsayed", "Elnaggar" → "ال" + known name
  const el = /^(el|al)(.{3,})$/.exec(t);
  if (el) {
    const inner = LOOKUP.get(el[2]);
    if (inner) return inner.startsWith("ال") ? inner : `ال${inner}`;
  }
  return null;
}

export interface ArabicName {
  text: string;
  /** Every part was recognised (or the name was already Arabic). */
  complete: boolean;
}

/** Writes a customer name in Arabic letters; unknown parts stay as typed. */
export function arabicName(name: string): ArabicName {
  const trimmed = name.trim();
  if (!trimmed || !/[A-Za-z]/.test(trimmed)) return { text: trimmed, complete: true };

  const tokens = trimmed.split(/\s+/);
  const out: string[] = [];
  let complete = true;
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const lower = cur.toLowerCase().replace(/[^a-z-]/g, "");
    const next = tokens[i + 1]?.toLowerCase().replace(/[^a-z]/g, "");

    // "Abdel Rahman", "Abd El Rahman", "Abd Allah"
    if (/^(abd|abdel|abdul|abdal)$/.test(lower) && next) {
      let j = i + 1;
      let target = next;
      if ((target === "el" || target === "al") && tokens[i + 2]) {
        j = i + 2;
        target = tokens[j].toLowerCase().replace(/[^a-z]/g, "");
      }
      const suffix = ABD_SUFFIX[target];
      if (suffix) {
        out.push(suffix === "الله" ? "عبدالله" : `عبد ${suffix}`);
        i = j;
        continue;
      }
    }
    // "El Sayed" → "السيد"
    if ((lower === "el" || lower === "al") && next) {
      const inner = LOOKUP.get(next);
      if (inner) {
        out.push(inner.startsWith("ال") ? inner : `ال${inner}`);
        i += 1;
        continue;
      }
    }
    if (!/[A-Za-z]/.test(cur)) {
      out.push(cur);
      continue;
    }
    const ar = word(cur);
    if (ar) out.push(ar);
    else {
      out.push(cur);
      complete = false;
    }
  }
  return { text: out.join(" "), complete };
}
