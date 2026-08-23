import type { BasicLanguageCode } from '../language-registry';
import { carMoverText as x } from './car-mover.i18n';

export function renderCarMoverView(l:BasicLanguageCode){
  const classes=[['PASSENGER_CAR','passenger'],['LIGHT_COMMERCIAL','commercial'],['VAN','van'],['TRUCK','truck'],['TRACTOR_UNIT','tractor'],['OTHER_DRIVABLE_VEHICLE','other']] as const;
  return `<section class="car-mover" data-car-mover-root data-language="${l}">
    <header><div><small>${x(l,'isolation')}</small><h1>${x(l,'title')}</h1><p>${x(l,'subtitle')}</p></div><a href="/premium" data-module="premium">${x(l,'back')}</a></header>
    <div class="car-mover-grid">
      <form data-car-mover-create><h2>${x(l,'newJob')}</h2><label>${x(l,'vehicleClass')}<select name="vehicleClass" required><option value="">${x(l,'select')}</option>${classes.map(([v,k])=>`<option value="${v}">${x(l,k)}</option>`).join('')}</select></label><label>${x(l,'vehicleType')}<input name="vehicleType" required maxlength="80"></label><div class="car-mover-pair"><label>${x(l,'make')}<input name="make" maxlength="120"></label><label>${x(l,'model')}<input name="model" maxlength="120"></label></div><div class="car-mover-pair"><label>${x(l,'vin')}<input name="vin" maxlength="32"></label><label>${x(l,'registration')}<input name="registration" maxlength="32"></label></div><label>${x(l,'pickup')}<input name="pickup" required maxlength="240"></label><label>${x(l,'destination')}<input name="destination" required maxlength="240"></label><button class="primary" type="submit">${x(l,'create')}</button><p role="status" data-car-mover-status></p></form>
      <section><div class="car-mover-section-title"><h2>${x(l,'jobs')}</h2><button data-car-mover-refresh>${x(l,'refresh')}</button></div><div data-car-mover-list>${x(l,'loading')}</div></section>
    </div>
    <section class="car-mover-offers"><div class="car-mover-section-title"><div><h2>Alerte platforme și propuneri de curse</h2><p>Gmail și WhatsApp · extragere controlată · fără acceptare automată</p><p data-car-mover-provider-status>Starea furnizorilor se verifică…</p></div><button type="button" data-car-mover-analyze>Extrage și analizează</button></div><div data-car-mover-offers>Nu există încă propuneri analizate.</div></section>
    <dialog data-car-mover-dialog><button data-car-mover-close aria-label="Close">×</button><div data-car-mover-file></div></dialog>
  </section>`;
}
