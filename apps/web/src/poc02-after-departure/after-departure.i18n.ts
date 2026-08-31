import type {
  AfterDepartureScenario,
  AfterDepartureState,
} from './after-departure.types';
import { finalLanguageOperationalDictionary } from '../i18n/final-language-operational.dictionary';

export const afterDepartureLanguages = ['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq', 'it', 'es', 'sv'] as const;
export type AfterDepartureLanguage = (typeof afterDepartureLanguages)[number];

export const afterDepartureLanguageLabels: Record<AfterDepartureLanguage, string> = {
  ro: 'RO — Română', de: 'DE — Deutsch', en: 'EN — English', fr: 'FR — Français',
  nl: 'NL — Nederlands', ru: 'RU — Русский', pl: 'PL — Polski', tr: 'TR — Türkçe', sq: 'SQ — Shqip',
  it: 'IT — Italiano', es: 'ES — Español', sv: 'SV — Svenska',
};

type Copy = {
  title: string;
  eyebrow: string;
  intro: string;
  safeQuestion: string;
  dangerQuestion: string;
  yes: string;
  no: string;
  scenario: string;
  facts: string;
  factHint: string;
  externalAction: string;
  evaluate: string;
  reset: string;
  offline: string;
  draftOnly: string;
  priority: string;
  state: string;
  actions: string;
  missing: string;
  escalation: string;
  prohibited: string;
  limitations: string;
  none: string;
  back: string;
  backPremium: string;
  backCockpit: string;
  escalate: string;
  stabilize: string;
  close: string;
  scenarios: Record<AfterDepartureScenario, string>;
  states: Record<AfterDepartureState, string>;
};

const baseAfterDepartureCopy: Record<'ro' | 'de' | 'en', Copy> = {
  ro: {
    title: 'După Plecare',
    eyebrow: 'AGM · ASISTENȚĂ OPERAȚIONALĂ',
    intro: 'Descrie situația numai după ce vehiculul este oprit într-un loc sigur.',
    safeQuestion: 'Poți interacționa în siguranță?',
    dangerQuestion: 'Există pericol imediat sau persoane rănite?',
    yes: 'Da',
    no: 'Nu',
    scenario: 'Situație',
    facts: 'Fapte confirmate',
    factHint: 'Completează numai ceea ce poți confirma.',
    externalAction: 'Pregătește o escaladare externă',
    evaluate: 'Evaluează situația',
    reset: 'Flux nou',
    offline: 'Dispozitivul este offline. Evaluarea locală rămâne disponibilă; transmiterea nu este activă.',
    draftOnly: 'Confirmarea produce numai o schiță locală. Nimic nu este trimis.',
    priority: 'Prioritate',
    state: 'Stare',
    actions: 'Acțiuni imediate',
    missing: 'Date lipsă',
    escalation: 'Escaladare propusă',
    prohibited: 'Nu efectua',
    limitations: 'Limitele AGM',
    none: 'Niciuna',
    back: 'Înapoi la AGM',
    backPremium: 'Înapoi la Premium',
    backCockpit: 'Cockpit AGM',
    escalate: 'Confirmă escaladarea locală',
    stabilize: 'Marchează situația stabilizată',
    close: 'Închide fluxul',
    scenarios: {
      'road-control': 'Control rutier',
      incident: 'Incident sau accident',
      breakdown: 'Avarie',
      fatigue: 'Oboseală',
      cargo: 'Marfă, fixare sau sigiliu',
      route: 'Rută blocată sau restricție',
      weather: 'Meteo sau drum',
      language: 'Barieră de limbă',
    },
    states: {
      NEW: 'Situație nouă',
      UNSAFE_TO_INTERACT: 'Interacțiune nesigură',
      EMERGENCY: 'Urgență',
      NEEDS_FACTS: 'Sunt necesare fapte',
      ASSESSED: 'Evaluată',
      AWAITING_CONFIRMATION: 'Așteaptă confirmarea',
      ESCALATED: 'Escaladat',
      SAFE_TO_CONTINUE: 'Sigur pentru continuare',
      CLOSED: 'Închis',
    },
  },
  de: {
    title: 'Nach der Abfahrt',
    eyebrow: 'AGM · OPERATIVE UNTERSTÜTZUNG',
    intro: 'Beschreiben Sie die Situation erst, wenn das Fahrzeug sicher steht.',
    safeQuestion: 'Können Sie sicher interagieren?',
    dangerQuestion: 'Besteht unmittelbare Gefahr oder gibt es Verletzte?',
    yes: 'Ja',
    no: 'Nein',
    scenario: 'Situation',
    facts: 'Bestätigte Fakten',
    factHint: 'Nur Angaben eintragen, die Sie bestätigen können.',
    externalAction: 'Externe Eskalation vorbereiten',
    evaluate: 'Situation bewerten',
    reset: 'Neuer Ablauf',
    offline: 'Das Gerät ist offline. Die lokale Bewertung bleibt verfügbar; Übertragung ist nicht aktiv.',
    draftOnly: 'Die Bestätigung erstellt nur einen lokalen Entwurf. Nichts wird gesendet.',
    priority: 'Priorität',
    state: 'Status',
    actions: 'Sofortmaßnahmen',
    missing: 'Fehlende Angaben',
    escalation: 'Vorgeschlagene Eskalation',
    prohibited: 'Nicht ausführen',
    limitations: 'AGM-Grenzen',
    none: 'Keine',
    back: 'Zurück zu AGM',
    backPremium: 'Zurück zu Premium',
    backCockpit: 'AGM Cockpit',
    escalate: 'Lokale Eskalation bestätigen',
    stabilize: 'Situation als stabil markieren',
    close: 'Ablauf schließen',
    scenarios: {
      'road-control': 'Verkehrskontrolle',
      incident: 'Vorfall oder Unfall',
      breakdown: 'Panne',
      fatigue: 'Müdigkeit',
      cargo: 'Ladung, Sicherung oder Siegel',
      route: 'Gesperrte Route oder Einschränkung',
      weather: 'Wetter oder Straße',
      language: 'Sprachbarriere',
    },
    states: {
      NEW: 'Neue Situation',
      UNSAFE_TO_INTERACT: 'Unsichere Interaktion',
      EMERGENCY: 'Notfall',
      NEEDS_FACTS: 'Fakten erforderlich',
      ASSESSED: 'Bewertet',
      AWAITING_CONFIRMATION: 'Bestätigung ausstehend',
      ESCALATED: 'Eskaliert',
      SAFE_TO_CONTINUE: 'Sichere Weiterfahrt',
      CLOSED: 'Geschlossen',
    },
  },
  en: {
    title: 'After Departure',
    eyebrow: 'AGM · OPERATIONAL ASSISTANCE',
    intro: 'Describe the situation only after the vehicle is stopped in a safe place.',
    safeQuestion: 'Can you interact safely?',
    dangerQuestion: 'Is there immediate danger or anyone injured?',
    yes: 'Yes',
    no: 'No',
    scenario: 'Situation',
    facts: 'Confirmed facts',
    factHint: 'Enter only information you can confirm.',
    externalAction: 'Prepare an external escalation',
    evaluate: 'Assess situation',
    reset: 'New flow',
    offline: 'The device is offline. Local assessment remains available; transmission is not active.',
    draftOnly: 'Confirmation creates a local draft only. Nothing is sent.',
    priority: 'Priority',
    state: 'State',
    actions: 'Immediate actions',
    missing: 'Missing facts',
    escalation: 'Suggested escalation',
    prohibited: 'Do not',
    limitations: 'AGM limitations',
    none: 'None',
    back: 'Back to AGM',
    backPremium: 'Back to Premium',
    backCockpit: 'AGM Cockpit',
    escalate: 'Confirm local escalation',
    stabilize: 'Mark situation as stable',
    close: 'Close flow',
    scenarios: {
      'road-control': 'Road control',
      incident: 'Incident or accident',
      breakdown: 'Breakdown',
      fatigue: 'Fatigue',
      cargo: 'Cargo, securing, or seal',
      route: 'Blocked route or restriction',
      weather: 'Weather or road',
      language: 'Language barrier',
    },
    states: {
      NEW: 'New situation',
      UNSAFE_TO_INTERACT: 'Unsafe to interact',
      EMERGENCY: 'Emergency',
      NEEDS_FACTS: 'Facts required',
      ASSESSED: 'Assessed',
      AWAITING_CONFIRMATION: 'Awaiting confirmation',
      ESCALATED: 'Escalated',
      SAFE_TO_CONTINUE: 'Safe to continue',
      CLOSED: 'Closed',
    },
  },
};

const extraAfterDepartureCopy: Record<Exclude<AfterDepartureLanguage, 'ro' | 'de' | 'en'>, Copy> = {
  it: finalLanguageOperationalDictionary.it.afterDeparture,
  es: finalLanguageOperationalDictionary.es.afterDeparture,
  sv: finalLanguageOperationalDictionary.sv.afterDeparture,
  fr: { ...baseAfterDepartureCopy.en, title:'Après le départ', eyebrow:'AGM · ASSISTANCE OPÉRATIONNELLE', intro:'Décrivez la situation uniquement après l’arrêt du véhicule dans un lieu sûr.', safeQuestion:'Pouvez-vous interagir en toute sécurité ?', dangerQuestion:'Y a-t-il un danger immédiat ou des blessés ?', yes:'Oui', no:'Non', scenario:'Situation', facts:'Faits confirmés', factHint:'Saisissez uniquement les informations confirmées.', externalAction:'Préparer une escalade externe', evaluate:'Évaluer la situation', reset:'Nouveau flux', offline:'L’appareil est hors ligne. L’évaluation locale reste disponible.', draftOnly:'La confirmation crée uniquement un brouillon local. Rien n’est envoyé.', priority:'Priorité', state:'État', actions:'Actions immédiates', missing:'Informations manquantes', escalation:'Escalade proposée', prohibited:'À ne pas faire', limitations:'Limites AGM', none:'Aucun', back:'Retour à AGM', backPremium:'Retour à Premium', backCockpit:'Cockpit AGM', escalate:'Confirmer l’escalade locale', stabilize:'Marquer la situation comme stable', close:'Fermer le flux', scenarios:{'road-control':'Contrôle routier',incident:'Incident ou accident',breakdown:'Panne',fatigue:'Fatigue',cargo:'Chargement, arrimage ou scellé',route:'Route bloquée ou restriction',weather:'Météo ou route',language:'Barrière linguistique'}, states:{NEW:'Nouvelle situation',UNSAFE_TO_INTERACT:'Interaction dangereuse',EMERGENCY:'Urgence',NEEDS_FACTS:'Informations requises',ASSESSED:'Évaluée',AWAITING_CONFIRMATION:'En attente de confirmation',ESCALATED:'Escaladée',SAFE_TO_CONTINUE:'Poursuite sûre',CLOSED:'Fermée'} },
  nl: { ...baseAfterDepartureCopy.en, title:'Na vertrek', eyebrow:'AGM · OPERATIONELE ONDERSTEUNING', intro:'Beschrijf de situatie pas nadat het voertuig veilig is gestopt.', safeQuestion:'Kunt u veilig handelen?', dangerQuestion:'Is er direct gevaar of zijn er gewonden?', yes:'Ja', no:'Nee', scenario:'Situatie', facts:'Bevestigde feiten', factHint:'Vul alleen bevestigde informatie in.', externalAction:'Externe escalatie voorbereiden', evaluate:'Situatie beoordelen', reset:'Nieuwe workflow', offline:'Het apparaat is offline. Lokale beoordeling blijft beschikbaar.', draftOnly:'Bevestiging maakt alleen een lokaal concept. Niets wordt verzonden.', priority:'Prioriteit', state:'Status', actions:'Directe acties', missing:'Ontbrekende feiten', escalation:'Voorgestelde escalatie', prohibited:'Niet doen', limitations:'AGM-beperkingen', none:'Geen', back:'Terug naar AGM', backPremium:'Terug naar Premium', backCockpit:'AGM Cockpit', escalate:'Lokale escalatie bevestigen', stabilize:'Situatie als stabiel markeren', close:'Workflow sluiten', scenarios:{'road-control':'Wegcontrole',incident:'Incident of ongeval',breakdown:'Pech',fatigue:'Vermoeidheid',cargo:'Lading, zekering of verzegeling',route:'Geblokkeerde route of beperking',weather:'Weer of weg',language:'Taalbarrière'}, states:{NEW:'Nieuwe situatie',UNSAFE_TO_INTERACT:'Onveilige interactie',EMERGENCY:'Noodgeval',NEEDS_FACTS:'Feiten vereist',ASSESSED:'Beoordeeld',AWAITING_CONFIRMATION:'Wacht op bevestiging',ESCALATED:'Geëscaleerd',SAFE_TO_CONTINUE:'Veilig om door te rijden',CLOSED:'Gesloten'} },
  ru: { ...baseAfterDepartureCopy.en, title:'После отправления', eyebrow:'AGM · ОПЕРАЦИОННАЯ ПОМОЩЬ', intro:'Опишите ситуацию только после безопасной остановки автомобиля.', safeQuestion:'Вы можете безопасно взаимодействовать?', dangerQuestion:'Есть непосредственная опасность или пострадавшие?', yes:'Да', no:'Нет', scenario:'Ситуация', facts:'Подтверждённые факты', factHint:'Введите только подтверждённые сведения.', externalAction:'Подготовить внешнюю эскалацию', evaluate:'Оценить ситуацию', reset:'Новый процесс', offline:'Устройство не в сети. Локальная оценка доступна.', draftOnly:'Подтверждение создаёт только локальный черновик. Ничего не отправляется.', priority:'Приоритет', state:'Состояние', actions:'Немедленные действия', missing:'Недостающие данные', escalation:'Предлагаемая эскалация', prohibited:'Не делать', limitations:'Ограничения AGM', none:'Нет', back:'Назад к AGM', backPremium:'Назад к Premium', backCockpit:'AGM Cockpit', escalate:'Подтвердить локальную эскалацию', stabilize:'Отметить ситуацию стабильной', close:'Закрыть процесс', scenarios:{'road-control':'Дорожный контроль',incident:'Инцидент или авария',breakdown:'Поломка',fatigue:'Усталость',cargo:'Груз, крепление или пломба',route:'Перекрытый маршрут или ограничение',weather:'Погода или дорога',language:'Языковой барьер'}, states:{NEW:'Новая ситуация',UNSAFE_TO_INTERACT:'Небезопасное взаимодействие',EMERGENCY:'Чрезвычайная ситуация',NEEDS_FACTS:'Нужны факты',ASSESSED:'Оценено',AWAITING_CONFIRMATION:'Ожидает подтверждения',ESCALATED:'Эскалировано',SAFE_TO_CONTINUE:'Можно безопасно продолжить',CLOSED:'Закрыто'} },
  pl: { ...baseAfterDepartureCopy.en, title:'Po wyjeździe', eyebrow:'AGM · WSPARCIE OPERACYJNE', intro:'Opisz sytuację dopiero po bezpiecznym zatrzymaniu pojazdu.', safeQuestion:'Czy możesz bezpiecznie korzystać z aplikacji?', dangerQuestion:'Czy istnieje bezpośrednie zagrożenie lub są ranni?', yes:'Tak', no:'Nie', scenario:'Sytuacja', facts:'Potwierdzone fakty', factHint:'Wpisz tylko potwierdzone informacje.', externalAction:'Przygotuj eskalację zewnętrzną', evaluate:'Oceń sytuację', reset:'Nowy proces', offline:'Urządzenie jest offline. Ocena lokalna pozostaje dostępna.', draftOnly:'Potwierdzenie tworzy tylko lokalny szkic. Nic nie jest wysyłane.', priority:'Priorytet', state:'Stan', actions:'Działania natychmiastowe', missing:'Brakujące fakty', escalation:'Proponowana eskalacja', prohibited:'Nie wykonuj', limitations:'Ograniczenia AGM', none:'Brak', back:'Wróć do AGM', backPremium:'Wróć do Premium', backCockpit:'AGM Cockpit', escalate:'Potwierdź lokalną eskalację', stabilize:'Oznacz sytuację jako stabilną', close:'Zamknij proces', scenarios:{'road-control':'Kontrola drogowa',incident:'Incydent lub wypadek',breakdown:'Awaria',fatigue:'Zmęczenie',cargo:'Ładunek, mocowanie lub plomba',route:'Zablokowana trasa lub ograniczenie',weather:'Pogoda lub droga',language:'Bariera językowa'}, states:{NEW:'Nowa sytuacja',UNSAFE_TO_INTERACT:'Niebezpieczna interakcja',EMERGENCY:'Nagły wypadek',NEEDS_FACTS:'Wymagane fakty',ASSESSED:'Oceniono',AWAITING_CONFIRMATION:'Oczekuje na potwierdzenie',ESCALATED:'Eskalowano',SAFE_TO_CONTINUE:'Można bezpiecznie kontynuować',CLOSED:'Zamknięto'} },
  tr: { ...baseAfterDepartureCopy.en, title:'Yola çıktıktan sonra', eyebrow:'AGM · OPERASYONEL DESTEK', intro:'Durumu yalnızca araç güvenli bir yerde durduktan sonra açıklayın.', safeQuestion:'Güvenli şekilde etkileşim kurabilir misiniz?', dangerQuestion:'Acil tehlike veya yaralı var mı?', yes:'Evet', no:'Hayır', scenario:'Durum', facts:'Doğrulanmış bilgiler', factHint:'Yalnızca doğrulayabildiğiniz bilgileri girin.', externalAction:'Harici yönlendirme hazırla', evaluate:'Durumu değerlendir', reset:'Yeni akış', offline:'Cihaz çevrimdışı. Yerel değerlendirme kullanılabilir.', draftOnly:'Onay yalnızca yerel taslak oluşturur. Hiçbir şey gönderilmez.', priority:'Öncelik', state:'Durum', actions:'Acil eylemler', missing:'Eksik bilgiler', escalation:'Önerilen yönlendirme', prohibited:'Yapmayın', limitations:'AGM sınırları', none:'Yok', back:'AGM’ye dön', backPremium:'Premium’a dön', backCockpit:'AGM Cockpit', escalate:'Yerel yönlendirmeyi onayla', stabilize:'Durumu kararlı olarak işaretle', close:'Akışı kapat', scenarios:{'road-control':'Yol kontrolü',incident:'Olay veya kaza',breakdown:'Arıza',fatigue:'Yorgunluk',cargo:'Yük, sabitleme veya mühür',route:'Kapalı rota veya kısıtlama',weather:'Hava veya yol',language:'Dil engeli'}, states:{NEW:'Yeni durum',UNSAFE_TO_INTERACT:'Güvensiz etkileşim',EMERGENCY:'Acil durum',NEEDS_FACTS:'Bilgi gerekli',ASSESSED:'Değerlendirildi',AWAITING_CONFIRMATION:'Onay bekliyor',ESCALATED:'Yönlendirildi',SAFE_TO_CONTINUE:'Devam etmek güvenli',CLOSED:'Kapandı'} },
  sq: { ...baseAfterDepartureCopy.en, title:'Pas nisjes', eyebrow:'AGM · ASISTENCË OPERACIONALE', intro:'Përshkruani situatën vetëm pasi automjeti të jetë ndalur në një vend të sigurt.', safeQuestion:'A mund të ndërveproni në mënyrë të sigurt?', dangerQuestion:'Ka rrezik të menjëhershëm ose të lënduar?', yes:'Po', no:'Jo', scenario:'Situata', facts:'Fakte të konfirmuara', factHint:'Vendosni vetëm informacione që mund t’i konfirmoni.', externalAction:'Përgatit përshkallëzim të jashtëm', evaluate:'Vlerëso situatën', reset:'Rrjedhë e re', offline:'Pajisja është jashtë linje. Vlerësimi lokal mbetet i disponueshëm.', draftOnly:'Konfirmimi krijon vetëm një draft lokal. Asgjë nuk dërgohet.', priority:'Përparësia', state:'Gjendja', actions:'Veprime të menjëhershme', missing:'Fakte që mungojnë', escalation:'Përshkallëzim i propozuar', prohibited:'Mos bëni', limitations:'Kufizimet AGM', none:'Asnjë', back:'Kthehu te AGM', backPremium:'Kthehu te Premium', backCockpit:'AGM Cockpit', escalate:'Konfirmo përshkallëzimin lokal', stabilize:'Shëno situatën si të qëndrueshme', close:'Mbyll rrjedhën', scenarios:{'road-control':'Kontroll rrugor',incident:'Incident ose aksident',breakdown:'Defekt',fatigue:'Lodhje',cargo:'Ngarkesë, sigurim ose vulë',route:'Rrugë e bllokuar ose kufizim',weather:'Mot ose rrugë',language:'Pengesë gjuhësore'}, states:{NEW:'Situatë e re',UNSAFE_TO_INTERACT:'Ndërveprim i pasigurt',EMERGENCY:'Emergjencë',NEEDS_FACTS:'Kërkohen fakte',ASSESSED:'Vlerësuar',AWAITING_CONFIRMATION:'Në pritje të konfirmimit',ESCALATED:'Përshkallëzuar',SAFE_TO_CONTINUE:'E sigurt për të vazhduar',CLOSED:'Mbyllur'} },
};

export const afterDepartureCopy: Record<AfterDepartureLanguage, Copy> = {
  ...baseAfterDepartureCopy,
  ...extraAfterDepartureCopy,
};

export function normalizeAfterDepartureLanguage(value: string | null | undefined): AfterDepartureLanguage {
  return afterDepartureLanguages.includes(value as AfterDepartureLanguage) ? value as AfterDepartureLanguage : 'ro';
}
