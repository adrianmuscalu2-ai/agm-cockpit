import { createWorker, PSM } from 'tesseract.js';

const imagePath = process.argv[2];
if (!imagePath) throw new Error('Image path is required.');

const worker = await createWorker('eng');
try {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
  const result = await worker.recognize(imagePath);
  console.log(JSON.stringify({ confidence: Math.round(result.data.confidence), text: result.data.text.trim() }, null, 2));
} finally {
  await worker.terminate();
}
