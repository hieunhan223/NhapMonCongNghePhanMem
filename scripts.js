import { GEMINI_API_KEY } from './APIkey.js';

const mic = document.getElementById('microphone');
const output = document.getElementById('output');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.continuous = false;

let requestCount = 0;
let isWaitingForResponse = false;



mic.onclick = () => {
  if (isWaitingForResponse) {
    console.log("⏳ Waiting for previous response... Request blocked.");
    return;
  }
  recognition.start();
  mic.classList.add("pulsing");
  output.innerHTML = "<i>Listening...</i>";
};

recognition.onresult = async (event) => {
  mic.classList.remove("pulsing");
  const transcript = event.results[0][0].transcript;
  output.innerHTML = "<b>You said:</b> " + transcript;

  requestCount++;
  console.log(`🚀 Sending request #${requestCount}`);
  isWaitingForResponse = true;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: transcript }]
            }
          ]
        })
      }
    );

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
    console.log("✅ Gemini response:", data);

    output.innerHTML += "<br><b>Gemini:</b> " + reply;

    const synth = window.speechSynthesis;
    const utter = new SpeechSynthesisUtterance(reply);
    synth.speak(utter);

  } catch (error) {
    output.innerHTML += "<br><span style='color:red'>Error calling Gemini API.</span>";
    console.error("❌ Gemini API call error:", error);
  } finally {
    isWaitingForResponse = false;
  }
};

recognition.onerror = (e) => {
  output.innerHTML = "Error: " + e.error;
  console.error("🎤 Recognition error:", e.error);
};
