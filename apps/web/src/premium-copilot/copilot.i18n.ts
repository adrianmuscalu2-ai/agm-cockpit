import type{BasicLanguageCode as AppLanguageCode}from'../language-registry';
type BasicLanguageCode=Exclude<AppLanguageCode,'it'|'es'|'sv'>;
const en={title:'AGM Copilot',subtitle:'Tell AGM what you need. AGM selects the right tool and guides you safely.',prompt:'How can I help?',microphone:'Hold to speak',camera:'Camera / OCR',keyboard:'Text',speaker:'Listen',transcript:'Review what AGM understood',confirm:'Confirm',cancel:'Cancel',safeQuestion:'Can you interact safely?',safeYes:'Yes, I am safely stopped',safeNo:'No',safeStop:'Stop in a safe place before continuing. Only approved emergency actions remain available.',interpreted:'AGM understood',clarify:'Please add a little more detail.',notActive:'This capability is prepared for a later authorized stage. Nothing was executed.',textHint:'Type or dictate your request.',diagnostics:'Recovery',back:'Back to Basic'}as const;type K=keyof typeof en;
const locale:Record<BasicLanguageCode,Record<K,string>>={en,ro:{title:'AGM Copilot',subtitle:'Spune-i AGM ce ai nevoie. AGM alege instrumentul potrivit și te conduce în siguranță.',prompt:'Cum te pot ajuta?',microphone:'Ține apăsat pentru a vorbi',camera:'Cameră / OCR',keyboard:'Text',speaker:'Ascultă',transcript:'Verifică ce a înțeles AGM',confirm:'Confirmă',cancel:'Anulează',safeQuestion:'Poți interacționa în siguranță?',safeYes:'Da, sunt oprit în siguranță',safeNo:'Nu',safeStop:'Oprește într-un loc sigur înainte de a continua. Rămân disponibile numai acțiunile de urgență aprobate.',interpreted:'AGM a înțeles',clarify:'Adaugă puțin mai multe detalii.',notActive:'Această capabilitate este pregătită pentru o etapă autorizată ulterior. Nu s-a executat nimic.',textHint:'Scrie sau dictează solicitarea.',diagnostics:'Recuperare',back:'Înapoi la Basic'},de:{...en,title:'AGM Copilot',subtitle:'Sagen Sie AGM, was Sie brauchen. AGM wählt das passende Werkzeug und führt Sie sicher.',prompt:'Wie kann ich helfen?',microphone:'Zum Sprechen gedrückt halten',camera:'Kamera / OCR',keyboard:'Text',speaker:'Anhören',transcript:'Prüfen, was AGM verstanden hat',confirm:'Bestätigen',cancel:'Abbrechen',safeQuestion:'Können Sie sicher interagieren?',safeYes:'Ja, ich stehe sicher',safeNo:'Nein',safeStop:'Halten Sie sicher an, bevor Sie fortfahren.',interpreted:'AGM hat verstanden',clarify:'Bitte ergänzen Sie einige Details.',notActive:'Diese Funktion ist für eine spätere autorisierte Stufe vorbereitet. Es wurde nichts ausgeführt.',textHint:'Anfrage schreiben oder diktieren.',diagnostics:'Wiederherstellung',back:'Zurück zu Basic'},fr:{...en,title:'AGM Copilot',prompt:'Comment puis-je aider ?',microphone:'Maintenir pour parler',camera:'Caméra / OCR',keyboard:'Texte',speaker:'Écouter',confirm:'Confirmer',cancel:'Annuler',safeQuestion:'Pouvez-vous interagir en sécurité ?',safeYes:'Oui, je suis arrêté en sécurité',safeNo:'Non',clarify:'Ajoutez quelques détails.',back:'Retour à Basic'},nl:{...en,title:'AGM Copilot',prompt:'Hoe kan ik helpen?',microphone:'Ingedrukt houden om te spreken',camera:'Camera / OCR',keyboard:'Tekst',speaker:'Luisteren',confirm:'Bevestigen',cancel:'Annuleren',safeQuestion:'Kunt u veilig communiceren?',safeYes:'Ja, ik sta veilig stil',safeNo:'Nee',clarify:'Voeg wat meer details toe.',back:'Terug naar Basic'},ru:{...en,title:'AGM Copilot',prompt:'Чем я могу помочь?',microphone:'Удерживайте, чтобы говорить',camera:'Камера / OCR',keyboard:'Текст',speaker:'Слушать',confirm:'Подтвердить',cancel:'Отмена',safeQuestion:'Вы можете безопасно взаимодействовать?',safeYes:'Да, я безопасно остановился',safeNo:'Нет',clarify:'Добавьте немного деталей.',back:'Назад к Basic'},pl:{...en,title:'AGM Copilot',prompt:'Jak mogę pomóc?',microphone:'Przytrzymaj, aby mówić',camera:'Kamera / OCR',keyboard:'Tekst',speaker:'Słuchaj',confirm:'Potwierdź',cancel:'Anuluj',safeQuestion:'Czy możesz bezpiecznie korzystać?',safeYes:'Tak, stoję bezpiecznie',safeNo:'Nie',clarify:'Dodaj trochę szczegółów.',back:'Wróć do Basic'},tr:{...en,title:'AGM Copilot',prompt:'Nasıl yardımcı olabilirim?',microphone:'Konuşmak için basılı tut',camera:'Kamera / OCR',keyboard:'Metin',speaker:'Dinle',confirm:'Onayla',cancel:'İptal',safeQuestion:'Güvenli şekilde etkileşim kurabilir misiniz?',safeYes:'Evet, güvenli şekilde durdum',safeNo:'Hayır',clarify:'Biraz daha ayrıntı ekleyin.',back:'Basic’e dön'},sq:{...en,title:'AGM Copilot',prompt:'Si mund t’ju ndihmoj?',microphone:'Mbajeni shtypur për të folur',camera:'Kamera / OCR',keyboard:'Tekst',speaker:'Dëgjo',confirm:'Konfirmo',cancel:'Anulo',safeQuestion:'A mund të ndërveproni në mënyrë të sigurt?',safeYes:'Po, jam ndalur në mënyrë të sigurt',safeNo:'Jo',clarify:'Shtoni pak më shumë hollësi.',back:'Kthehu te Basic'}};
const finalLocale=locale as Record<AppLanguageCode,Record<K,string>>;
finalLocale.it={title:'AGM Copilot',subtitle:'Spiega ad AGM di cosa hai bisogno. AGM seleziona lo strumento giusto e ti guida in sicurezza.',prompt:'Come posso aiutarti?',microphone:'Tieni premuto per parlare',camera:'Fotocamera / OCR',keyboard:'Testo',speaker:'Ascolta',transcript:'Controlla cosa ha capito AGM',confirm:'Conferma',cancel:'Annulla',safeQuestion:'Puoi interagire in sicurezza?',safeYes:'Sì, sono fermo in sicurezza',safeNo:'No',safeStop:'Fermati in un luogo sicuro prima di continuare. Restano disponibili solo le azioni di emergenza approvate.',interpreted:'AGM ha capito',clarify:'Aggiungi qualche dettaglio.',notActive:'Questa funzionalità è preparata per una fase autorizzata successiva. Non è stata eseguita alcuna azione.',textHint:'Scrivi o detta la richiesta.',diagnostics:'Ripristino',back:'Torna a Basic'};
finalLocale.es={title:'AGM Copilot',subtitle:'Dile a AGM qué necesitas. AGM selecciona la herramienta adecuada y te guía con seguridad.',prompt:'¿Cómo puedo ayudarte?',microphone:'Mantén pulsado para hablar',camera:'Cámara / OCR',keyboard:'Texto',speaker:'Escuchar',transcript:'Comprueba lo que ha entendido AGM',confirm:'Confirmar',cancel:'Cancelar',safeQuestion:'¿Puedes interactuar de forma segura?',safeYes:'Sí, estoy detenido de forma segura',safeNo:'No',safeStop:'Detente en un lugar seguro antes de continuar. Solo permanecen disponibles las acciones de emergencia aprobadas.',interpreted:'AGM ha entendido',clarify:'Añade algunos detalles.',notActive:'Esta función está preparada para una fase autorizada posterior. No se ha ejecutado ninguna acción.',textHint:'Escribe o dicta la solicitud.',diagnostics:'Recuperación',back:'Volver a Basic'};
finalLocale.sv={title:'AGM Copilot',subtitle:'Berätta för AGM vad du behöver. AGM väljer rätt verktyg och vägleder dig säkert.',prompt:'Hur kan jag hjälpa dig?',microphone:'Håll intryckt för att tala',camera:'Kamera / OCR',keyboard:'Text',speaker:'Lyssna',transcript:'Kontrollera vad AGM uppfattade',confirm:'Bekräfta',cancel:'Avbryt',safeQuestion:'Kan du interagera på ett säkert sätt?',safeYes:'Ja, jag står säkert parkerad',safeNo:'Nej',safeStop:'Stanna på en säker plats innan du fortsätter. Endast godkända nödåtgärder är tillgängliga.',interpreted:'AGM uppfattade',clarify:'Lägg till några fler uppgifter.',notActive:'Den här funktionen är förberedd för ett senare godkänt steg. Ingen åtgärd har utförts.',textHint:'Skriv eller diktera din begäran.',diagnostics:'Återställning',back:'Tillbaka till Basic'};
const tapToSpeak:Record<AppLanguageCode,string>={ro:'Apasă pentru a vorbi',de:'Zum Sprechen antippen',en:'Tap to speak',fr:'Appuyez pour parler',nl:'Tik om te spreken',ru:'Нажмите, чтобы говорить',pl:'Dotknij, aby mówić',tr:'Konuşmak için dokunun',sq:'Prekni për të folur',it:'Tocca per parlare',es:'Toca para hablar',sv:'Tryck för att tala'};
export const copilotText=(l:AppLanguageCode,k:K)=>k==='microphone'?tapToSpeak[l]:finalLocale[l][k];export const copilotKeys=Object.keys(en)as K[];

export const androidAssistantKeys = [
  'openAssistant',
  'shareQuestion',
  'voiceSettingsTitle',
  'voiceSettingsDescription',
  'voiceSettingsAction',
  'assistantOpened',
  'assistantUnavailable',
  'shareOpened',
  'shareUnavailable',
  'settingsOpened',
  'settingsUnavailable',
  'textRequired',
  'actionFailed',
] as const;

export type AndroidAssistantKey = (typeof androidAssistantKeys)[number];

const androidAssistantLocale: Record<AppLanguageCode, Record<AndroidAssistantKey, string>> = {
  ro: {
    openAssistant: 'Deschide asistentul telefonului', shareQuestion: 'Distribuie întrebarea',
    voiceSettingsTitle: 'Android / Voce', voiceSettingsDescription: 'Configurează intrarea și recunoașterea vocală oferite de Android.', voiceSettingsAction: 'Setări voce Android',
    assistantOpened: 'Asistentul telefonului a fost deschis.', assistantUnavailable: 'Asistentul telefonului nu este disponibil.',
    shareOpened: 'Selectorul de distribuire a fost deschis.', shareUnavailable: 'Distribuirea nu este disponibilă pe acest dispozitiv.',
    settingsOpened: 'Setările de voce Android au fost deschise.', settingsUnavailable: 'Setările de voce Android nu sunt disponibile.',
    textRequired: 'Scrieți sau dictați întâi întrebarea.', actionFailed: 'Acțiunea Android nu a putut fi deschisă.',
  },
  de: {
    openAssistant: 'Telefonassistent öffnen', shareQuestion: 'Frage teilen',
    voiceSettingsTitle: 'Android / Sprache', voiceSettingsDescription: 'Konfigurieren Sie die von Android bereitgestellte Spracheingabe und Spracherkennung.', voiceSettingsAction: 'Android-Spracheinstellungen',
    assistantOpened: 'Der Telefonassistent wurde geöffnet.', assistantUnavailable: 'Der Telefonassistent ist nicht verfügbar.',
    shareOpened: 'Die Teilen-Auswahl wurde geöffnet.', shareUnavailable: 'Teilen ist auf diesem Gerät nicht verfügbar.',
    settingsOpened: 'Die Android-Spracheinstellungen wurden geöffnet.', settingsUnavailable: 'Die Android-Spracheinstellungen sind nicht verfügbar.',
    textRequired: 'Schreiben oder diktieren Sie zuerst die Frage.', actionFailed: 'Die Android-Aktion konnte nicht geöffnet werden.',
  },
  en: {
    openAssistant: 'Open phone assistant', shareQuestion: 'Share question',
    voiceSettingsTitle: 'Android / Voice', voiceSettingsDescription: 'Configure voice input and speech recognition provided by Android.', voiceSettingsAction: 'Android voice settings',
    assistantOpened: 'The phone assistant was opened.', assistantUnavailable: 'The phone assistant is unavailable.',
    shareOpened: 'The sharing chooser was opened.', shareUnavailable: 'Sharing is unavailable on this device.',
    settingsOpened: 'Android voice settings were opened.', settingsUnavailable: 'Android voice settings are unavailable.',
    textRequired: 'Type or dictate the question first.', actionFailed: 'The Android action could not be opened.',
  },
  fr: {
    openAssistant: 'Ouvrir l’assistant du téléphone', shareQuestion: 'Partager la question',
    voiceSettingsTitle: 'Android / Voix', voiceSettingsDescription: 'Configurez la saisie et la reconnaissance vocales fournies par Android.', voiceSettingsAction: 'Paramètres vocaux Android',
    assistantOpened: 'L’assistant du téléphone a été ouvert.', assistantUnavailable: 'L’assistant du téléphone n’est pas disponible.',
    shareOpened: 'Le sélecteur de partage a été ouvert.', shareUnavailable: 'Le partage n’est pas disponible sur cet appareil.',
    settingsOpened: 'Les paramètres vocaux Android ont été ouverts.', settingsUnavailable: 'Les paramètres vocaux Android ne sont pas disponibles.',
    textRequired: 'Écrivez ou dictez d’abord la question.', actionFailed: 'L’action Android n’a pas pu être ouverte.',
  },
  nl: {
    openAssistant: 'Telefoonassistent openen', shareQuestion: 'Vraag delen',
    voiceSettingsTitle: 'Android / Spraak', voiceSettingsDescription: 'Configureer de spraakinvoer en spraakherkenning van Android.', voiceSettingsAction: 'Android-spraakinstellingen',
    assistantOpened: 'De telefoonassistent is geopend.', assistantUnavailable: 'De telefoonassistent is niet beschikbaar.',
    shareOpened: 'De deelkiezer is geopend.', shareUnavailable: 'Delen is niet beschikbaar op dit apparaat.',
    settingsOpened: 'De Android-spraakinstellingen zijn geopend.', settingsUnavailable: 'De Android-spraakinstellingen zijn niet beschikbaar.',
    textRequired: 'Typ of dicteer eerst de vraag.', actionFailed: 'De Android-actie kon niet worden geopend.',
  },
  ru: {
    openAssistant: 'Открыть ассистента телефона', shareQuestion: 'Поделиться вопросом',
    voiceSettingsTitle: 'Android / Голос', voiceSettingsDescription: 'Настройте голосовой ввод и распознавание речи Android.', voiceSettingsAction: 'Настройки голоса Android',
    assistantOpened: 'Ассистент телефона открыт.', assistantUnavailable: 'Ассистент телефона недоступен.',
    shareOpened: 'Открыт выбор приложения для отправки.', shareUnavailable: 'Отправка недоступна на этом устройстве.',
    settingsOpened: 'Настройки голоса Android открыты.', settingsUnavailable: 'Настройки голоса Android недоступны.',
    textRequired: 'Сначала введите или продиктуйте вопрос.', actionFailed: 'Не удалось открыть действие Android.',
  },
  pl: {
    openAssistant: 'Otwórz asystenta telefonu', shareQuestion: 'Udostępnij pytanie',
    voiceSettingsTitle: 'Android / Głos', voiceSettingsDescription: 'Skonfiguruj wprowadzanie głosowe i rozpoznawanie mowy systemu Android.', voiceSettingsAction: 'Ustawienia głosu Android',
    assistantOpened: 'Asystent telefonu został otwarty.', assistantUnavailable: 'Asystent telefonu jest niedostępny.',
    shareOpened: 'Otwarto wybór udostępniania.', shareUnavailable: 'Udostępnianie jest niedostępne na tym urządzeniu.',
    settingsOpened: 'Otwarto ustawienia głosu Android.', settingsUnavailable: 'Ustawienia głosu Android są niedostępne.',
    textRequired: 'Najpierw wpisz lub podyktuj pytanie.', actionFailed: 'Nie udało się otworzyć działania Android.',
  },
  tr: {
    openAssistant: 'Telefon asistanını aç', shareQuestion: 'Soruyu paylaş',
    voiceSettingsTitle: 'Android / Ses', voiceSettingsDescription: 'Android tarafından sağlanan sesli girişi ve konuşma tanımayı yapılandırın.', voiceSettingsAction: 'Android ses ayarları',
    assistantOpened: 'Telefon asistanı açıldı.', assistantUnavailable: 'Telefon asistanı kullanılamıyor.',
    shareOpened: 'Paylaşım seçici açıldı.', shareUnavailable: 'Bu cihazda paylaşım kullanılamıyor.',
    settingsOpened: 'Android ses ayarları açıldı.', settingsUnavailable: 'Android ses ayarları kullanılamıyor.',
    textRequired: 'Önce soruyu yazın veya dikte edin.', actionFailed: 'Android eylemi açılamadı.',
  },
  sq: {
    openAssistant: 'Hap asistentin e telefonit', shareQuestion: 'Ndaj pyetjen',
    voiceSettingsTitle: 'Android / Zëri', voiceSettingsDescription: 'Konfiguroni hyrjen zanore dhe njohjen e të folurit që ofron Android.', voiceSettingsAction: 'Cilësimet e zërit Android',
    assistantOpened: 'Asistenti i telefonit u hap.', assistantUnavailable: 'Asistenti i telefonit nuk është i disponueshëm.',
    shareOpened: 'Zgjedhësi i ndarjes u hap.', shareUnavailable: 'Ndarja nuk është e disponueshme në këtë pajisje.',
    settingsOpened: 'Cilësimet e zërit Android u hapën.', settingsUnavailable: 'Cilësimet e zërit Android nuk janë të disponueshme.',
    textRequired: 'Shkruani ose diktoni fillimisht pyetjen.', actionFailed: 'Veprimi Android nuk mund të hapej.',
  },
  it: {
    openAssistant: 'Apri l’assistente del telefono', shareQuestion: 'Condividi la domanda',
    voiceSettingsTitle: 'Android / Voce', voiceSettingsDescription: 'Configura l’input vocale e il riconoscimento vocale forniti da Android.', voiceSettingsAction: 'Impostazioni voce Android',
    assistantOpened: 'L’assistente del telefono è stato aperto.', assistantUnavailable: 'L’assistente del telefono non è disponibile.',
    shareOpened: 'Il selettore di condivisione è stato aperto.', shareUnavailable: 'La condivisione non è disponibile su questo dispositivo.',
    settingsOpened: 'Le impostazioni voce Android sono state aperte.', settingsUnavailable: 'Le impostazioni voce Android non sono disponibili.',
    textRequired: 'Prima scrivi o detta la domanda.', actionFailed: 'Non è stato possibile aprire l’azione Android.',
  },
  es: {
    openAssistant: 'Abrir el asistente del teléfono', shareQuestion: 'Compartir la pregunta',
    voiceSettingsTitle: 'Android / Voz', voiceSettingsDescription: 'Configura la entrada de voz y el reconocimiento de voz proporcionados por Android.', voiceSettingsAction: 'Ajustes de voz de Android',
    assistantOpened: 'Se abrió el asistente del teléfono.', assistantUnavailable: 'El asistente del teléfono no está disponible.',
    shareOpened: 'Se abrió el selector para compartir.', shareUnavailable: 'La función de compartir no está disponible en este dispositivo.',
    settingsOpened: 'Se abrieron los ajustes de voz de Android.', settingsUnavailable: 'Los ajustes de voz de Android no están disponibles.',
    textRequired: 'Primero escribe o dicta la pregunta.', actionFailed: 'No se pudo abrir la acción de Android.',
  },
  sv: {
    openAssistant: 'Öppna telefonassistenten', shareQuestion: 'Dela frågan',
    voiceSettingsTitle: 'Android / Röst', voiceSettingsDescription: 'Konfigurera röstinmatning och taligenkänning som tillhandahålls av Android.', voiceSettingsAction: 'Android-röstinställningar',
    assistantOpened: 'Telefonassistenten öppnades.', assistantUnavailable: 'Telefonassistenten är inte tillgänglig.',
    shareOpened: 'Delningsväljaren öppnades.', shareUnavailable: 'Delning är inte tillgänglig på den här enheten.',
    settingsOpened: 'Android-röstinställningarna öppnades.', settingsUnavailable: 'Android-röstinställningarna är inte tillgängliga.',
    textRequired: 'Skriv eller diktera frågan först.', actionFailed: 'Android-åtgärden kunde inte öppnas.',
  },
};

export function androidAssistantText(language: AppLanguageCode, key: AndroidAssistantKey) {
  return androidAssistantLocale[language][key];
}
