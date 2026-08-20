import './pre-departure.styles.css';
import '../premium-situation-router/required-document.component';
import '../premium-situation-router/field-batch.component';
import { mountPreDepartureShell } from './pre-departure.controller';
import { bindSensitiveSessionCleanup, purgeSensitiveLegacyLocalStorage } from '../storage/sensitive-storage-policy';

purgeSensitiveLegacyLocalStorage(window.localStorage);
bindSensitiveSessionCleanup(window.sessionStorage);

const root = document.querySelector<HTMLElement>('#before-departure-app');

if (!root) {
  throw new Error('Before-departure app root not found.');
}

mountPreDepartureShell(root);
