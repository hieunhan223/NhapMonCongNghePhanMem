import { GEMINI_API_KEY } from './API_key.js';

const mic = document.getElementById('microphone');
const endRecordingButton = document.getElementById('endRecording'); // Lấy tham chiếu đến nút Kết thúc
const output = document.getElementById('output');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.continuous = true;

let requestCount = 0;
let isWaitingForResponse = false;
let isRecording = false; // Biến trạng thái để biết có đang thu âm hay không

mic.onclick = () => {
  if (isRecording) {
    console.log("🔊 Already recording...");
    return;
  }
  recognition.start();
  isRecording = true;
  mic.classList.add("pulsing");
  output.innerHTML = "<i>Listening...</i>";
};

// Xử lý sự kiện khi bấm nút Kết thúc
endRecordingButton.onclick = () => {
    if (isRecording) {
        recognition.stop(); // Dừng quá trình nhận dạng
        mic.classList.remove("pulsing");
        isRecording = false;
        mic.style.backgroundColor = ''; // Đổi màu nút mic về trạng thái ban đầu
        output.innerHTML = "<i>Đã kết thúc thu âm.</i>";
        console.log("Đã dừng thu âm.");
    }
};

recognition.onresult = async (event) => {
  mic.classList.remove("pulsing");
  const transcript = event.results[event.results.length - 1][0].transcript; // Lấy kết quả cuối cùng
  output.innerHTML = "<b>You said:</b> " + transcript;

// Chỉ gửi yêu cầu Gemini nếu không đang chờ phản hồi từ yêu cầu trước đó
  if (isWaitingForResponse) {
      console.log("⏳ Đang chờ phản hồi trước đó. Yêu cầu Gemini bị chặn.");
      return;
  }
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

recognition.onend = () => {
    // onend được gọi khi nhận dạng dừng, có thể do user bấm stop hoặc tự động dừng
    // Nếu chúng ta muốn liên tục, thì không nên dừng ở đây trừ khi user bấm nút end
    if (isRecording) {
        // Nếu vẫn đang trong trạng thái ghi âm, tự động khởi động lại nhận dạng
        // Điều này giúp duy trì việc lắng nghe liên tục sau một khoảng dừng
        recognition.start();
        console.log("Tự động khởi động lại nhận dạng giọng nói.");
    }
};

recognition.onerror = (e) => {
  output.innerHTML = "Error: " + e.error;
  console.error("🎤 Recognition error:", e.error);
};
