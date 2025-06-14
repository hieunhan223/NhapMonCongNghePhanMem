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
let isSpeaking = false; // BIẾN MỚI: Theo dõi trạng thái máy tính đang nói

mic.onclick = () => {
  if (isRecording || isSpeaking) {
    console.log("🔊 Already in operation...");
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
        output.innerHTML = "<i>Đã kết thúc thu âm.</i>";
        console.log("Đã dừng thu âm.");
    }
};

recognition.onresult = async (event) => {
  mic.classList.remove("pulsing");
  const transcript = event.results[event.results.length - 1][0].transcript; // Lấy kết quả cuối cùng
  output.innerHTML = "<b>You said:</b> " + transcript;

// Quan trọng: Dừng thu âm ngay sau khi có kết quả để máy tính có thể trả lời
    if (isRecording) {
        recognition.stop();
        isRecording = false;
        mic.classList.remove("pulsing");
        console.log("Đã dừng thu âm để chờ Gemini trả lời.");
    }  
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
// --- QUAN TRỌNG: Xử lý khi máy tính nói xong ---
    utter.onend = (event) => {
        console.log('✅ Máy tính đã phát âm xong.');
        isSpeaking = false; // Đặt lại trạng thái không còn nói
        // Chỉ khởi động lại microphone nếu chưa bấm nút kết thúc
        if (!endRecordingButton.hasAttribute('data-stopped')) { // Kiểm tra biến trạng thái riêng cho nút end
            console.log("Tự động khởi động lại thu âm sau khi Gemini nói xong.");
            recognition.start(); // Bắt đầu lại thu âm
            isRecording = true;
            mic.classList.add("pulsing");
            output.innerHTML += "<i><br>Đang nghe tiếp...</i>";
        }
    };
    
    isSpeaking = true; // Đặt trạng thái đang nói trước khi bắt đầu phát âm
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
        mic.classList.add("pulsing");
        console.log("Tự động khởi động lại nhận dạng giọng nói.");
    }
};

recognition.onerror = (e) => {
  output.innerHTML = "Error: " + e.error;
  console.error("🎤 Recognition error:", e.error);
};
