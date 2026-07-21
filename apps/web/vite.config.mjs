import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'poc02-after-departure-entry',
      transformIndexHtml(html, context) {
        if (context.path !== '/index.html') {
          return html;
        }
        return html.replace(
          '</body>',
          `<nav aria-label="POC 02" style="display:flex;justify-content:center;padding:12px;background:#071018">
            <a href="/after-departure.html" data-poc02-entry="after-departure" style="color:#bfeeff;font:600 14px/1.4 system-ui;text-decoration:none">
              POC 02 Â· DupÄƒ Plecare / Nach der Abfahrt / After Departure
            </a>
          </nav></body>`,
        );
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        beforeDeparture: 'before-departure.html',
        afterDeparture: 'after-departure.html',
      },
    },
  },
});
