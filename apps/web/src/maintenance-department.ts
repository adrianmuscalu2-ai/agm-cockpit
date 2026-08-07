import { type UiLanguage } from './i18n/app-i18n.types';

export type MaintenanceDepartmentMember = {
  id: string;
  icon: string;
  name: Record<MaintenanceLanguage, string>;
  title: Record<MaintenanceLanguage, string>;
  responsibilities: Record<MaintenanceLanguage, string[]>;
  authority: Record<MaintenanceLanguage, string>;
};

export const maintenanceDepartmentMembers: MaintenanceDepartmentMember[] = [
  {
    id: 'atlas', icon: '🧭',
    name: localized('Atlas (Codex)', 'Atlas (Codex)', 'Atlas (Codex)'),
    title: localized('Director Tehnic și Coordonator Mentenanță', 'Technischer Direktor und Wartungskoordinator', 'Technical Director and Maintenance Coordinator'),
    responsibilities: localizedList(
      ['Coordonare tehnică și arhitectură', 'Prioritizarea incidentelor și implementărilor', 'Aprobarea tehnică finală'],
      ['Technische Koordination und Architektur', 'Priorisierung von Vorfällen und Implementierungen', 'Abschließende technische Freigabe'],
      ['Technical coordination and architecture', 'Prioritization of incidents and implementations', 'Final technical approval'],
    ),
    authority: localized('Aprobă soluția tehnică; nu poate înlocui validarea QA sau umană.', 'Genehmigt die technische Lösung; ersetzt keine QA- oder menschliche Validierung.', 'Approves the technical solution; cannot replace QA or human validation.'),
  },
  {
    id: 'inspector', icon: '🔎',
    name: localized('Inspector', 'Inspector', 'Inspector'),
    title: localized('Director Controlul Calității', 'Direktor Qualitätskontrolle', 'Quality Control Director'),
    responsibilities: localizedList(
      ['Validare independentă', 'Audit funcțional și teste de regresie', 'Verificare înainte de publicare'],
      ['Unabhängige Validierung', 'Funktionsaudit und Regressionstests', 'Prüfung vor Veröffentlichung'],
      ['Independent validation', 'Functional audit and regression testing', 'Pre-release verification'],
    ),
    authority: localized('Poate bloca publicarea; nu aprobă propria implementare.', 'Kann eine Veröffentlichung blockieren; genehmigt keine eigene Implementierung.', 'May block release; does not approve its own implementation.'),
  },
  {
    id: 'turn', icon: '📡',
    name: localized('Turn Command Center', 'Turn Command Center', 'Turn Command Center'),
    title: localized('Director Operațiuni', 'Direktor Betrieb', 'Operations Director'),
    responsibilities: localizedList(
      ['Monitorizarea serviciilor', 'Gestionarea incidentelor și intervențiilor', 'Urmărirea până la validare și arhivare'],
      ['Überwachung der Dienste', 'Verwaltung von Vorfällen und Eingriffen', 'Nachverfolgung bis Validierung und Archivierung'],
      ['Service monitoring', 'Incident and intervention management', 'Tracking through validation and archiving'],
    ),
    authority: localized('Administrează ciclul operațional; nu declară singur remedierea validată.', 'Verwaltet den Betriebszyklus; erklärt eine Behebung nicht allein für validiert.', 'Administers the operational lifecycle; cannot validate a remediation alone.'),
  },
  {
    id: 'chronicler', icon: '📚',
    name: localized('Cronicarul AGM', 'AGM-Chronist', 'AGM Chronicler'),
    title: localized('Director Memorie Operațională', 'Direktor Betriebsgedächtnis', 'Operational Memory Director'),
    responsibilities: localizedList(
      ['Cronologia proiectului și istoricul soluțiilor', 'Lecții învățate și decizii documentate', 'Rapoarte executive și statistici de stabilitate'],
      ['Projektchronologie und Lösungsverlauf', 'Erkenntnisse und dokumentierte Entscheidungen', 'Managementberichte und Stabilitätsstatistiken'],
      ['Project chronology and solution history', 'Lessons learned and documented decisions', 'Executive reports and stability statistics'],
    ),
    authority: localized('Consemnează și corelează; nu rescrie sau șterge istoricul validat.', 'Dokumentiert und verknüpft; schreibt validierte Historie nicht um und löscht sie nicht.', 'Records and correlates; cannot rewrite or delete validated history.'),
  },
  {
    id: 'librarian', icon: '📖',
    name: localized('Bibliotecarul Lingvist', 'Sprachbibliothekar', 'Linguistic Librarian'),
    title: localized('Director Cunoaștere Reutilizabilă', 'Direktor Wiederverwendbares Wissen', 'Reusable Knowledge Director'),
    responsibilities: localizedList(
      ['Biblioteca de mesaje și terminologie profesională', 'Șabloane multilingve RO/DE/EN', 'Reutilizarea conținutului validat'],
      ['Nachrichtenbibliothek und Fachterminologie', 'Mehrsprachige Vorlagen RO/DE/EN', 'Wiederverwendung validierter Inhalte'],
      ['Message library and professional terminology', 'Multilingual RO/DE/EN templates', 'Reuse of validated content'],
    ),
    authority: localized('Propune și verifică; publicarea necesită aprobare umană.', 'Schlägt vor und prüft; Veröffentlichung erfordert menschliche Freigabe.', 'Proposes and reviews; publishing requires human approval.'),
  },
];

export function renderMaintenanceDepartment(language: UiLanguage) {
  const effectiveLanguage = language === 'ro' || language === 'de' ? language : 'en';
  const copy = departmentCopy[effectiveLanguage];
  return `<section class="maintenance-department" aria-labelledby="maintenance-department-title">
    <header><div><span>AGM · PERMANENT DEPARTMENT</span><h2 id="maintenance-department-title">${escapeHtml(copy.title)}</h2><p>${escapeHtml(copy.mission)}</p></div><strong class="maintenance-official">${escapeHtml(copy.official)}</strong></header>
    <div class="maintenance-principles"><strong>${escapeHtml(copy.rule)}</strong><ol><li>${escapeHtml(copy.step1)}</li><li>${escapeHtml(copy.step2)}</li><li>${escapeHtml(copy.step3)}</li><li>${escapeHtml(copy.step4)}</li><li>${escapeHtml(copy.step5)}</li><li>${escapeHtml(copy.step6)}</li></ol></div>
    <div class="maintenance-members">${maintenanceDepartmentMembers.map((member) => `<article><header><span>${member.icon}</span><div><strong>${escapeHtml(member.name[effectiveLanguage])}</strong><small>${escapeHtml(member.title[effectiveLanguage])}</small></div></header><ul>${member.responsibilities[effectiveLanguage].map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p><strong>${escapeHtml(copy.authority)}:</strong> ${escapeHtml(member.authority[effectiveLanguage])}</p></article>`).join('')}</div>
    <footer><strong>${escapeHtml(copy.principle)}</strong><p>${escapeHtml(copy.principleText)}</p></footer>
  </section>`;
}

type MaintenanceLanguage = 'ro' | 'de' | 'en';
function localized(ro: string, de: string, en: string): Record<MaintenanceLanguage, string> { return { ro, de, en }; }
function localizedList(ro: string[], de: string[], en: string[]): Record<MaintenanceLanguage, string[]> { return { ro, de, en }; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character); }

const departmentCopy: Record<MaintenanceLanguage, Record<string, string>> = {
  ro: { title: 'Departamentul AGM – Mentenanță, Calitate și Evoluție', mission: 'Asigură stabilitatea platformei, păstrează experiența acumulată și transformă fiecare incident și implementare într-un avantaj reutilizabil.', official: 'ÎNFIINȚAT OFICIAL', rule: 'Flux operațional obligatoriu', step1: 'Incident sau propunere înregistrată', step2: 'Analiză și decizie tehnică Atlas', step3: 'Implementare controlată', step4: 'Test automat și audit Inspector', step5: 'Test real și validare umană', step6: 'Documentare, standard AGM și arhivare Turn', authority: 'Limită de autoritate', principle: 'Regula oficială AGM', principleText: 'Nicio eroare rezolvată nu se pierde. Nicio soluție validată nu se reinventează. Nicio decizie importantă nu rămâne nedocumentată.' },
  de: { title: 'AGM-Abteilung – Wartung, Qualität und Weiterentwicklung', mission: 'Sichert die Plattformstabilität, bewahrt Erfahrungen und macht jeden Vorfall und jede Implementierung wiederverwendbar.', official: 'OFFIZIELL GEGRÜNDET', rule: 'Verbindlicher Betriebsablauf', step1: 'Vorfall oder Vorschlag erfasst', step2: 'Analyse und technische Atlas-Entscheidung', step3: 'Kontrollierte Implementierung', step4: 'Automatischer Test und Inspector-Audit', step5: 'Praxistest und menschliche Validierung', step6: 'Dokumentation, AGM-Standard und Turn-Archivierung', authority: 'Befugnisgrenze', principle: 'Offizielle AGM-Regel', principleText: 'Kein gelöster Fehler geht verloren. Keine validierte Lösung wird neu erfunden. Keine wichtige Entscheidung bleibt undokumentiert.' },
  en: { title: 'AGM Department – Maintenance, Quality and Evolution', mission: 'Ensures platform stability, preserves accumulated experience, and turns every incident and implementation into reusable advantage.', official: 'OFFICIALLY ESTABLISHED', rule: 'Mandatory operational workflow', step1: 'Incident or proposal recorded', step2: 'Atlas analysis and technical decision', step3: 'Controlled implementation', step4: 'Automated test and Inspector audit', step5: 'Real-world test and human validation', step6: 'Documentation, AGM standard, and Turn archiving', authority: 'Authority boundary', principle: 'Official AGM rule', principleText: 'No resolved error is lost. No validated solution is reinvented. No important decision remains undocumented.' },
};
