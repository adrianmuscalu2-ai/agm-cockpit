import './after-departure.styles.css';
import { mountAfterDepartureApp } from './after-departure.controller';

const root = document.querySelector<HTMLElement>('#after-departure-app');

if (!root) {
  throw new Error('After-departure app root not found.');
}

mountAfterDepartureApp(root);
