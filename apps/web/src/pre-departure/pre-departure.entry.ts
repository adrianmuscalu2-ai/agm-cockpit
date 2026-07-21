import './pre-departure.styles.css';
import { mountPreDepartureShell } from './pre-departure.controller';

const root = document.querySelector<HTMLElement>('#before-departure-app');

if (!root) {
  throw new Error('Before-departure app root not found.');
}

mountPreDepartureShell(root);
