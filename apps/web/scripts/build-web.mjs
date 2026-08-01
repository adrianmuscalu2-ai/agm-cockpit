import { build } from 'vite';
import { createWebBuildDefinition } from '../web-build-definition.mjs';

await build({
  configFile: false,
  ...createWebBuildDefinition(),
});
