import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const source = await readFile('apps/web/src/premium-capabilities/local-wake.runtime.ts', 'utf8');
const template = source.match(/section.innerHTML = `([\s\S]*?)`;/)[1];
const markup = new Function('ro', 'return `' + template + '`;')(true);
const browser = await chromium.launch({headless:true});
const cases=[];
try {
  for (const width of [360,390,1440]) {
    const page=await browser.newPage({viewport:{width,height:844}});
    await page.setContent(`<body class="premium-copilot-view"><main><section class="local-wake-panel" data-local-wake>${markup}</section></main></body>`);
    for (const file of ['styles/00-foundation.css','premium-copilot/copilot.css','premium-capabilities/local-wake.css']) {
      await page.addStyleTag({content:await readFile('apps/web/src/'+file,'utf8')});
    }
    const panel=await page.locator('[data-local-wake]').boundingBox();
    const content=await page.locator('[data-local-wake] .premium-module-content').boundingBox();
    assert.ok(content.width>Math.min(width*.65,500));
    assert.ok(panel.height<800);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.locator('[data-wake-arm]').click();
    await page.screenshot({path:`evidence/agma-release-1.9.2/wake-layout-${width}.png`,fullPage:true});
    cases.push({width,panel,content,status:'PASS'});
    await page.close();
  }
  await writeFile('evidence/agma-release-1.9.2/wake-layout-report.json',JSON.stringify({scope:'Native panel markup with actual shared and dedicated CSS; no native behavior simulated',cases},null,2));
  console.log(JSON.stringify(cases));
} finally { await browser.close(); }
