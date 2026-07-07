function updateClock() {
    const clock = document.getElementById("clock");

    if (!clock) {
        return;
    }

    const now = new Date();
    const time = now.toLocaleTimeString("ro-RO");

    clock.textContent = time;
}

setInterval(updateClock, 1000);
updateClock();


const micButton = document.getElementById("micBtn");
const status = document.querySelector(".label");

let listening = false;
let currentLanguage = "ro-RO";
micButton.addEventListener("click", () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        hud.value = "Browserul nu suportă recunoașterea vocală.";
        return;
    }
const recognition = new SpeechRecognition();
    recognition.lang = currentLanguage;
recognition.continuous = false;
recognition.interimResults = false;
recognition.maxAlternatives = 1;

    setSystemState("listening");

    
recognition.onspeechstart = () => {
    hud.value = "🎤 Aud voce...";
};

recognition.onspeechend = () => {
    hud.value = "⏳ Procesez vocea...";
    
};



  recognition.onresult = (event) => {
    const result = event.results[event.resultIndex];

    // Ignorăm rezultatele intermediare
    if (!result.isFinal) return;

    const text = result[0].transcript.trim();

    console.log("TEXT MICROFON:", text);

    setSystemState("ready");

    setTimeout(() => {

        hud.value = text;

         translateText();

    }, 100);
};     
    recognition.onnomatch = () => {
    hud.value = "Nu am înțeles vocea.";
    setSystemState("ready");
};

    recognition.onerror = (event) => {
    hud.value = "Eroare microfon: " + event.error;
    setSystemState("ready");
}
recognition.onend = () => {
    console.log("ONEND");
    if (hud.value === "🎤 Aud voce..." || hud.value === "⏳ Procesez vocea...") {
        setSystemState("ready");
    }
};
recognition.lang = currentLanguage;
recognition.start();
});   

const speedometer = document.querySelector(".speedometer");
const hud = document.getElementById("translation");
function setSystemState(state) {
    if (!speedometer || !status) return;

    speedometer.classList.remove("ready", "listening", "processing");

    switch (state) {
        case "listening":
            status.textContent = "ASCULT";
            hud.value = "🎤 Ascult...";
            speedometer.classList.add("listening");
            break;

        case "processing":
            status.textContent = "PROCESEZ";
            hud.value = "🧠 Procesez...";
            speedometer.classList.add("processing");
            break;

        default:
    status.textContent = "READY";
    // hud.value = "✅ Gata pentru o nouă conversație.";
    speedometer.classList.add("ready");
    break;

    }
}
const translateButton = document.getElementById("translateBtn");

async function translateText() {
    

    const text = hud.value.trim();

if (!text) {
    hud.value = "✍️ Introdu un text pentru traducere.";
    return;
}
 setSystemState("processing");
    const response = await fetch("/translate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
    });

    const data = await response.json();

    
setSystemState("ready");
hud.value = data.translation;
}
translateButton.addEventListener("click", translateText);

const improveButton = document.getElementById("improveBtn");

improveButton.addEventListener("click", () => {

    

    hud.value = "🧠 Analizez și îmbunătățesc textul...";

    setTimeout(() => {

        hud.value = "🧠 Analiză finalizată.";

        setSystemState("ready");

    }, 2000);

});
const speakButton = document.getElementById("speakBtn");

speakButton.addEventListener("click", () => {

    const text = hud.value;

    if (!text) return;

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "ro-RO";

    speechSynthesis.cancel();
    speechSynthesis.speak(speech);

});
const clearButton = document.getElementById("clearBtn");

clearButton.addEventListener("click", () => {

    hud.value = "";
    setSystemState("ready");

});
const settingsButton = document.getElementById("settingsBtn");
const switchButton = document.getElementById("switchBtn");

switchButton.addEventListener("click", () => {
    if (currentLanguage === "ro-RO") {
        currentLanguage = "de-DE";
        hud.value = "🇩🇪 Mod Germană activ";
    } else {
        currentLanguage = "ro-RO";
        hud.value = "🇷🇴 Mod Română activ";
    }
});