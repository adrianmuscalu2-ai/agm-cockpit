import type { BasicLanguageCode } from '../language-registry';

export const premiumVoiceShellMessageKeys = [
  'title', 'description', 'start', 'stop', 'cancel', 'retry',
  'requestingPermission', 'listening', 'processing', 'reviewTranscript',
  'confirmTranscript', 'confirmed', 'permissionDenied', 'microphoneUnavailable',
  'recognitionUnavailable', 'recognitionFailed', 'noSpeechDetected',
] as const;

export type PremiumVoiceShellMessageKey = (typeof premiumVoiceShellMessageKeys)[number];
type PremiumVoiceShellMessages = Record<PremiumVoiceShellMessageKey, string>;

export const premiumVoiceShellMessages: Record<BasicLanguageCode, PremiumVoiceShellMessages> = {
  ro: {
    title: 'Vorbește cu AGM', description: 'Spune o solicitare scurtă și verifică transcrierea înainte de continuare.',
    start: 'Începe să vorbești', stop: 'Oprește ascultarea', cancel: 'Anulează', retry: 'Încearcă din nou',
    requestingPermission: 'Se solicită accesul la microfon.', listening: 'Microfon activ. Vorbește acum.',
    processing: 'Vocea este transcrisă.', reviewTranscript: 'Verifică transcrierea.',
    confirmTranscript: 'Confirmă transcrierea', confirmed: 'Transcriere confirmată.',
    permissionDenied: 'Permisiunea pentru microfon a fost refuzată.',
    microphoneUnavailable: 'Microfonul nu este disponibil.', recognitionUnavailable: 'Recunoașterea vocală nu este disponibilă.',
    recognitionFailed: 'Vocea nu a putut fi transcrisă.', noSpeechDetected: 'Nu a fost detectată nicio voce.',
  },
  de: {
    title: 'Mit AGM sprechen', description: 'Sprechen Sie eine kurze Anfrage und prüfen Sie das Transkript, bevor Sie fortfahren.',
    start: 'Sprechen starten', stop: 'Zuhören beenden', cancel: 'Abbrechen', retry: 'Erneut versuchen',
    requestingPermission: 'Mikrofonzugriff wird angefordert.', listening: 'Mikrofon aktiv. Sprechen Sie jetzt.',
    processing: 'Die Sprache wird transkribiert.', reviewTranscript: 'Transkript prüfen.',
    confirmTranscript: 'Transkript bestätigen', confirmed: 'Transkript bestätigt.',
    permissionDenied: 'Die Mikrofonberechtigung wurde verweigert.', microphoneUnavailable: 'Das Mikrofon ist nicht verfügbar.',
    recognitionUnavailable: 'Die Spracherkennung ist nicht verfügbar.', recognitionFailed: 'Die Sprache konnte nicht transkribiert werden.',
    noSpeechDetected: 'Es wurde keine Sprache erkannt.',
  },
  en: {
    title: 'Talk to AGM', description: 'Speak a short request and review the transcript before continuing.',
    start: 'Start speaking', stop: 'Stop listening', cancel: 'Cancel', retry: 'Try again',
    requestingPermission: 'Requesting microphone access.', listening: 'Microphone active. Speak now.',
    processing: 'Your speech is being transcribed.', reviewTranscript: 'Review the transcript.',
    confirmTranscript: 'Confirm transcript', confirmed: 'Transcript confirmed.',
    permissionDenied: 'Microphone permission was denied.', microphoneUnavailable: 'The microphone is unavailable.',
    recognitionUnavailable: 'Speech recognition is unavailable.', recognitionFailed: 'Your speech could not be transcribed.',
    noSpeechDetected: 'No speech was detected.',
  },
  fr: {
    title: 'Parler à AGM', description: 'Énoncez une demande courte et vérifiez la transcription avant de continuer.',
    start: 'Commencer à parler', stop: "Arrêter l'écoute", cancel: 'Annuler', retry: 'Réessayer',
    requestingPermission: "Demande d'accès au microphone.", listening: 'Microphone actif. Parlez maintenant.',
    processing: 'Votre voix est en cours de transcription.', reviewTranscript: 'Vérifiez la transcription.',
    confirmTranscript: 'Confirmer la transcription', confirmed: 'Transcription confirmée.',
    permissionDenied: 'La permission du microphone a été refusée.', microphoneUnavailable: "Le microphone n'est pas disponible.",
    recognitionUnavailable: "La reconnaissance vocale n'est pas disponible.", recognitionFailed: "La voix n'a pas pu être transcrite.",
    noSpeechDetected: "Aucune voix n'a été détectée.",
  },
  nl: {
    title: 'Praat met AGM', description: 'Spreek een kort verzoek in en controleer het transcript voordat u doorgaat.',
    start: 'Begin met spreken', stop: 'Stop met luisteren', cancel: 'Annuleren', retry: 'Opnieuw proberen',
    requestingPermission: 'Microfoontoegang wordt aangevraagd.', listening: 'Microfoon actief. Spreek nu.',
    processing: 'Uw spraak wordt getranscribeerd.', reviewTranscript: 'Controleer het transcript.',
    confirmTranscript: 'Transcript bevestigen', confirmed: 'Transcript bevestigd.',
    permissionDenied: 'Microfoontoestemming is geweigerd.', microphoneUnavailable: 'De microfoon is niet beschikbaar.',
    recognitionUnavailable: 'Spraakherkenning is niet beschikbaar.', recognitionFailed: 'De spraak kon niet worden getranscribeerd.',
    noSpeechDetected: 'Er is geen spraak gedetecteerd.',
  },
  ru: {
    title: 'Поговорить с AGM', description: 'Произнесите короткий запрос и проверьте расшифровку перед продолжением.',
    start: 'Начать говорить', stop: 'Остановить прослушивание', cancel: 'Отмена', retry: 'Повторить',
    requestingPermission: 'Запрашивается доступ к микрофону.', listening: 'Микрофон активен. Говорите.',
    processing: 'Речь преобразуется в текст.', reviewTranscript: 'Проверьте расшифровку.',
    confirmTranscript: 'Подтвердить расшифровку', confirmed: 'Расшифровка подтверждена.',
    permissionDenied: 'Доступ к микрофону отклонён.', microphoneUnavailable: 'Микрофон недоступен.',
    recognitionUnavailable: 'Распознавание речи недоступно.', recognitionFailed: 'Не удалось преобразовать речь в текст.',
    noSpeechDetected: 'Речь не обнаружена.',
  },
  pl: {
    title: 'Porozmawiaj z AGM', description: 'Wypowiedz krótką prośbę i sprawdź transkrypcję przed kontynuowaniem.',
    start: 'Zacznij mówić', stop: 'Zatrzymaj nasłuchiwanie', cancel: 'Anuluj', retry: 'Spróbuj ponownie',
    requestingPermission: 'Trwa prośba o dostęp do mikrofonu.', listening: 'Mikrofon aktywny. Mów teraz.',
    processing: 'Mowa jest transkrybowana.', reviewTranscript: 'Sprawdź transkrypcję.',
    confirmTranscript: 'Potwierdź transkrypcję', confirmed: 'Transkrypcja potwierdzona.',
    permissionDenied: 'Odmówiono dostępu do mikrofonu.', microphoneUnavailable: 'Mikrofon jest niedostępny.',
    recognitionUnavailable: 'Rozpoznawanie mowy jest niedostępne.', recognitionFailed: 'Nie udało się przepisać mowy.',
    noSpeechDetected: 'Nie wykryto mowy.',
  },
  tr: {
    title: 'AGM ile konuş', description: 'Kısa bir istek söyleyin ve devam etmeden önce dökümü kontrol edin.',
    start: 'Konuşmaya başla', stop: 'Dinlemeyi durdur', cancel: 'İptal', retry: 'Tekrar dene',
    requestingPermission: 'Mikrofon erişimi isteniyor.', listening: 'Mikrofon etkin. Şimdi konuşun.',
    processing: 'Konuşmanız metne dönüştürülüyor.', reviewTranscript: 'Dökümü kontrol edin.',
    confirmTranscript: 'Dökümü onayla', confirmed: 'Döküm onaylandı.',
    permissionDenied: 'Mikrofon izni reddedildi.', microphoneUnavailable: 'Mikrofon kullanılamıyor.',
    recognitionUnavailable: 'Konuşma tanıma kullanılamıyor.', recognitionFailed: 'Konuşma metne dönüştürülemedi.',
    noSpeechDetected: 'Konuşma algılanmadı.',
  },
  sq: {
    title: 'Flisni me AGM', description: 'Thoni një kërkesë të shkurtër dhe kontrolloni transkriptin para se të vazhdoni.',
    start: 'Filloni të flisni', stop: 'Ndaloni dëgjimin', cancel: 'Anulo', retry: 'Provo përsëri',
    requestingPermission: 'Po kërkohet qasja në mikrofon.', listening: 'Mikrofoni është aktiv. Flisni tani.',
    processing: 'Zëri po transkriptohet.', reviewTranscript: 'Kontrolloni transkriptin.',
    confirmTranscript: 'Konfirmo transkriptin', confirmed: 'Transkripti u konfirmua.',
    permissionDenied: 'Leja për mikrofonin u refuzua.', microphoneUnavailable: 'Mikrofoni nuk është i disponueshëm.',
    recognitionUnavailable: 'Njohja e të folurit nuk është e disponueshme.', recognitionFailed: 'Zëri nuk mund të transkriptohej.',
    noSpeechDetected: 'Nuk u zbulua asnjë zë.',
  },
  it: { title:'Parla con AGM', description:'Pronuncia una breve richiesta e controlla la trascrizione prima di continuare.', start:'Inizia a parlare', stop:'Interrompi l’ascolto', cancel:'Annulla', retry:'Riprova', requestingPermission:'Richiesta di accesso al microfono.', listening:'Microfono attivo. Parla ora.', processing:'La voce viene trascritta.', reviewTranscript:'Controlla la trascrizione.', confirmTranscript:'Conferma trascrizione', confirmed:'Trascrizione confermata.', permissionDenied:'L’autorizzazione per il microfono è stata negata.', microphoneUnavailable:'Il microfono non è disponibile.', recognitionUnavailable:'Il riconoscimento vocale non è disponibile.', recognitionFailed:'Impossibile trascrivere la voce.', noSpeechDetected:'Non è stata rilevata alcuna voce.' },
  es: { title:'Hablar con AGM', description:'Di una solicitud breve y revisa la transcripción antes de continuar.', start:'Empezar a hablar', stop:'Dejar de escuchar', cancel:'Cancelar', retry:'Intentar de nuevo', requestingPermission:'Solicitando acceso al micrófono.', listening:'Micrófono activo. Habla ahora.', processing:'Se está transcribiendo tu voz.', reviewTranscript:'Revisa la transcripción.', confirmTranscript:'Confirmar transcripción', confirmed:'Transcripción confirmada.', permissionDenied:'Se ha denegado el permiso del micrófono.', microphoneUnavailable:'El micrófono no está disponible.', recognitionUnavailable:'El reconocimiento de voz no está disponible.', recognitionFailed:'No se pudo transcribir tu voz.', noSpeechDetected:'No se ha detectado voz.' },
  sv: { title:'Prata med AGM', description:'Säg en kort begäran och kontrollera transkriberingen innan du fortsätter.', start:'Börja tala', stop:'Sluta lyssna', cancel:'Avbryt', retry:'Försök igen', requestingPermission:'Begär åtkomst till mikrofonen.', listening:'Mikrofonen är aktiv. Tala nu.', processing:'Ditt tal transkriberas.', reviewTranscript:'Kontrollera transkriberingen.', confirmTranscript:'Bekräfta transkribering', confirmed:'Transkriberingen har bekräftats.', permissionDenied:'Mikrofonbehörighet nekades.', microphoneUnavailable:'Mikrofonen är inte tillgänglig.', recognitionUnavailable:'Taligenkänning är inte tillgänglig.', recognitionFailed:'Ditt tal kunde inte transkriberas.', noSpeechDetected:'Inget tal upptäcktes.' },
};

export function premiumVoiceShellMessage(language: BasicLanguageCode, key: PremiumVoiceShellMessageKey) {
  return premiumVoiceShellMessages[language][key];
}
