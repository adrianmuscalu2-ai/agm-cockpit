const webBuildInput = Object.freeze({
  main: 'index.html',
  beforeDeparture: 'before-departure.html',
  afterDeparture: 'after-departure.html',
});

export function createWebBuildDefinition() {
  return {
    plugins: [createAfterDepartureEntryPlugin()],
    build: {
      rollupOptions: {
        input: { ...webBuildInput },
      },
    },
  };
}

function createAfterDepartureEntryPlugin() {
  return {
    name: 'poc02-after-departure-entry',
    transformIndexHtml(html, context) {
      if (context.path !== '/index.html') {
        return html;
      }
      return html.replace(
        '</body>',
        `<nav aria-label="POC 02" style="display:flex;justify-content:center;padding:12px;background:#071018">
          <a href="/after-departure.html" data-poc02-entry="after-departure" style="color:#bfeeff;font:600 14px/1.4 system-ui;text-decoration:none">
            POC 02 · După Plecare / Nach der Abfahrt / After Departure
          </a>
        </nav></body>`,
      );
    },
  };
}
