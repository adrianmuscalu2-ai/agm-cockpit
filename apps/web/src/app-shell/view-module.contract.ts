import type { AppState, AppViewName } from './app-state.contract';

export type ViewModuleContext<State = AppState> = {
  state: State;
  root: HTMLElement;
};

export type ViewModule<State = AppState> = {
  readonly id: string;
  readonly view: AppViewName;
  render(context: Readonly<ViewModuleContext<State>>): string;
  bind(context: ViewModuleContext<State>): void;
  dispose?(context: ViewModuleContext<State>): void;
};

export type ViewModuleRegistration = {
  readonly id: string;
  readonly view: AppViewName;
  readonly owner: keyof AppState;
  readonly activation: 'legacy-main';
  readonly lifecycle: readonly ['render', 'bind'];
};

export type AppEntrypointRegistration = {
  readonly id: 'main' | 'beforeDeparture' | 'afterDeparture';
  readonly html: 'index.html' | 'before-departure.html' | 'after-departure.html';
  readonly activation: 'legacy-main' | 'external-entrypoint';
};
