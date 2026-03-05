import { useState, useRef, useEffect, useCallback, useMemo, Component } from "react";
import { GoogleGenAI } from "@google/genai";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM — Modern Health-Tech Minimalism
// Palette: cool blues · white surfaces · deep navy text
// Fonts: Geologica (headings) · DM Sans (UI) · JetBrains Mono (data)
// ─────────────────────────────────────────────────────────────────────────────
const DS = {
  bg:           "#F4F7FA",
  surface:      "#FFFFFF",
  surfaceAlt:   "#F8FAFC",
  border:       "#E1E8F0",
  borderStrong: "#C8D6E5",
  primary:      "#1A73E8",
  primaryDark:  "#1558B0",
  primaryLight: "#E8F0FE",
  text:         "#1C1E21",
  textSec:      "#5F6368",
  textMuted:    "#9AA3AF",
  success:      "#1E8A4C",
  successBg:    "#E6F4ED",
  warning:      "#B06000",
  warningBg:    "#FEF3E2",
  danger:       "#C5221F",
  dangerBg:     "#FCE8E6",
  accent:       "#F9AB00",
  accentBg:     "#FEF8E1",
};

// ── ERROR BOUNDARY ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("AdminAI crashed:", error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:DS.bg, fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ background:DS.surface, borderRadius:16, padding:"48px 56px", textAlign:"center", maxWidth:440, boxShadow:"0 4px 24px rgba(0,0,0,0.08)", border:`1px solid ${DS.border}` }}>
          <div style={{ width:56, height:56, borderRadius:12, background:DS.dangerBg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 20px" }}>⚠️</div>
          <div style={{ fontSize:18, fontWeight:700, color:DS.text, marginBottom:8, fontFamily:"'Geologica',sans-serif" }}>Something went wrong</div>
          <div style={{ fontSize:13, color:DS.textSec, marginBottom:24, lineHeight:1.6 }}>The app hit an unexpected error. Your session data is safe — reload to continue.</div>
          <div style={{ background:DS.surfaceAlt, borderRadius:8, padding:"10px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:DS.danger, marginBottom:24, textAlign:"left", border:`1px solid ${DS.border}` }}>
            {this.state.error?.message || "Unknown error"}
          </div>
          <button onClick={() => window.location.reload()} style={{ background:DS.primary, color:"white", border:"none", borderRadius:8, padding:"10px 28px", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            Reload App
          </button>
        </div>
      </div>
    );
  }
}

// ── HOOKS ─────────────────────────────────────────────────────────────────────
function useKeyboardShortcuts(handlers) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      const combo = [e.ctrlKey||e.metaKey?"ctrl":"", e.shiftKey?"shift":"", e.key.toLowerCase()].filter(Boolean).join("+");
      handlers[combo]?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return isOnline;
}

// ── SKELETON ──────────────────────────────────────────────────────────────────
function Skeleton({ width="100%", height=14, radius=6, style={} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: `linear-gradient(90deg,${DS.border} 25%,${DS.surfaceAlt} 50%,${DS.border} 75%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s ease infinite",
      ...style,
    }} />
  );
}

function MessageSkeleton() {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", gap:10, marginBottom:10 }}>
        <Skeleton width={32} height={32} radius={16} />
        <div style={{ flex:1, maxWidth:"55%", display:"flex", flexDirection:"column", gap:6 }}>
          <Skeleton height={13} /><Skeleton height={13} width="70%" />
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <Skeleton height={38} radius={12} width="40%" />
      </div>
    </div>
  );
}

// ── i18n ──────────────────────────────────────────────────────────────────────
// FIX #1: Every single string in the UI is now in this table for all 3 languages.
// This includes tab labels, button text, toasts, banners, section headers,
// badge names/descriptions, analytics labels, ethics copy, tour steps — everything.
// When the language selector changes, t() returns the right string everywhere.
const STRINGS = {
  en: {
    // Header
    appTitle: "DMED Admin AI",
    appSub:   "Uzbekistan Healthcare System",
    demoBtn:  "Guided Tour",
    // Stats bar
    statRx:     "Rx",
    statRep:    "Reports",
    statPdf:    "PDFs",
    statBadges: "Badges",
    // Tabs
    tabChat:    "Chat",
    tabOutputs: "Documents",
    tabBadges:  "Achievements",
    tabMetrics: "Analytics",
    tabEthics:  "Ethics",
    // Patient selector
    loadPatient: "Select Patient",
    mockLabel:   "MOCK DMED RECORDS — Demo only",
    patientCleared: "Patient cleared",
    // Quick prompts — labels (buttons)
    qpRx:       "Prescription",
    qpSummary:  "Summary",
    qpSchedule: "Shift Schedule",
    qpLab:      "Lab Report",
    // Quick prompt instructions sent to AI when a patient IS selected
    qpRxInstr:       "Draft a prescription for this patient based on their vitals, current medications, allergies, and chief complaint.",
    qpSummaryInstr:  "Write a concise clinical summary for this patient: chief complaint, vitals, current medications, allergies.",
    qpScheduleInstr: "Create a 5-day shift schedule for 3 doctors and 4 nurses.",
    qpLabInstr:      "Generate a lab report template for CBC and metabolic panel.",
    // Quick prompt instructions used when NO patient is selected (generic fallback)
    qpRxFallback:       "Draft a prescription for a 45-year-old male patient with chest pain and BP 140/90.",
    qpSummaryFallback:  "Summarize: T 38.5°C, cough 5 days, SpO2 96%, no comorbidities.",
    qpScheduleFallback: "Create a 5-day shift schedule for 3 doctors and 4 nurses.",
    qpLabFallback:      "Generate a lab report template for CBC and metabolic panel.",
    // Chat
    placeholder: "Describe the patient case or type your request…",
    send:        "Send",
    disclaimer:  "AI outputs are administrative drafts only. All documents require clinician review and signature before use.",
    greeting:    "Hello 👋 I'm your DMED Administrative Assistant. Select a patient record above, then use the quick-action buttons or type your request — prescription, summary, schedule, or lab report.",
    // Patient banner
    patientLoaded:   "Patient loaded",
    chiefComplaint:  "Chief complaint",
    contextActive:   "Context will be used in next request",
    // AI response messages
    docReady:   "Document ready",
    seeDocTab:  "— check the Documents tab.",
    errorMsg:   "Something went wrong. Please try again.",
    offlineBanner: "No internet connection — AI features unavailable",
    // Documents tab
    noDocsYet:  "No documents yet",
    noDocsHint: "Use the quick-action buttons or type a request in the Chat tab",
    copyBtn:    "Copy",
    pdfBtn:     "PDF",
    copied:     "Copied to clipboard",
    pdfExported:"PDF exported",
    requiresReview: "Requires doctor's review and signature before use",
    ethicsFlags:    "Ethics & Safety Flags",
    // Output card type labels
    typeRx:       "Prescription",
    typeReport:   "Report",
    typeSchedule: "Schedule",
    typeSummary:  "Summary",
    // Confidence badge
    confLow:    "Low risk",
    confReview: "Review",
    confHigh:   "High risk",
    // Analytics tab
    noAnalytics:     "No analytics yet",
    noAnalyticsHint: "Generate documents from the Chat tab to see your session data",
    kpiTotal:    "Total tasks",
    kpiSession:  "This session",
    kpiAvgScore: "Avg safety score",
    kpiConf:     "Confidence",
    kpiFlags:    "Ethics flags",
    kpiReview:   "Need review",
    kpiTime:     "Time saved",
    kpiVsManual: "vs manual",
    docTypes:       "Document Types",
    safetyTrend:    "Safety Score Trend",
    safetyTrendSub: "Per document · Higher = safer",
    trendHint:      "Generate 2+ documents to see the trend",
    auditLog:       "Audit Log",
    auditClean:     "✓ Clean",
    projectedImpact: "Projected Impact — DMED Integration",
    impactStat1: "Admin time saved",
    impactStat2: "Per document",
    impactStat3: "Tasks per shift",
    impactStat4: "Patient data exposed",
    // Ethics tab
    ethicsTitle:     "Ethics & Safety Framework",
    ethicsSub:       "How DMED Admin AI protects patients and clinicians",
    ethicsLimTitle:  "Known Limitations",
    ethicsLim1: "Rule-based scanning misses novel phrasing — a second LLM pass is recommended for production",
    ethicsLim2: "Confidence scores are heuristic, not clinically validated",
    ethicsLim3: "This is a demo MVP — not approved for clinical use without regulatory review",
    ethicsRule1Title: "No Diagnosis Guarantee",
    ethicsRule1Body:  "The system prompt explicitly forbids final diagnoses. Every output is framed as an administrative draft, never a clinical decision.",
    ethicsRule2Title: "Mandatory Review Watermark",
    ethicsRule2Body:  "Every document includes 'Requires doctor's review and signature' — in the UI, in copied text, and in exported PDFs.",
    ethicsRule3Title: "Real-time Hallucination Scanning",
    ethicsRule3Body:  "6 regex rules scan every output for dangerous patterns: overconfident language, diagnosis claims, emergency terms, dosages, allergy mentions, and PII leakage.",
    ethicsRule4Title: "Anonymisation by Default",
    ethicsRule4Body:  "Patient names are never passed to the AI in clear text. The system prompt instructs the model to anonymise all outputs.",
    ethicsRule5Title: "Confidence Scoring",
    ethicsRule5Body:  "Each output receives a 0–100 safety score based on red-flag density and positive signals. Scores are visible on every document card.",
    ethicsRule6Title: "No Persistent Storage",
    ethicsRule6Body:  "All session data lives in React state — it disappears when the tab closes. No patient data is stored beyond the AI API call.",
    // Badges tab
    achievementsTitle: "Achievements",
    achievementsOf:    "of",
    achievementsEarned:"earned this session",
    sessionStats:      "Session Stats",
    statPrescriptions: "💊 Prescriptions",
    statReports:       "📋 Reports",
    statSchedules:     "📅 Schedules",
    statPdfsExported:  "📤 PDFs exported",
    statTotalTasks:    "✅ Total tasks",
    // Badges
    badge1Label: "First Prescription", badge1Desc: "Generated your first prescription",
    badge2Label: "Speed Clinician",    badge2Desc: "Completed 5 tasks in a session",
    badge3Label: "Report Writer",      badge3Desc: "Generated 3 reports",
    badge4Label: "Shift Master",       badge4Desc: "Created 2 schedules",
    badge5Label: "PDF Publisher",      badge5Desc: "Exported your first PDF",
    badge6Label: "Efficiency Pro",     badge6Desc: "Completed 10 total tasks",
    badgeUnlocked: "Achievement Unlocked",
    badgeContinue: "Continue",
    // Tour
    tourNext: "Next →",
    tourDone: "Done ✓",
    tourSkip: "Skip",
    tour1Title: "Step 1 · Select a Patient",
    tour1Body:  "Open the patient selector to load a DMED record. The AI will use their vitals, complaint, meds, and allergies automatically.",
    tour2Title: "Step 2 · Quick Actions",
    tour2Body:  "These buttons instantly generate a document using the selected patient's real data — no typing required.",
    tour3Title: "Step 3 · Type a Request",
    tour3Body:  "Type any clinical instruction and press Send. The AI drafts the document in the chosen language.",
    tour4Title: "Step 4 · Review Documents",
    tour4Body:  "Each document shows a safety confidence score, ethics flags, and one-click PDF export.",
    tour5Title: "Step 5 · Analytics",
    tour5Body:  "Track your session impact — tasks completed, average confidence score, time saved.",
    tour6Title: "Step 6 · Ethics Framework",
    tour6Body:  "Full transparency on every safety guardrail — essential for clinical governance.",
    tour7Title: "Step 7 · Achievements",
    tour7Body:  "Complete tasks to earn badges — gamification keeps clinicians engaged.",
    // Keyboard shortcuts bar
    kbTabs:  "Tabs",
    kbSend:  "Send",
    kbDemo:  "Demo",
    kbClose: "Close",
    // Reload button in error boundary
    reloadApp: "Reload App",
  },

  uz: {
    appTitle: "DMED Admin AI",
    appSub:   "O'zbekiston Sog'liqni Saqlash Tizimi",
    demoBtn:  "Demo tur",
    statRx:     "Retsept",
    statRep:    "Hisobotlar",
    statPdf:    "PDF",
    statBadges: "Yutuqlar",
    tabChat:    "Chat",
    tabOutputs: "Hujjatlar",
    tabBadges:  "Yutuqlar",
    tabMetrics: "Tahlil",
    tabEthics:  "Etika",
    loadPatient: "Bemor tanlash",
    mockLabel:   "MOCK DMED YOZUVLARI — Faqat demo",
    patientCleared: "Bemor tozalandi",
    qpRx:       "Retsept",
    qpSummary:  "Xulosa",
    qpSchedule: "Navbat jadvali",
    qpLab:      "Lab hisoboti",
    qpRxInstr:       "Ushbu bemor uchun uning ko'rsatkichlari, dori-darmonlari, allergiyalari va asosiy shikoyati asosida retsept tayyorlang.",
    qpSummaryInstr:  "Ushbu bemor uchun qisqa klinik xulosa yozing: asosiy shikoyat, hayot ko'rsatkichlari, joriy dorilar va allergiyalar.",
    qpScheduleInstr: "3 shifokor va 4 hamshira uchun 5 kunlik navbat jadvalini tuzing.",
    qpLabInstr:      "KQA va metabolik panel uchun laboratoriya hisoboti shablonini yarating.",
    qpRxFallback:       "45 yoshli erkak bemor uchun ko'krak og'rig'i va QB 140/90 bilan retsept tayyorlang.",
    qpSummaryFallback:  "Xulosa: T 38.5°C, yo'tal 5 kun, SpO2 96%, kasalliklar yo'q.",
    qpScheduleFallback: "3 shifokor va 4 hamshira uchun 5 kunlik navbat jadvalini tuzing.",
    qpLabFallback:      "KQA va metabolik panel uchun laboratoriya hisoboti shablonini yarating.",
    placeholder: "Bemor holatini tasvirlab bering yoki so'rovingizni yozing…",
    send:        "Yuborish",
    disclaimer:  "AI natijalari faqat ma'muriy qoralamalar. Barcha hujjatlar klinisyen ko'rib chiqishini va imzosini talab qiladi.",
    greeting:    "Salom 👋 Men DMED Ma'muriy Yordamchisiman. Yuqoridan bemor kartasini tanlang, so'ng tezkor tugmalar yoki matn orqali so'rov yuboring — retsept, xulosa, jadval yoki laboratoriya hisoboti.",
    patientLoaded:   "Bemor yuklandi",
    chiefComplaint:  "Asosiy shikoyat",
    contextActive:   "Keyingi so'rovda kontekst ishlatiladi",
    docReady:   "Hujjat tayyor",
    seeDocTab:  "— Hujjatlar tabiga qarang.",
    errorMsg:   "Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
    offlineBanner: "Internet aloqasi yo'q — AI funksiyalari mavjud emas",
    noDocsYet:  "Hujjatlar yo'q",
    noDocsHint: "Chat tabidan tezkor tugmalar yoki matn orqali so'rov yuboring",
    copyBtn:    "Nusxa",
    pdfBtn:     "PDF",
    copied:     "Buferga nusxalandi",
    pdfExported:"PDF eksport qilindi",
    requiresReview: "Foydalanishdan oldin shifokor ko'rib chiqishi va imzosi talab qilinadi",
    ethicsFlags:    "Etika va Xavfsizlik Bayroqlari",
    typeRx:       "Retsept",
    typeReport:   "Hisobot",
    typeSchedule: "Jadval",
    typeSummary:  "Xulosa",
    confLow:    "Past xavf",
    confReview: "Ko'rib chiqish",
    confHigh:   "Yuqori xavf",
    noAnalytics:     "Tahlil yo'q",
    noAnalyticsHint: "Ko'rsatkichlarni ko'rish uchun Chat tabidan hujjatlar yarating",
    kpiTotal:    "Jami vazifalar",
    kpiSession:  "Bu sessiyada",
    kpiAvgScore: "O'rtacha xavfsizlik",
    kpiConf:     "Ishonchlilik",
    kpiFlags:    "Etika bayroqlari",
    kpiReview:   "Ko'rib chiqish kerak",
    kpiTime:     "Tejilgan vaqt",
    kpiVsManual: "qo'lda nisbatan",
    docTypes:       "Hujjat turlari",
    safetyTrend:    "Xavfsizlik ko'rsatkichi tendentsiyasi",
    safetyTrendSub: "Har bir hujjat · Yuqori = xavfsizroq",
    trendHint:      "Tendentsiyani ko'rish uchun 2+ hujjat yarating",
    auditLog:       "Audit jurnali",
    auditClean:     "✓ Toza",
    projectedImpact: "Kutilayotgan ta'sir — DMED integratsiyasi",
    impactStat1: "Ma'muriy vaqt tejaldi",
    impactStat2: "Har bir hujjat",
    impactStat3: "Navbatdagi vazifalar",
    impactStat4: "Bemor ma'lumotlari ochilmagan",
    ethicsTitle:     "Etika va Xavfsizlik Tizimi",
    ethicsSub:       "DMED Admin AI bemorlar va shifokorlarni qanday himoya qiladi",
    ethicsLimTitle:  "Ma'lum cheklovlar",
    ethicsLim1: "Qoidalarga asoslangan skanerlash yangi iboralarni o'tkazib yuborishi mumkin",
    ethicsLim2: "Ishonchlilik ballari evristik bo'lib, klinik jihatdan tasdiqlanmagan",
    ethicsLim3: "Bu demo MVP — me'yoriy ko'rib chiqishsiz klinik foydalanish uchun tavsiya etilmaydi",
    ethicsRule1Title: "Tashxis yo'q kafolati",
    ethicsRule1Body:  "Tizim prompti yakuniy tashxislarni qat'iyan taqiqlaydi. Har bir natija ma'muriy qoralama sifatida taqdim etiladi.",
    ethicsRule2Title: "Majburiy ko'rib chiqish belgisi",
    ethicsRule2Body:  "Har bir hujjatda 'Shifokor ko'rib chiqishi va imzosi talab qilinadi' degan yozuv mavjud.",
    ethicsRule3Title: "Real vaqtda gallyutsinatsiyalarni skanerlash",
    ethicsRule3Body:  "6 ta regex qoidasi har bir natijani xavfli naqshlar uchun tekshiradi.",
    ethicsRule4Title: "Sukut bo'yicha anonimlashtirish",
    ethicsRule4Body:  "Bemor ismlari AI ga aniq matn sifatida yuborilmaydi.",
    ethicsRule5Title: "Ishonchlilik balli",
    ethicsRule5Body:  "Har bir natija 0–100 xavfsizlik ballini oladi. Balllar har bir hujjat kartasida ko'rinadi.",
    ethicsRule6Title: "Doimiy saqlash yo'q",
    ethicsRule6Body:  "Barcha sessiya ma'lumotlari React holatida saqlanadi — tab yopilganda yo'qoladi.",
    achievementsTitle: "Yutuqlar",
    achievementsOf:    "dan",
    achievementsEarned:"bu sessiyada qozonildi",
    sessionStats:      "Sessiya statistikasi",
    statPrescriptions: "💊 Retseptlar",
    statReports:       "📋 Hisobotlar",
    statSchedules:     "📅 Jadvallar",
    statPdfsExported:  "📤 PDF eksport",
    statTotalTasks:    "✅ Jami vazifalar",
    badge1Label: "Birinchi Retsept",   badge1Desc: "Birinchi retseptingizni yaratdingiz",
    badge2Label: "Tez Shifokor",       badge2Desc: "Sessiyada 5 ta vazifa bajarildı",
    badge3Label: "Hisobot Yozuvchisi", badge3Desc: "3 ta hisobot yaratildi",
    badge4Label: "Jadval Ustasi",      badge4Desc: "2 ta jadval yaratildi",
    badge5Label: "PDF Nashriyotchi",   badge5Desc: "Birinchi PDF eksport qilindi",
    badge6Label: "Samaradorlik Pro",   badge6Desc: "Jami 10 ta vazifa bajarildi",
    badgeUnlocked: "Yutuq Qozonildi",
    badgeContinue: "Davom etish",
    tourNext: "Keyingi →",
    tourDone: "Tugatish ✓",
    tourSkip: "O'tkazish",
    tour1Title: "1-qadam · Bemorni tanlang",
    tour1Body:  "Bemor selectorini oching va DMED yozuvini yuklang. AI ularning ma'lumotlaridan avtomatik foydalanadi.",
    tour2Title: "2-qadam · Tezkor amallar",
    tour2Body:  "Bu tugmalar tanlangan bemorning haqiqiy ma'lumotlaridan foydalanib darhol hujjat yaratadi.",
    tour3Title: "3-qadam · So'rov yozing",
    tour3Body:  "Har qanday klinik ko'rsatmani yozing va Yuborish tugmasini bosing.",
    tour4Title: "4-qadam · Hujjatlarni ko'rib chiqing",
    tour4Body:  "Har bir hujjatda xavfsizlik balli, etika bayroqlari va PDF tugmasi mavjud.",
    tour5Title: "5-qadam · Tahlil",
    tour5Body:  "Sessiya ta'sirini kuzating — bajarilgan vazifalar, o'rtacha ishonchlilik, tejilgan vaqt.",
    tour6Title: "6-qadam · Etika tizimi",
    tour6Body:  "Har bir xavfsizlik kafolati bo'yicha to'liq shaffoflik.",
    tour7Title: "7-qadam · Yutuqlar",
    tour7Body:  "Vazifalarni bajaring va yutuq nishonlarini qozoniting.",
    kbTabs:  "Tablar",
    kbSend:  "Yuborish",
    kbDemo:  "Demo",
    kbClose: "Yopish",
    reloadApp: "Ilovani qayta yuklash",
  },

  ru: {
    appTitle: "DMED Admin AI",
    appSub:   "Система Здравоохранения Узбекистана",
    demoBtn:  "Демо-тур",
    statRx:     "Рецепты",
    statRep:    "Отчёты",
    statPdf:    "PDF",
    statBadges: "Значки",
    tabChat:    "Чат",
    tabOutputs: "Документы",
    tabBadges:  "Достижения",
    tabMetrics: "Аналитика",
    tabEthics:  "Этика",
    loadPatient: "Выбрать пациента",
    mockLabel:   "ДЕМО-ДАННЫЕ DMED — Только для демонстрации",
    patientCleared: "Пациент сброшен",
    qpRx:       "Рецепт",
    qpSummary:  "Сводка",
    qpSchedule: "График дежурств",
    qpLab:      "Лаб. отчёт",
    qpRxInstr:       "Составьте рецепт для этого пациента на основе его показателей, текущих лекарств, аллергий и основной жалобы.",
    qpSummaryInstr:  "Напишите краткую клиническую сводку для этого пациента: основная жалоба, показатели жизнедеятельности, текущие лекарства, аллергии.",
    qpScheduleInstr: "Составьте 5-дневный график дежурств для 3 врачей и 4 медсестёр.",
    qpLabInstr:      "Создайте шаблон лабораторного отчёта для ОАК и метаболической панели.",
    qpRxFallback:       "Составьте рецепт для пациента мужчина 45 лет с болью в груди и АД 140/90.",
    qpSummaryFallback:  "Резюме: T 38.5°C, кашель 5 дней, SpO2 96%, сопутствующих заболеваний нет.",
    qpScheduleFallback: "Составьте 5-дневный график дежурств для 3 врачей и 4 медсестёр.",
    qpLabFallback:      "Создайте шаблон лабораторного отчёта для ОАК и метаболической панели.",
    placeholder: "Опишите случай пациента или введите запрос…",
    send:        "Отправить",
    disclaimer:  "Результаты ИИ — только административные черновики. Все документы требуют проверки и подписи врача перед использованием.",
    greeting:    "Здравствуйте 👋 Я административный ассистент DMED. Выберите карту пациента выше, затем воспользуйтесь быстрыми кнопками или введите запрос — рецепт, сводку, расписание или лабораторный отчёт.",
    patientLoaded:   "Пациент загружен",
    chiefComplaint:  "Основная жалоба",
    contextActive:   "Контекст будет использован в следующем запросе",
    docReady:   "Документ готов",
    seeDocTab:  "— перейдите на вкладку Документы.",
    errorMsg:   "Что-то пошло не так. Пожалуйста, попробуйте снова.",
    offlineBanner: "Нет подключения к интернету — функции ИИ недоступны",
    noDocsYet:  "Документов пока нет",
    noDocsHint: "Используйте быстрые кнопки или введите запрос на вкладке Чат",
    copyBtn:    "Копировать",
    pdfBtn:     "PDF",
    copied:     "Скопировано в буфер",
    pdfExported:"PDF экспортирован",
    requiresReview: "Требует проверки и подписи врача перед использованием",
    ethicsFlags:    "Флаги этики и безопасности",
    typeRx:       "Рецепт",
    typeReport:   "Отчёт",
    typeSchedule: "Расписание",
    typeSummary:  "Сводка",
    confLow:    "Низкий риск",
    confReview: "Проверить",
    confHigh:   "Высокий риск",
    noAnalytics:     "Нет данных аналитики",
    noAnalyticsHint: "Создайте документы на вкладке Чат, чтобы увидеть показатели",
    kpiTotal:    "Всего задач",
    kpiSession:  "В этой сессии",
    kpiAvgScore: "Средний балл безоп.",
    kpiConf:     "Уверенность",
    kpiFlags:    "Флаги этики",
    kpiReview:   "Нужна проверка",
    kpiTime:     "Сэкономлено времени",
    kpiVsManual: "vs вручную",
    docTypes:       "Типы документов",
    safetyTrend:    "Тенденция оценки безопасности",
    safetyTrendSub: "На документ · Выше = безопаснее",
    trendHint:      "Создайте 2+ документа, чтобы увидеть тенденцию",
    auditLog:       "Журнал аудита",
    auditClean:     "✓ Чисто",
    projectedImpact: "Прогнозируемое влияние — интеграция DMED",
    impactStat1: "Сэкономлено адм. времени",
    impactStat2: "На документ",
    impactStat3: "Задач за смену",
    impactStat4: "Данных пациентов раскрыто",
    ethicsTitle:     "Этика и система безопасности",
    ethicsSub:       "Как DMED Admin AI защищает пациентов и клиницистов",
    ethicsLimTitle:  "Известные ограничения",
    ethicsLim1: "Правиловое сканирование пропускает новые формулировки — рекомендуется второй проход LLM для продакшна",
    ethicsLim2: "Оценки уверенности являются эвристическими, не валидированными клинически",
    ethicsLim3: "Это демонстрационный MVP — не одобрен для клинического использования без регуляторной проверки",
    ethicsRule1Title: "Гарантия отсутствия диагноза",
    ethicsRule1Body:  "Системный промпт явно запрещает окончательные диагнозы. Каждый вывод оформляется как административный черновик.",
    ethicsRule2Title: "Обязательный водяной знак проверки",
    ethicsRule2Body:  "Каждый документ содержит 'Требует проверки и подписи врача' — в интерфейсе, скопированном тексте и PDF.",
    ethicsRule3Title: "Сканирование галлюцинаций в реальном времени",
    ethicsRule3Body:  "6 правил regex проверяют каждый вывод на опасные паттерны: самоуверенный язык, диагнозы, экстренные термины, дозировки, аллергии, ПДн.",
    ethicsRule4Title: "Анонимизация по умолчанию",
    ethicsRule4Body:  "Имена пациентов никогда не передаются ИИ в открытом виде. Системный промпт инструктирует модель анонимизировать все выводы.",
    ethicsRule5Title: "Оценка уверенности",
    ethicsRule5Body:  "Каждый вывод получает оценку безопасности 0–100 на основе плотности красных флагов. Оценки видны на каждой карточке документа.",
    ethicsRule6Title: "Нет постоянного хранения",
    ethicsRule6Body:  "Все данные сессии хранятся в состоянии React — исчезают при закрытии вкладки. Данные пациентов не хранятся за пределами API-вызова.",
    achievementsTitle: "Достижения",
    achievementsOf:    "из",
    achievementsEarned:"заработано в этой сессии",
    sessionStats:      "Статистика сессии",
    statPrescriptions: "💊 Рецепты",
    statReports:       "📋 Отчёты",
    statSchedules:     "📅 Расписания",
    statPdfsExported:  "📤 PDF экспортировано",
    statTotalTasks:    "✅ Всего задач",
    badge1Label: "Первый Рецепт",      badge1Desc: "Создали первый рецепт",
    badge2Label: "Быстрый Клиницист",  badge2Desc: "Выполнено 5 задач за сессию",
    badge3Label: "Автор Отчётов",      badge3Desc: "Создано 3 отчёта",
    badge4Label: "Мастер Расписаний",  badge4Desc: "Создано 2 расписания",
    badge5Label: "PDF Издатель",       badge5Desc: "Экспортирован первый PDF",
    badge6Label: "Профи Эффективности",badge6Desc: "Выполнено 10 задач всего",
    badgeUnlocked: "Достижение разблокировано",
    badgeContinue: "Продолжить",
    tourNext: "Далее →",
    tourDone: "Готово ✓",
    tourSkip: "Пропустить",
    tour1Title: "Шаг 1 · Выберите пациента",
    tour1Body:  "Откройте селектор пациента и загрузите запись DMED. ИИ будет автоматически использовать их данные.",
    tour2Title: "Шаг 2 · Быстрые действия",
    tour2Body:  "Эти кнопки мгновенно создают документ с реальными данными выбранного пациента.",
    tour3Title: "Шаг 3 · Введите запрос",
    tour3Body:  "Введите клиническое указание и нажмите Отправить.",
    tour4Title: "Шаг 4 · Проверьте документы",
    tour4Body:  "Каждый документ показывает оценку безопасности, флаги этики и кнопку PDF.",
    tour5Title: "Шаг 5 · Аналитика",
    tour5Body:  "Отслеживайте влияние сессии — задачи, уверенность, сэкономленное время.",
    tour6Title: "Шаг 6 · Этическая система",
    tour6Body:  "Полная прозрачность каждого защитного механизма.",
    tour7Title: "Шаг 7 · Достижения",
    tour7Body:  "Выполняйте задачи и зарабатывайте значки.",
    kbTabs:  "Вкладки",
    kbSend:  "Отправить",
    kbDemo:  "Демо",
    kbClose: "Закрыть",
    reloadApp: "Перезагрузить",
  },
};

// ── DEMO TOUR STEPS — built from t() so they translate with language ──────────
function getDemoSteps(t) {
  return [
    { target:"toolbar",     title:t("tour1Title"), body:t("tour1Body"), tab:"chat"    },
    { target:"quickprompt", title:t("tour2Title"), body:t("tour2Body"), tab:"chat"    },
    { target:"chatinput",   title:t("tour3Title"), body:t("tour3Body"), tab:"chat"    },
    { target:"outputs",     title:t("tour4Title"), body:t("tour4Body"), tab:"outputs" },
    { target:"metricstab",  title:t("tour5Title"), body:t("tour5Body"), tab:"metrics" },
    { target:"ethicstab",   title:t("tour6Title"), body:t("tour6Body"), tab:"ethics"  },
    { target:"badges",      title:t("tour7Title"), body:t("tour7Body"), tab:"badges"  },
  ];
}

// ── ETHICS ENGINE ─────────────────────────────────────────────────────────────
const ETHICS_RULES = [
  { id:"diagnosis", severity:"high",   pattern:/\b(you have|patient has|diagnosis is|diagnosed with|confirms? (that|the))\b/i, label:"Possible diagnosis claim", desc:"AI may be making a clinical diagnosis. Review carefully." },
  { id:"certainty", severity:"high",   pattern:/\b(definitely|certainly|guaranteed|100%|always take|must take)\b/i,           label:"Overconfident language",   desc:"Absolute language found. Medical outputs should express uncertainty." },
  { id:"drugdose",  severity:"medium", pattern:/\b(\d+\s?mg|\d+\s?mcg|\d+\s?ml)\b/i,                                         label:"Specific dosage detected", desc:"Contains dosage values — must be verified by a licensed clinician." },
  { id:"allergy",   severity:"medium", pattern:/\b(allerg|contraindicated|do not (use|take|give))\b/i,                        label:"Allergy/contraindication", desc:"References allergies or contraindications — cross-check patient record." },
  { id:"emergency", severity:"high",   pattern:/\b(emergency|urgent|immediate(ly)?|call (an )?ambulance|life.?threatening)\b/i,label:"Emergency language",       desc:"Document contains emergency language — escalate to senior staff." },
  { id:"pii",       severity:"medium", pattern:/\b([A-Z][a-z]+ [A-Z][a-z]+|DOB|date of birth|\b\d{2}\/\d{2}\/\d{4}\b)\b/,   label:"Possible PII detected",    desc:"Output may contain identifiable information. Anonymize before sharing." },
];

function scoreOutput(content, warnings, type) {
  let score = 100;
  const flags = [];
  ETHICS_RULES.forEach(rule => {
    if (rule.pattern.test(content)) { score -= rule.severity==="high" ? 20 : 10; flags.push(rule); }
  });
  if (warnings?.length > 0)                        score += 5;
  if (/review|clinician|doctor/i.test(content))    score += 5;
  if (type === "schedule")                          score += 10;
  return { score: Math.min(100, Math.max(0, score)), flags };
}

// ── DATA ──────────────────────────────────────────────────────────────────────
const MOCK_PATIENTS = [
  { id:"UZ-2024-0041", name:"Anon Patient A", age:45, sex:"M", bp:"140/90",  temp:"37.2°C", complaint:"Chest pain, shortness of breath, radiating to left arm",           meds:"None",              allergies:"Penicillin"  },
  { id:"UZ-2024-0078", name:"Anon Patient B", age:32, sex:"F", bp:"118/76",  temp:"38.5°C", complaint:"Persistent cough 5 days, SpO2 96%, fatigue",                         meds:"None",              allergies:"None"        },
  { id:"UZ-2024-0112", name:"Anon Patient C", age:67, sex:"M", bp:"160/100", temp:"36.8°C", complaint:"Type 2 diabetes follow-up, elevated fasting glucose 11.2 mmol/L",    meds:"Metformin 500mg",   allergies:"Sulfa drugs" },
  { id:"UZ-2024-0155", name:"Anon Patient D", age:28, sex:"F", bp:"110/70",  temp:"37.0°C", complaint:"Post-op day 3 appendectomy, wound check, mild pain",                 meds:"Ibuprofen 400mg PRN",allergies:"None"       },
  { id:"UZ-2024-0199", name:"Anon Patient E", age:54, sex:"M", bp:"135/85",  temp:"36.9°C", complaint:"Hypertension review, headache, dizziness",                           meds:"Amlodipine 5mg",    allergies:"Aspirin"     },
];

// Badges no longer include voice
function getBadges(t) {
  return [
    { id:"first",     icon:"🩺", label:t("badge1Label"), desc:t("badge1Desc"), threshold:1,  type:"prescriptions" },
    { id:"speed",     icon:"⚡", label:t("badge2Label"), desc:t("badge2Desc"), threshold:5,  type:"total"         },
    { id:"reporter",  icon:"📋", label:t("badge3Label"), desc:t("badge3Desc"), threshold:3,  type:"reports"       },
    { id:"scheduler", icon:"📅", label:t("badge4Label"), desc:t("badge4Desc"), threshold:2,  type:"schedules"     },
    { id:"export",    icon:"📤", label:t("badge5Label"), desc:t("badge5Desc"), threshold:1,  type:"exports"       },
    { id:"pro",       icon:"🏆", label:t("badge6Label"), desc:t("badge6Desc"), threshold:10, type:"total"         },
  ];
}

// ── AI CALLER ─────────────────────────────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

async function callAI(userMessage, lang, patientContext) {
  // FIX #2: patientContext is now always passed through and always injected.
  // The quick-prompt buttons call handleSend(text) which calls callAI(text, lang, activePatient).
  // activePatient is the currently selected patient — it changes per selection.
  const patientBlock = patientContext
    ? `Patient on file: ${patientContext.age}y ${patientContext.sex}, BP ${patientContext.bp}, Temp ${patientContext.temp}. Current medications: ${patientContext.meds}. Known allergies: ${patientContext.allergies}. Chief complaint: ${patientContext.complaint}.`
    : "";

  const langLabel = lang === "uz" ? "Uzbek" : lang === "ru" ? "Russian" : "English";

  // Always inject today's date — AI must never write [SANA], [DATE], or any placeholder
  const today = new Date().toLocaleDateString(
    lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-GB",
    { year:"numeric", month:"long", day:"numeric" }
  );

  const systemInstruction = `You are a medical documentation assistant integrated into Uzbekistan's DMED hospital system.
You are ONLY talking to licensed doctors and nurses — never to patients directly.
Your sole function is generating structured administrative paperwork drafts for clinician review.
You do NOT give patient advice. You do NOT explain conditions. You draft documents.
All output is reviewed and signed by a licensed doctor before it reaches any patient.
Output language: ${langLabel}.
Today's date: ${today}. Always use this exact date in all documents. Never write [SANA], [DATE], [ДАТА], or any bracketed placeholder for the date.

DOCUMENT RULES:
- Write exactly as a doctor writes: clinical, concise, no fluff
- Prescriptions: one medication per line with dose / route / frequency / duration
- Use standard abbreviations: PO, IV, PRN, OD, BID, TID, q8h, mg, mcg
- Summaries: 3–5 sentences, objective, third person ("Patient presents with…")
- Schedules: plain-text table with shifts and names
- End every prescription with the language-appropriate sign-off line

STRICT OUTPUT CONTRACT:
Respond with ONE valid JSON object only. No text before or after. No markdown fences.
{"type":"prescription"|"report"|"schedule"|"summary","title":"Short title","content":"Full document text — use \\n for line breaks","warnings":[],"requires_review":true}

EXAMPLE (Uzbek prescription, real date used):
{"type":"prescription","title":"Retsept — Gipertoniya va ko'krak og'rig'i","content":"Bemor: Erkak, 45 yosh\\nSana: ${today}\\nMuassasa: DMED\\n\\nRx:\\n1. Aspirin 100 mg — PO, kuniga 1 marta, 30 kun\\n2. Amlodipin 5 mg — PO, kuniga 1 marta, 30 kun\\n3. Izosorbid mononitrat 20 mg — PO, kuniga 2 marta, 14 kun\\n\\nTekshiruvlar: EKG, UAK, lipidlar\\n\\nKo'rib chiqdi va imzoladi: _____________  Sana: ${today}","warnings":["Nitrat terapiyasidan oldin EKG talab etiladi"],"requires_review":true}`;

  const wrappedMessage = `[DOCTOR REQUEST — DRAFT DOCUMENT ONLY]\n${patientBlock ? patientBlock + "\n" : ""}Doctor's instruction: ${userMessage}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: [{ role:"user", parts:[{ text: wrappedMessage }] }],
    config: {
      systemInstruction,
      maxOutputTokens: 800,
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return { type:"summary", title:"Response", content: raw || "No response received.", warnings:["Could not parse structured response"], requires_review:true };
  }
}

// ── PDF EXPORT ────────────────────────────────────────────────────────────────
function loadJsPDF() {
  return new Promise(resolve => {
    if (window.jspdf) return resolve(window.jspdf.jsPDF);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve(window.jspdf.jsPDF);
    document.head.appendChild(s);
  });
}

async function exportToPDF(item) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF();
  const M = 20; let y = M;
  doc.setFillColor(26,115,232); doc.rect(0,0,210,24,"F");
  doc.setFillColor(249,171,0);  doc.rect(0,24,210,3,"F");
  doc.setTextColor(255,255,255); doc.setFontSize(12); doc.setFont("helvetica","bold");
  doc.text("DMED Admin AI — Document Export", M, 15);
  y = 36;
  doc.setTextColor(28,30,33); doc.setFontSize(16);
  doc.text(item.title, M, y); y += 8;
  doc.setFillColor(232,240,254); doc.roundedRect(M, y, 40, 7, 2, 2, "F");
  doc.setFontSize(8); doc.setTextColor(26,115,232);
  doc.text(item.type.toUpperCase(), M+4, y+5); y += 14;
  doc.setDrawColor(225,232,240); doc.line(M, y, 190, y); y += 8;
  doc.setTextColor(28,30,33); doc.setFontSize(10); doc.setFont("helvetica","normal");
  doc.splitTextToSize(item.content, 170).forEach(line => {
    if (y > 270) { doc.addPage(); y = M; }
    doc.text(line, M, y); y += 5.5;
  });
  if (item.warnings?.length) {
    y += 4;
    doc.setFillColor(254,243,226); doc.rect(M, y-3, 170, item.warnings.length*7+8, "F");
    doc.setTextColor(176,96,0); doc.setFont("helvetica","bold");
    doc.text("Warnings", M+4, y+3); y += 9; doc.setFont("helvetica","normal");
    item.warnings.forEach(w => { doc.text(`• ${w}`, M+4, y); y += 7; });
  }
  y += 8;
  doc.setDrawColor(225,232,240); doc.line(M, y, 190, y); y += 6;
  doc.setFontSize(8); doc.setTextColor(154,163,175);
  doc.text("REQUIRES DOCTOR REVIEW AND SIGNATURE BEFORE CLINICAL USE", M, y);
  doc.text(`Generated: ${new Date().toLocaleString()} | DMED Admin AI`, M, y+5);
  doc.save(`${item.title.replace(/\s+/g,"_")}.pdf`);
}

// ── PATIENT SELECTOR ──────────────────────────────────────────────────────────
function PatientSelector({ patients, selected, onSelect, onClear, t }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display:"flex", alignItems:"center", gap:8, padding:"7px 14px",
        borderRadius:8, cursor:"pointer",
        background: selected ? DS.primaryLight : DS.surface,
        border: `1.5px solid ${selected ? DS.primary : DS.border}`,
        fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13,
        color: selected ? DS.primary : DS.textSec, transition:"all 0.2s",
        boxShadow: selected ? `0 0 0 3px ${DS.primaryLight}` : "none",
      }}>
        <span style={{ fontSize:14 }}>👤</span>
        {selected ? selected.id : t("loadPatient")}
        <span style={{ fontSize:10, opacity:0.6 }}>{open ? "▲" : "▼"}</span>
      </button>
      {selected && (
        <button onClick={onClear} style={{ position:"absolute", top:-5, right:-5, width:18, height:18, borderRadius:"50%", background:DS.danger, border:"2px solid white", color:"white", fontSize:9, cursor:"pointer", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
      )}
      {open && (
        <div style={{ position:"absolute", top:"110%", left:0, zIndex:300, background:DS.surface, border:`1px solid ${DS.border}`, borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.1)", minWidth:380, overflow:"hidden", animation:"slideIn 0.18s ease" }}>
          <div style={{ padding:"8px 14px", background:DS.primaryLight, fontSize:11, fontWeight:700, color:DS.primary, letterSpacing:0.3 }}>
            🏥 {t("mockLabel")}
          </div>
          {patients.map(p => (
            <div key={p.id}
              onClick={() => { onSelect(p); setOpen(false); }}
              style={{ padding:"11px 14px", cursor:"pointer", borderBottom:`1px solid ${DS.border}`, transition:"background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = DS.surfaceAlt}
              onMouseLeave={e => e.currentTarget.style.background = "white"}
            >
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontWeight:600, fontSize:13, color:DS.text }}>{p.name}</span>
                <span style={{ fontSize:11, color:DS.textMuted, fontFamily:"'JetBrains Mono',monospace" }}>{p.id}</span>
              </div>
              <div style={{ fontSize:12, color:DS.textSec }}>
                {p.age}y {p.sex} · BP {p.bp} · {p.complaint.slice(0,52)}…
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CONFIDENCE BADGE ──────────────────────────────────────────────────────────
function ConfidenceBadge({ score, t }) {
  const color = score >= 80 ? DS.success : score >= 55 ? DS.warning : DS.danger;
  const bg    = score >= 80 ? DS.successBg : score >= 55 ? DS.warningBg : DS.dangerBg;
  const label = score >= 80 ? t("confLow") : score >= 55 ? t("confReview") : t("confHigh");
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"2px 8px", borderRadius:20, background:bg }}>
      <div style={{ width:40, height:4, borderRadius:2, background:`${color}30`, overflow:"hidden" }}>
        <div style={{ width:`${score}%`, height:"100%", background:color, borderRadius:2, transition:"width 0.6s ease" }} />
      </div>
      <span style={{ fontSize:11, fontWeight:600, color, whiteSpace:"nowrap" }}>{label} {score}%</span>
    </div>
  );
}

// ── OUTPUT CARD ───────────────────────────────────────────────────────────────
function OutputCard({ item, onCopy, onExport, t }) {
  const [exporting,  setExporting]  = useState(false);
  const [showFlags,  setShowFlags]  = useState(false);

  // Type metadata uses translated labels from t()
  const TYPE_META = {
    prescription: { label: t("typeRx"),       dot: "#F9AB00" },
    report:       { label: t("typeReport"),   dot: "#1A73E8" },
    schedule:     { label: t("typeSchedule"), dot: "#1E8A4C" },
    summary:      { label: t("typeSummary"),  dot: "#7C4DFF" },
  };
  const meta = TYPE_META[item.type] || TYPE_META.summary;

  const handleExport = async () => { setExporting(true); await exportToPDF(item); onExport(); setExporting(false); };
  const { score, flags } = useMemo(() => scoreOutput(item.content, item.warnings, item.type), [item]);

  return (
    <div style={{ background:DS.surface, border:`1px solid ${DS.border}`, borderRadius:12, overflow:"hidden", marginBottom:12, boxShadow:"0 2px 8px rgba(0,0,0,0.04)", animation:"slideIn 0.3s ease" }}>
      <div style={{ height:3, background:`linear-gradient(90deg,${meta.dot},${meta.dot}88)` }} />
      <div style={{ padding:"14px 18px" }}>
        {/* Title row */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12, gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", minWidth:0 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:meta.dot, flexShrink:0, display:"inline-block" }} />
            <span style={{ fontWeight:600, fontSize:14, color:DS.text, fontFamily:"'DM Sans',sans-serif" }}>{item.title}</span>
            <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:4, background:DS.surfaceAlt, color:DS.textSec, textTransform:"uppercase", letterSpacing:0.5, border:`1px solid ${DS.border}` }}>{meta.label}</span>
            <ConfidenceBadge score={score} t={t} />
          </div>
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            {flags.length > 0 && (
              <button onClick={() => setShowFlags(f => !f)} style={{ background:DS.warningBg, border:`1px solid ${DS.accent}55`, borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:12, color:DS.warning, fontWeight:600 }}>
                🚩 {flags.length}
              </button>
            )}
            <button onClick={() => onCopy(item.content)} style={{ background:DS.surfaceAlt, border:`1px solid ${DS.border}`, borderRadius:6, padding:"4px 12px", cursor:"pointer", fontSize:12, color:DS.textSec, fontWeight:500 }}>{t("copyBtn")}</button>
            <button onClick={handleExport} disabled={exporting} style={{ background:DS.primary, border:"none", borderRadius:6, padding:"4px 14px", cursor:"pointer", fontSize:12, color:"white", fontWeight:600, opacity:exporting?0.6:1 }}>{exporting ? "…" : t("pdfBtn")}</button>
          </div>
        </div>

        {/* Ethics flags panel */}
        {showFlags && flags.length > 0 && (
          <div style={{ marginBottom:12, borderRadius:8, border:`1px solid ${DS.accent}44`, overflow:"hidden", animation:"slideIn 0.2s ease" }}>
            <div style={{ padding:"7px 12px", background:DS.warningBg, fontSize:11, fontWeight:700, color:DS.warning }}>{t("ethicsFlags")}</div>
            {flags.map(f => (
              <div key={f.id} style={{ padding:"8px 12px", borderTop:`1px solid ${DS.border}`, display:"flex", gap:8, alignItems:"flex-start" }}>
                <span style={{ fontSize:12 }}>{f.severity==="high" ? "🔴" : "🟡"}</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:DS.text }}>{f.label}</div>
                  <div style={{ fontSize:11, color:DS.textSec }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <pre style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12.5, color:DS.text, whiteSpace:"pre-wrap", lineHeight:1.9, margin:0, padding:"12px 14px", background:DS.surfaceAlt, borderRadius:8, border:`1px solid ${DS.border}` }}>{item.content}</pre>

        {item.warnings?.length > 0 && (
          <div style={{ marginTop:10, padding:"8px 12px", background:DS.warningBg, borderRadius:8, borderLeft:`3px solid ${DS.accent}` }}>
            {item.warnings.map((w, i) => <div key={i} style={{ fontSize:12, color:DS.warning }}>⚠ {w}</div>)}
          </div>
        )}
        {item.requires_review && (
          <div style={{ marginTop:8, fontSize:11, color:DS.danger, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:DS.danger, display:"inline-block" }} />
            {t("requiresReview")}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MESSAGE BUBBLE ────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display:"flex", justifyContent:isUser?"flex-end":"flex-start", marginBottom:8, animation:"slideIn 0.2s ease" }}>
      {!isUser && (
        <div style={{ width:30, height:30, borderRadius:8, background:DS.primaryLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, marginRight:8, flexShrink:0, alignSelf:"flex-end", border:`1px solid ${DS.primary}22` }}>🤖</div>
      )}
      <div style={{ maxWidth:"72%", padding:"10px 14px", borderRadius:isUser?"12px 12px 4px 12px":"12px 12px 12px 4px", background:isUser?DS.primary:DS.surface, color:isUser?"white":DS.text, border:isUser?"none":`1px solid ${DS.border}`, fontSize:14, lineHeight:1.6, fontFamily:"'DM Sans',sans-serif", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
        {msg.text}
      </div>
    </div>
  );
}

// ── BADGE CHIP ────────────────────────────────────────────────────────────────
function BadgeChip({ badge, earned }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:10, background:earned?DS.primaryLight:DS.surfaceAlt, border:`1px solid ${earned?DS.primary+"44":DS.border}`, opacity:earned?1:0.5, transition:"all 0.25s" }}>
      <span style={{ fontSize:22 }}>{badge.icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:earned?DS.primary:DS.textSec, fontFamily:"'DM Sans',sans-serif" }}>{badge.label}</div>
        <div style={{ fontSize:11, color:DS.textMuted, marginTop:1 }}>{badge.desc}</div>
      </div>
      {earned && <div style={{ width:20, height:20, borderRadius:"50%", background:DS.primary, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"white" }}>✓</div>}
    </div>
  );
}

// ── METRICS DASHBOARD ─────────────────────────────────────────────────────────
function MetricsDashboard({ outputs, stats, t }) {
  const typeData = useMemo(() => {
    const c = { prescription:0, report:0, schedule:0, summary:0 };
    outputs.forEach(o => { if (c[o.type] !== undefined) c[o.type]++; });
    return [
      { name: t("typeRx"),       value: c.prescription, color: "#F9AB00" },
      { name: t("typeReport"),   value: c.report,       color: "#1A73E8" },
      { name: t("typeSchedule"), value: c.schedule,     color: "#1E8A4C" },
      { name: t("typeSummary"),  value: c.summary,      color: "#7C4DFF" },
    ];
  }, [outputs, t]);

  const avgConf = useMemo(() => {
    if (!outputs.length) return 0;
    return Math.round(outputs.reduce((s, o) => s + scoreOutput(o.content, o.warnings, o.type).score, 0) / outputs.length);
  }, [outputs]);

  const totalFlags = useMemo(() =>
    outputs.reduce((s, o) => s + scoreOutput(o.content, o.warnings, o.type).flags.length, 0),
  [outputs]);

  const confData = useMemo(() =>
    outputs.map((o, i) => ({ name:`#${i+1}`, score: scoreOutput(o.content, o.warnings, o.type).score })).reverse(),
  [outputs]);

  const KPI = ({ icon, value, label, sub, color }) => (
    <div style={{ background:DS.surface, borderRadius:12, padding:"18px 20px", border:`1px solid ${DS.border}`, flex:1, minWidth:110 }}>
      <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:26, fontWeight:700, color:color||DS.primary, fontFamily:"'Geologica',sans-serif", lineHeight:1 }}>{value}</div>
      <div style={{ fontWeight:600, fontSize:13, color:DS.text, marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:DS.textMuted, marginTop:2 }}>{sub}</div>}
    </div>
  );

  if (!outputs.length) return (
    <div style={{ background:DS.surface, borderRadius:12, border:`1px solid ${DS.border}`, padding:56, textAlign:"center" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
      <div style={{ fontWeight:600, fontSize:16, color:DS.text, fontFamily:"'Geologica',sans-serif" }}>{t("noAnalytics")}</div>
      <div style={{ fontSize:13, color:DS.textSec, marginTop:6 }}>{t("noAnalyticsHint")}</div>
    </div>
  );

  const maxV = Math.max(...typeData.map(d => d.value), 1);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, overflowY:"auto", flex:1 }}>
      {/* KPI row */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <KPI icon="✅" value={stats.total}        label={t("kpiTotal")}    sub={t("kpiSession")} />
        <KPI icon="🛡️" value={`${avgConf}%`}      label={t("kpiAvgScore")} sub={t("kpiConf")} color={avgConf>=80?DS.success:avgConf>=55?DS.warning:DS.danger} />
        <KPI icon="🚩" value={totalFlags}          label={t("kpiFlags")}    sub={t("kpiReview")} color={totalFlags>0?DS.warning:DS.success} />
        <KPI icon="⏱️" value="~30%"               label={t("kpiTime")}     sub={t("kpiVsManual")} />
      </div>

      {/* Charts row */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {/* Bar chart */}
        <div style={{ background:DS.surface, borderRadius:12, border:`1px solid ${DS.border}`, padding:"18px 20px", flex:1, minWidth:200 }}>
          <div style={{ fontWeight:600, fontSize:13, color:DS.text, marginBottom:16 }}>{t("docTypes")}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {typeData.map(d => (
              <div key={d.name} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:12, fontWeight:600, color:DS.textSec, width:72, flexShrink:0 }}>{d.name}</span>
                <div style={{ flex:1, height:8, borderRadius:4, background:DS.surfaceAlt, overflow:"hidden" }}>
                  <div style={{ width:`${(d.value/maxV)*100}%`, height:"100%", background:d.color, borderRadius:4, transition:"width 0.5s ease" }} />
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:DS.text, width:20, textAlign:"right" }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Line chart */}
        <div style={{ background:DS.surface, borderRadius:12, border:`1px solid ${DS.border}`, padding:"18px 20px", flex:2, minWidth:240 }}>
          <div style={{ fontWeight:600, fontSize:13, color:DS.text, marginBottom:4 }}>{t("safetyTrend")}</div>
          <div style={{ fontSize:11, color:DS.textMuted, marginBottom:12 }}>{t("safetyTrendSub")}</div>
          {confData.length < 2 ? (
            <div style={{ color:DS.textMuted, fontSize:13, paddingTop:16 }}>{t("trendHint")}</div>
          ) : (() => {
            const W=400, H=80, pad=10;
            const pts = confData.map((d, i) => {
              const x = pad + (i / (confData.length-1)) * (W - pad*2);
              const y = H - pad - ((d.score/100) * (H - pad*2));
              return [x, y, d.score];
            });
            const path = pts.map(([x,y], i) => `${i===0?"M":"L"}${x},${y}`).join(" ");
            return (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:80 }}>
                {[25,50,75].map(v => { const y=H-pad-((v/100)*(H-pad*2)); return <line key={v} x1={pad} y1={y} x2={W-pad} y2={y} stroke={DS.border} strokeWidth={1} strokeDasharray="3,3"/>; })}
                <path d={path} fill="none" stroke={DS.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
                {pts.map(([x,y,score], i) => (
                  <g key={i}>
                    <circle cx={x} cy={y} r={4} fill={score>=80?DS.success:score>=55?DS.warning:DS.danger} stroke="white" strokeWidth={2}/>
                    <text x={x} y={y-8} textAnchor="middle" fontSize={8} fill={DS.textMuted}>{score}</text>
                  </g>
                ))}
              </svg>
            );
          })()}
        </div>
      </div>

      {/* Audit log */}
      <div style={{ background:DS.surface, borderRadius:12, border:`1px solid ${DS.border}`, padding:"18px 20px" }}>
        <div style={{ fontWeight:600, fontSize:13, color:DS.text, marginBottom:12 }}>{t("auditLog")}</div>
        {outputs.map((o, i) => {
          const { score, flags } = scoreOutput(o.content, o.warnings, o.type);
          return (
            <div key={o.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:`1px solid ${DS.border}` }}>
              <span style={{ fontSize:11, color:DS.textMuted, fontFamily:"'JetBrains Mono',monospace", minWidth:28 }}>#{outputs.length-i}</span>
              <span style={{ flex:1, fontSize:13, fontWeight:500, color:DS.text }}>{o.title}</span>
              <span style={{ fontSize:10, color:DS.textMuted, textTransform:"uppercase", letterSpacing:0.5 }}>{o.type}</span>
              <ConfidenceBadge score={score} t={t} />
              <span style={{ fontSize:11, color:flags.length>0?DS.warning:DS.success }}>
                {flags.length > 0 ? `🚩 ${flags.length}` : t("auditClean")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Impact banner */}
      <div style={{ background:`linear-gradient(135deg,${DS.primary},${DS.primaryDark})`, borderRadius:12, padding:"20px 24px", color:"white" }}>
        <div style={{ fontFamily:"'Geologica',sans-serif", fontSize:17, marginBottom:12, fontWeight:600 }}>{t("projectedImpact")}</div>
        <div style={{ display:"flex", gap:28, flexWrap:"wrap" }}>
          {[["~30%",t("impactStat1")],["5 min → 30s",t("impactStat2")],["50+",t("impactStat3")],["0",t("impactStat4")]].map(([val, label]) => (
            <div key={label}>
              <div style={{ fontSize:24, fontWeight:700 }}>{val}</div>
              <div style={{ fontSize:11, opacity:0.75, marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── TOUR OVERLAY ──────────────────────────────────────────────────────────────
function TourOverlay({ steps, step, onNext, onSkip, onTabChange, t }) {
  const s = steps[step];
  if (!s) return null;
  useEffect(() => { onTabChange(s.tab); }, [step]);
  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, pointerEvents:"none" }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(28,30,33,0.5)", pointerEvents:"all" }} onClick={onSkip}/>
      <div style={{ position:"absolute", bottom:80, left:"50%", transform:"translateX(-50%)", background:DS.surface, borderRadius:14, padding:"22px 26px", width:360, boxShadow:"0 24px 60px rgba(0,0,0,0.2)", pointerEvents:"all", animation:"slideIn 0.25s ease", border:`1.5px solid ${DS.primary}`, zIndex:2001 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
          <div style={{ fontWeight:700, fontSize:14, color:DS.primary, fontFamily:"'Geologica',sans-serif" }}>{s.title}</div>
          <button onClick={onSkip} style={{ background:"none", border:"none", cursor:"pointer", color:DS.textMuted, fontSize:18, lineHeight:1 }}>×</button>
        </div>
        <div style={{ fontSize:13, color:DS.textSec, lineHeight:1.7, marginBottom:18 }}>{s.body}</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", gap:4 }}>
            {steps.map((_, i) => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:i===step?DS.primary:DS.border, transition:"background 0.2s" }}/>)}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onSkip} style={{ background:"none", border:`1px solid ${DS.border}`, borderRadius:7, padding:"6px 14px", cursor:"pointer", fontSize:13, color:DS.textSec }}>{t("tourSkip")}</button>
            <button onClick={onNext} style={{ background:DS.primary, border:"none", borderRadius:7, padding:"6px 18px", cursor:"pointer", fontSize:13, color:"white", fontWeight:600 }}>
              {step < steps.length - 1 ? t("tourNext") : t("tourDone")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
function AdminAIAssistantInner() {
  const [messages,       setMessages]       = useState([]);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [outputs,        setOutputs]        = useState([]);
  const [stats,          setStats]          = useState({ prescriptions:0, reports:0, schedules:0, total:0, exports:0 });
  const [lang,           setLang]           = useState("en");
  const [tab,            setTab]            = useState("chat");
  const [toast,          setToast]          = useState(null);
  const [newBadge,       setNewBadge]       = useState(null);
  const [activePatient,  setActivePatient]  = useState(null);
  const [tourStep,       setTourStep]       = useState(-1);
  const chatEndRef = useRef(null);

  // Translation helper — re-reads from STRINGS whenever lang changes
  const t = useCallback((key) => STRINGS[lang]?.[key] ?? STRINGS.en[key], [lang]);

  // Derived data that depends on t() — recalculated on lang change
  const BADGES     = useMemo(() => getBadges(t),    [t]);
  const demoSteps  = useMemo(() => getDemoSteps(t), [t]);

  const isOnline      = useOnlineStatus();
  const earnedBadges  = BADGES.filter(b => stats[b.type] >= b.threshold);

  // Reset greeting when language changes
  useEffect(() => {
    setMessages([{ role:"assistant", text: t("greeting") }]);
  }, [lang]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  // Keyboard shortcuts
  const shortcuts = useMemo(() => ({
    "1":          () => setTab("chat"),
    "2":          () => setTab("outputs"),
    "3":          () => setTab("badges"),
    "4":          () => setTab("metrics"),
    "5":          () => setTab("ethics"),
    "ctrl+enter": () => { if (input.trim() && !loading) handleSend(); },
    "escape":     () => { setTourStep(-1); setNewBadge(null); },
    "ctrl+d":     () => { setTourStep(0); setTab("chat"); },
  }), [input, loading]);
  useKeyboardShortcuts(shortcuts);

  const checkBadges = useCallback((ns) => {
    const prev   = new Set(BADGES.filter(b => stats[b.type] >= b.threshold).map(b => b.id));
    const gained = BADGES.find(b => !prev.has(b.id) && ns[b.type] >= b.threshold);
    if (gained) setNewBadge(gained);
  }, [stats, BADGES]);

  // FIX #2 root: handleSend always passes activePatient into callAI.
  // Quick-prompt buttons call handleSend(promptText) — activePatient is captured from closure.
  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput("");
    setMessages(prev => [...prev, { role:"user", text: msg }]);
    setLoading(true);
    try {
      const result = await callAI(msg, lang, activePatient);
      setMessages(prev => [...prev, { role:"assistant", text: `${t("docReady")}: "${result.title}" ${t("seeDocTab")}` }]);
      setOutputs(prev => [{ ...result, id: Date.now() }, ...prev]);
      const ns = {
        ...stats,
        total:         stats.total + 1,
        prescriptions: stats.prescriptions + (result.type === "prescription" ? 1 : 0),
        reports:       stats.reports       + (result.type === "report"       ? 1 : 0),
        schedules:     stats.schedules     + (result.type === "schedule"     ? 1 : 0),
      };
      checkBadges(ns);
      setStats(ns);
    } catch {
      setMessages(prev => [...prev, { role:"assistant", text: t("errorMsg") }]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportBadge = () => {
    const ns = { ...stats, exports: stats.exports + 1 };
    checkBadges(ns);
    setStats(ns);
    showToast(t("pdfExported"));
  };

  const handleSelectPatient = (p) => {
    setActivePatient(p);
    setMessages(prev => [...prev, {
      role: "assistant",
      text: `${t("patientLoaded")}: ${p.name} (${p.id}), ${p.age}y ${p.sex}. ${t("chiefComplaint")}: "${p.complaint}". ${t("contextActive")}.`,
    }]);
  };

  // FIX #2: Quick prompts are built dynamically using the selected patient's real data.
  // If no patient is selected a generic fallback is used instead.
  const quickPrompts = useMemo(() => {
    const p = activePatient;
    const patientInfo = p
      ? `Patient on file: ${p.age}y ${p.sex}, BP ${p.bp}, Temp ${p.temp}. Medications: ${p.meds}. Allergies: ${p.allergies}. Chief complaint: ${p.complaint}.`
      : null;
    return [
      { label: t("qpRx"),       icon:"💊", text: patientInfo ? `${patientInfo}\n${t("qpRxInstr")}`       : t("qpRxFallback")       },
      { label: t("qpSummary"),  icon:"📝", text: patientInfo ? `${patientInfo}\n${t("qpSummaryInstr")}`  : t("qpSummaryFallback")  },
      { label: t("qpSchedule"), icon:"📅", text: patientInfo ? `${patientInfo}\n${t("qpScheduleInstr")}` : t("qpScheduleFallback") },
      { label: t("qpLab"),      icon:"🔬", text: patientInfo ? `${patientInfo}\n${t("qpLabInstr")}`      : t("qpLabFallback")      },
    ];
  }, [activePatient, t]);

  const TABS = [
    ["chat",    t("tabChat")],
    ["outputs", `${t("tabOutputs")} (${outputs.length})`],
    ["badges",  `${t("tabBadges")} (${earnedBadges.length}/${BADGES.length})`],
    ["metrics", t("tabMetrics")],
    ["ethics",  t("tabEthics")],
  ];

  return (<>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Geologica:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      *  { box-sizing:border-box; margin:0; padding:0 }
      body { background:${DS.bg}; font-family:'DM Sans',sans-serif; color:${DS.text} }
      textarea { resize:none } textarea:focus { outline:none }
      select option { color:${DS.text}; background:white }
      @keyframes slideIn  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
      @keyframes badgePop { 0% { transform:scale(0.6);opacity:0 } 70% { transform:scale(1.06) } 100% { transform:scale(1);opacity:1 } }
      @keyframes shimmer  { from { background-position:200% 0 } to { background-position:-200% 0 } }
      @keyframes pulseRing{ 0%,100% { box-shadow:0 0 0 0 ${DS.primary}40 } 50% { box-shadow:0 0 0 8px ${DS.primary}00 } }
      ::-webkit-scrollbar { width:4px }
      ::-webkit-scrollbar-thumb { background:${DS.borderStrong}; border-radius:2px }
    `}</style>

    <div style={{ minHeight:"100vh", background:DS.bg, display:"flex", flexDirection:"column" }}>

      {/* OFFLINE BANNER */}
      {!isOnline && (
        <div style={{ background:DS.danger, color:"white", padding:"8px 24px", textAlign:"center", fontSize:13, fontWeight:500, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          📡 {t("offlineBanner")}
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{ background:DS.surface, borderBottom:`1px solid ${DS.border}`, padding:"0 24px", display:"flex", justifyContent:"space-between", alignItems:"center", height:60, flexShrink:0, position:"sticky", top:0, zIndex:100 }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:34, height:34, borderRadius:8, background:DS.primary, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, color:"white", animation:"pulseRing 3s infinite" }}>🏥</div>
          <div>
            <div style={{ fontFamily:"'Geologica',sans-serif", fontWeight:700, fontSize:16, color:DS.text, letterSpacing:-0.3 }}>{t("appTitle")}</div>
            <div style={{ fontSize:11, color:DS.textMuted, marginTop:-1 }}>{t("appSub")}</div>
          </div>
        </div>

        {/* Centre stats */}
        <div style={{ display:"flex", alignItems:"center" }}>
          {[[`💊`, stats.prescriptions, t("statRx")], [`📋`, stats.reports, t("statRep")], [`📤`, stats.exports, t("statPdf")], [`🏅`, earnedBadges.length, t("statBadges")]].map(([icon, val, label]) => (
            <div key={label} style={{ textAlign:"center", padding:"4px 12px", borderRight:`1px solid ${DS.border}` }}>
              <div style={{ fontSize:13, fontWeight:700, color:DS.text }}>{icon} {val}</div>
              <div style={{ fontSize:10, color:DS.textMuted }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button
            onClick={() => { setTourStep(0); setTab("chat"); }}
            style={{ background:"none", border:`1px solid ${DS.border}`, color:DS.textSec, borderRadius:7, padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:500, transition:"all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = DS.primary; e.currentTarget.style.color = DS.primary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = DS.border;  e.currentTarget.style.color = DS.textSec;  }}
          >▶ {t("demoBtn")}</button>
          {/* Language selector */}
          <select value={lang} onChange={e => setLang(e.target.value)} style={{ background:DS.surfaceAlt, border:`1px solid ${DS.border}`, color:DS.text, borderRadius:7, padding:"5px 10px", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            <option value="en">🇬🇧 EN</option>
            <option value="uz">🇺🇿 UZ</option>
            <option value="ru">🇷🇺 RU</option>
          </select>
        </div>
      </header>

      {/* ── NAV TABS ── */}
      <nav style={{ background:DS.surface, borderBottom:`1px solid ${DS.border}`, display:"flex", padding:"0 24px" }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding:"12px 18px", background:"none", border:"none", cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif", fontWeight: tab===id ? 600 : 400, fontSize:13,
            color: tab===id ? DS.primary : DS.textSec,
            borderBottom: tab===id ? `2px solid ${DS.primary}` : "2px solid transparent",
            transition:"all 0.2s", letterSpacing:0.1,
          }}>{label}</button>
        ))}
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex:1, display:"flex", flexDirection:"column", maxWidth:920, width:"100%", margin:"0 auto", padding:"20px 24px", gap:12, overflow:"hidden" }}>

        {/* ── CHAT TAB ── */}
        {tab === "chat" && (<>
          {/* Toolbar */}
          <div id="toolbar" style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <PatientSelector
              patients={MOCK_PATIENTS}
              selected={activePatient}
              onSelect={handleSelectPatient}
              onClear={() => { setActivePatient(null); showToast(t("patientCleared")); }}
              t={t}
            />
            <div style={{ width:1, height:24, background:DS.border, margin:"0 4px" }} />
            {/* FIX #2: quickPrompts now built from activePatient + t() — changes on patient select AND on lang change */}
            <div id="quickprompt" style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {quickPrompts.map(p => (
                <button key={p.label} onClick={() => handleSend(p.text)}
                  style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:20, cursor:"pointer", background:DS.surface, border:`1px solid ${DS.border}`, fontSize:12, fontWeight:500, color:DS.text, fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = DS.primaryLight; e.currentTarget.style.borderColor = DS.primary+"66"; e.currentTarget.style.color = DS.primary; }}
                  onMouseLeave={e => { e.currentTarget.style.background = DS.surface;      e.currentTarget.style.borderColor = DS.border;        e.currentTarget.style.color = DS.text;    }}
                >{p.icon} {p.label}</button>
              ))}
            </div>
          </div>

          {/* Active patient banner */}
          {activePatient && (
            <div style={{ background:DS.primaryLight, border:`1px solid ${DS.primary}33`, borderRadius:10, padding:"9px 14px", fontSize:13, display:"flex", gap:10, alignItems:"center", animation:"slideIn 0.25s ease" }}>
              <span style={{ fontSize:16 }}>👤</span>
              <div style={{ flex:1 }}>
                <b style={{ color:DS.primary, marginRight:8 }}>{activePatient.name}</b>
                <span style={{ color:DS.textMuted, fontFamily:"'JetBrains Mono',monospace", fontSize:11, marginRight:8 }}>{activePatient.id}</span>
                <span style={{ color:DS.textSec }}>· {activePatient.age}y {activePatient.sex} · BP {activePatient.bp} · {activePatient.complaint.slice(0,58)}…</span>
              </div>
            </div>
          )}

          {/* Chat window */}
          <div style={{ flex:1, background:DS.surface, borderRadius:12, border:`1px solid ${DS.border}`, display:"flex", flexDirection:"column", minHeight:300, overflow:"hidden" }}>
            <div style={{ flex:1, overflowY:"auto", padding:20 }}>
              {messages.length === 0 ? <MessageSkeleton /> : messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
              {loading && <MessageSkeleton />}
              <div ref={chatEndRef} />
            </div>
            {/* Input row — voice button removed */}
            <div id="chatinput" style={{ borderTop:`1px solid ${DS.border}`, padding:"12px 14px", display:"flex", gap:8, background:DS.surfaceAlt, alignItems:"flex-end" }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={t("placeholder")}
                rows={2}
                style={{ flex:1, border:`1.5px solid ${DS.border}`, borderRadius:8, padding:"9px 13px", fontSize:14, fontFamily:"'DM Sans',sans-serif", background:"white", color:DS.text, lineHeight:1.5, transition:"border-color 0.2s" }}
                onFocus={e => e.target.style.borderColor = DS.primary}
                onBlur={e  => e.target.style.borderColor = DS.border}
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim() || !isOnline}
                style={{ background: loading||!input.trim()||!isOnline ? DS.border : DS.primary, color:"white", border:"none", borderRadius:8, padding:"10px 20px", cursor: loading||!isOnline ? "not-allowed" : "pointer", fontWeight:600, fontSize:14, fontFamily:"'DM Sans',sans-serif", transition:"background 0.2s", minWidth:80 }}
              >{loading ? "…" : !isOnline ? "📡" : t("send")}</button>
            </div>
          </div>

          {/* Footer: disclaimer + keyboard shortcuts */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:2 }}>
            <div style={{ fontSize:11, color:DS.textMuted }}>{t("disclaimer")}</div>
            <div style={{ display:"flex", gap:8, flexShrink:0 }}>
              {[["1–5", t("kbTabs")], ["Ctrl+↵", t("kbSend")], ["Ctrl+D", t("kbDemo")], ["Esc", t("kbClose")]].map(([key, label]) => (
                <span key={key} style={{ display:"flex", alignItems:"center", gap:3, fontSize:10, color:DS.textMuted }}>
                  <kbd style={{ background:DS.surfaceAlt, border:`1px solid ${DS.border}`, borderRadius:4, padding:"1px 5px", fontFamily:"'JetBrains Mono',monospace", fontSize:9 }}>{key}</kbd>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </>)}

        {/* ── DOCUMENTS TAB ── */}
        {tab === "outputs" && (
          <div id="outputs" style={{ overflowY:"auto", flex:1, paddingRight:2 }}>
            {outputs.length === 0 ? (
              <div style={{ textAlign:"center", padding:"64px 20px", color:DS.textSec, background:DS.surface, borderRadius:12, border:`1px solid ${DS.border}` }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
                <div style={{ fontWeight:600, fontSize:15, fontFamily:"'Geologica',sans-serif", color:DS.text }}>{t("noDocsYet")}</div>
                <div style={{ fontSize:13, marginTop:6 }}>{t("noDocsHint")}</div>
              </div>
            ) : outputs.map(o => (
              <OutputCard
                key={o.id}
                item={o}
                t={t}
                onCopy={text => { navigator.clipboard.writeText(text); showToast(t("copied")); }}
                onExport={handleExportBadge}
              />
            ))}
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === "metrics" && <MetricsDashboard outputs={outputs} stats={stats} t={t} />}

        {/* ── ETHICS TAB ── */}
        {tab === "ethics" && (
          <div style={{ overflowY:"auto", flex:1 }}>
            <div style={{ background:DS.surface, borderRadius:12, border:`1px solid ${DS.border}`, padding:24 }}>
              <div style={{ fontFamily:"'Geologica',sans-serif", fontWeight:700, fontSize:20, color:DS.text, marginBottom:4 }}>{t("ethicsTitle")}</div>
              <div style={{ color:DS.textSec, fontSize:13, marginBottom:20 }}>{t("ethicsSub")}</div>
              {[
                { icon:"🚫", title:t("ethicsRule1Title"), color:DS.dangerBg,   border:DS.danger,   body:t("ethicsRule1Body") },
                { icon:"✅", title:t("ethicsRule2Title"), color:DS.successBg,  border:DS.success,  body:t("ethicsRule2Body") },
                { icon:"🔍", title:t("ethicsRule3Title"), color:DS.warningBg,  border:DS.accent,   body:t("ethicsRule3Body") },
                { icon:"🌍", title:t("ethicsRule4Title"), color:DS.primaryLight,border:"#7EA5D1",   body:t("ethicsRule4Body") },
                { icon:"📊", title:t("ethicsRule5Title"), color:DS.primaryLight,border:DS.primary,  body:t("ethicsRule5Body") },
                { icon:"🔒", title:t("ethicsRule6Title"), color:"#F3E8FF",     border:"#7C4DFF",   body:t("ethicsRule6Body") },
              ].map(r => (
                <div key={r.title} style={{ background:r.color, border:`1px solid ${r.border}33`, borderRadius:10, padding:"13px 16px", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
                    <span style={{ fontSize:18 }}>{r.icon}</span>
                    <span style={{ fontWeight:600, fontSize:13, color:DS.text }}>{r.title}</span>
                  </div>
                  <div style={{ fontSize:13, color:DS.textSec, lineHeight:1.7 }}>{r.body}</div>
                </div>
              ))}
              <div style={{ marginTop:8, padding:"13px 16px", background:DS.text, borderRadius:10, color:"white" }}>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:6 }}>{t("ethicsLimTitle")}</div>
                <div style={{ fontSize:12, lineHeight:1.9, opacity:0.8 }}>
                  • {t("ethicsLim1")}<br/>
                  • {t("ethicsLim2")}<br/>
                  • {t("ethicsLim3")}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── BADGES TAB ── */}
        {tab === "badges" && (
          <div style={{ overflowY:"auto", flex:1 }}>
            <div style={{ background:DS.surface, borderRadius:12, border:`1px solid ${DS.border}`, padding:24 }}>
              <div style={{ fontFamily:"'Geologica',sans-serif", fontWeight:700, fontSize:20, color:DS.text, marginBottom:4 }}>{t("achievementsTitle")}</div>
              <div style={{ color:DS.textSec, fontSize:13, marginBottom:20 }}>
                {earnedBadges.length} {t("achievementsOf")} {BADGES.length} {t("achievementsEarned")}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {BADGES.map(b => <BadgeChip key={b.id} badge={b} earned={stats[b.type] >= b.threshold} />)}
              </div>
              <div style={{ marginTop:20, padding:16, background:DS.surfaceAlt, borderRadius:10, border:`1px solid ${DS.border}` }}>
                <div style={{ fontWeight:600, color:DS.text, marginBottom:10, fontSize:13 }}>{t("sessionStats")}</div>
                {[
                  [t("statPrescriptions"), stats.prescriptions],
                  [t("statReports"),       stats.reports],
                  [t("statSchedules"),     stats.schedules],
                  [t("statPdfsExported"),  stats.exports],
                  [t("statTotalTasks"),    stats.total],
                ].map(([label, val]) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"5px 0", color:DS.textSec, borderBottom:`1px solid ${DS.border}` }}>
                    <span>{label}</span><b style={{ color:DS.text }}>{val}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>

    {/* TOUR OVERLAY */}
    {tourStep >= 0 && tourStep < demoSteps.length && (
      <TourOverlay
        steps={demoSteps}
        step={tourStep}
        onNext={() => setTourStep(s => s >= demoSteps.length - 1 ? -1 : s + 1)}
        onSkip={() => setTourStep(-1)}
        onTabChange={setTab}
        t={t}
      />
    )}

    {/* TOAST */}
    {toast && (
      <div style={{ position:"fixed", bottom:24, right:24, zIndex:900, background:DS.text, color:"white", borderRadius:8, padding:"10px 18px", fontWeight:500, fontSize:13, animation:"slideIn 0.25s ease", boxShadow:"0 4px 16px rgba(0,0,0,0.18)", display:"flex", alignItems:"center", gap:8 }}>
        {toast}
      </div>
    )}

    {/* BADGE POP-UP */}
    {newBadge && (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }} onClick={() => setNewBadge(null)}>
        <div style={{ background:DS.surface, borderRadius:16, padding:"44px 56px", textAlign:"center", animation:"badgePop 0.4s ease", boxShadow:"0 24px 64px rgba(0,0,0,0.25)", border:`1px solid ${DS.border}` }}>
          <div style={{ fontSize:72, marginBottom:12 }}>{newBadge.icon}</div>
          <div style={{ fontFamily:"'Geologica',sans-serif", fontSize:24, fontWeight:700, color:DS.text }}>{t("badgeUnlocked")}</div>
          <div style={{ fontWeight:600, fontSize:16, margin:"8px 0 4px", color:DS.primary }}>{newBadge.label}</div>
          <div style={{ color:DS.textSec, fontSize:13 }}>{newBadge.desc}</div>
          <button onClick={() => setNewBadge(null)} style={{ marginTop:24, padding:"10px 32px", background:DS.primary, color:"white", border:"none", borderRadius:8, fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            {t("badgeContinue")}
          </button>
        </div>
      </div>
    )}
  </>);
}

export default function AdminAIAssistant() {
  return <ErrorBoundary><AdminAIAssistantInner /></ErrorBoundary>;
}