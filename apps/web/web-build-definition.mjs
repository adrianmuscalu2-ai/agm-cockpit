const webBuildInput = Object.freeze({
  main: 'index.html',
  beforeDeparture: 'before-departure.html',
  afterDeparture: 'after-departure.html',
});

export function createWebBuildDefinition() {
  return {
    plugins: [],
    build: {
      rollupOptions: {
        input: { ...webBuildInput },
      },
    },
  };
}
