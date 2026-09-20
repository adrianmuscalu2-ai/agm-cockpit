import type { BasicLanguageCode } from '../language-registry';
import type { PremiumAssistantClientError } from './premium-assistant.client';

type ClientFailureReason = PremiumAssistantClientError['reason'];

const messages: Record<'ro' | 'de' | 'en', Record<ClientFailureReason, string>> = {
  ro: {
    'authentication-required': 'Sesiunea AGM nu a putut fi reînnoită. Autentifică-te din nou. Datele personale nu au fost consultate.',
    'premium-required': 'Sesiunea curentă nu are acces Premium. Datele personale nu au fost consultate.',
    network: 'Conexiunea cu serviciul AGM nu este disponibilă. Datele personale nu au fost consultate.',
    'provider-unavailable': 'Serviciul AGM nu a ajuns la resolverul autorizat. Încearcă din nou. Nu am folosit un răspuns generic.',
    'invalid-response': 'Serviciul AGM a returnat un răspuns invalid înainte de rezolvarea cererii. Încearcă din nou.',
  },
  de: {
    'authentication-required': 'Die AGM-Sitzung konnte nicht erneuert werden. Melden Sie sich erneut an. Private Daten wurden nicht gelesen.',
    'premium-required': 'Diese Sitzung hat keinen Premium-Zugriff. Private Daten wurden nicht gelesen.',
    network: 'Der AGM-Dienst ist nicht erreichbar. Private Daten wurden nicht gelesen.',
    'provider-unavailable': 'Der AGM-Dienst hat den autorisierten Resolver nicht erreicht. Bitte versuchen Sie es erneut.',
    'invalid-response': 'Der AGM-Dienst hat vor der Auflösung der Anfrage eine ungültige Antwort geliefert. Bitte versuchen Sie es erneut.',
  },
  en: {
    'authentication-required': 'The AGM session could not be renewed. Sign in again. Personal data was not read.',
    'premium-required': 'This session does not have Premium access. Personal data was not read.',
    network: 'The AGM service is unreachable. Personal data was not read.',
    'provider-unavailable': 'The AGM service did not reach the authorized resolver. Try again. No generic answer was used.',
    'invalid-response': 'The AGM service returned an invalid response before resolving the request. Try again.',
  },
};

export function premiumAssistantFailureMessage(reason: ClientFailureReason, language: BasicLanguageCode) {
  const localized = language === 'ro' || language === 'de' ? language : 'en';
  return messages[localized][reason];
}
