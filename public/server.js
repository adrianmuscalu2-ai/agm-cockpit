require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PORT = 3000;
app.use(express.static("public"));
app.post("/translate", async (req, res) => { 
    console.log("Cerere de traducere primită");
console.log(req.body);
  const text = req.body.text || "";

  try {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "Detectează automat limba textului. Dacă textul este în română, traduce-l în germană. Dacă este în germană, traduce-l în română."
      },
      {
        role: "user",
        content: text
      }
    ]
  });

  console.log(response.choices[0].message.content);

  res.json({
    translation: response.choices[0].message.content
  });

} catch (err) {
  console.error(err);
  res.status(500).json({ error: err.message });
}
});

app.listen(PORT, () => {
  console.log("AGM Cockpit ruleaza la http://localhost:" + PORT);
});