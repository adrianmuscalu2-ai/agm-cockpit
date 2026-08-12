import type { BasicLanguageCode } from '../language-registry';

const contactRequest = /telefon|număr|numar|contact|tract|service|firmă|firma|adres|phone|number|tow|company|address|nummer|abschlepp|kontakt|adresse/i;
const refusal: Record<BasicLanguageCode,string> = {
  ro:'Nu pot furniza încă un contact local verificat deoarece AGM nu are în această etapă acces la o sursă live verificată. Nu voi inventa numere, firme sau adrese.',
  de:'Ich kann noch keinen verifizierten lokalen Kontakt angeben, weil AGM derzeit keinen Zugriff auf eine verifizierte Live-Quelle hat. Ich erfinde keine Telefonnummern, Firmen oder Adressen.',
  en:'I cannot yet provide a verified local contact because AGM does not currently have access to a verified live source. I will not invent phone numbers, companies, or addresses.',
  fr:'Je ne peux pas encore fournir un contact local vérifié, car AGM ne dispose pas actuellement d’une source en direct vérifiée. Je n’inventerai aucun numéro, entreprise ou adresse.',
  nl:'Ik kan nog geen geverifieerd lokaal contact geven, omdat AGM momenteel geen toegang heeft tot een geverifieerde livebron. Ik verzin geen telefoonnummers, bedrijven of adressen.',
  ru:'Я пока не могу предоставить проверенный местный контакт, поскольку у AGM сейчас нет доступа к проверенному источнику в реальном времени. Я не буду придумывать номера, компании или адреса.',
  pl:'Nie mogę jeszcze podać zweryfikowanego lokalnego kontaktu, ponieważ AGM nie ma obecnie dostępu do zweryfikowanego źródła na żywo. Nie będę wymyślać numerów, firm ani adresów.',
  tr:'AGM şu anda doğrulanmış canlı bir kaynağa erişemediği için henüz doğrulanmış yerel iletişim bilgisi veremem. Telefon numarası, şirket veya adres uydurmayacağım.',
  sq:'Nuk mund të jap ende një kontakt lokal të verifikuar, sepse AGM aktualisht nuk ka qasje në një burim të verifikuar drejtpërdrejt. Nuk do të shpik numra telefoni, kompani ose adresa.',
};

export function enforceVerifiedContactBoundary(query:string,response:string,language:BasicLanguageCode){
  if(!contactRequest.test(query))return response;
  return refusal[language];
}
