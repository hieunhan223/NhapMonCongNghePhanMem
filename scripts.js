import { GEMINI_API_KEY } from './API_key.js';

// --- Lấy tham chiếu đến các phần tử DOM ---
const mic = document.getElementById('microphone');
const endRecordingButton = document.getElementById('endRecording');
const output = document.getElementById('output');
const chatbox = document.getElementById('chatbox'); // Thay đổi: Lấy tham chiếu đến div chatbox
const clearHistoryButton = document.getElementById('clearHistory');

// --- Khởi tạo Speech Recognition API ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.continuous = true;

// --- Biến trạng thái toàn cục ---
let requestCount = 0;
let isWaitingForGeminiResponse = false;
let isRecording = false;
let isSpeaking = false;

// --- Hàm tiện ích: Cập nhật trạng thái các nút ---
function updateButtonStates() {
    mic.disabled = isRecording || isSpeaking;
    endRecordingButton.disabled = !isRecording;
    clearHistoryButton.disabled = isRecording || isSpeaking;

    // Optional: Update mic button visual state based on isRecording
    if (isRecording) {
        mic.classList.add("pulsing");
    } else {
        mic.classList.remove("pulsing");
    }
}

// --- Hàm để thêm tin nhắn vào lịch sử trò chuyện (CẬP NHẬT) ---
function appendToConversationHistory(sender, message) {
    const timestamp = new Date().toLocaleTimeString();

    // Tạo một div cho toàn bộ tin nhắn
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    // Thêm class 'user' hoặc 'gemini' để định dạng CSS
    messageDiv.classList.add(sender.toLowerCase());

    // Tạo bong bóng tin nhắn
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble');
    messageBubble.innerHTML = message; // Dùng innerHTML để hỗ trợ nếu có thẻ HTML đơn giản

    // Thêm timestamp (tùy chọn, bạn có thể đặt timestamp bên trong message-bubble nếu muốn)
    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('message-timestamp');
    timestampSpan.textContent = timestamp;

    // Thêm bong bóng và timestamp vào messageDiv
    messageBubble.appendChild(timestampSpan);
    messageDiv.appendChild(messageBubble);


    // Thêm messageDiv vào chatbox
    chatbox.appendChild(messageDiv);

    // Cuộn xuống cuối chatbox để luôn hiển thị tin nhắn mới nhất
    chatbox.scrollTop = chatbox.scrollHeight;
}

// --- Xử lý sự kiện nút Microphone (Bắt đầu thu âm) ---
mic.onclick = () => {
    if (isRecording || isSpeaking) {
        console.log("🔊 Hệ thống đang bận (ghi âm hoặc nói). Không thể bắt đầu.");
        return;
    }
    recognition.start();
    isRecording = true;
    mic.classList.add("pulsing");
    mic.disabled = true; // Vô hiệu hóa nút mic khi đang ghi
    endRecordingButton.disabled = false; // Kích hoạt nút kết thúc
    clearHistoryButton.disabled = true; // Vô hiệu hóa nút xóa khi đang ghi
    output.innerHTML = "<i>Đang nghe...</i>";
    console.log("Bắt đầu thu âm.");
};

// --- Xử lý sự kiện nút Kết thúc (Dừng thu âm) ---
endRecordingButton.onclick = () => {
    if (isRecording) {
        recognition.stop(); // Dừng quá trình nhận dạng
        mic.classList.remove("pulsing");
        isRecording = false;
        mic.disabled = false; // Kích hoạt lại nút mic
        endRecordingButton.disabled = true; // Vô hiệu hóa nút kết thúc sau khi dừng
        clearHistoryButton.disabled = false; // Kích hoạt nút xóa
        output.innerHTML = "<i>Đã kết thúc thu âm.</i>";
        console.log("Đã dừng thu âm.");
    }
};

// --- Xử lý sự kiện nút Xóa lịch sử ---
clearHistoryButton.onclick = () => {
    chatbox.innerHTML = ''; // Xóa sạch nội dung chatbox
    console.log("Đã xóa lịch sử trò chuyện.");
};

// --- Xử lý kết quả nhận dạng giọng nói ---
recognition.onresult = async (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    // output.innerHTML = "<b>Bạn nói:</b> " + transcript;
    appendToConversationHistory("User", transcript); // Thay "Bạn" bằng "User" cho nhất quán với CSS

    if (isRecording) {
        recognition.stop();
        isRecording = false;
        mic.classList.remove("pulsing");
        console.log("Đã dừng thu âm để chờ Gemini trả lời.");
    }

    if (isWaitingForGeminiResponse) {
        console.log("⏳ Đang chờ phản hồi trước đó. Yêu cầu Gemini bị chặn.");
        return;
    }

    requestCount++;
    console.log(`🚀 Đang gửi yêu cầu #${requestCount}`);
    isWaitingForGeminiResponse = true;

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
        let reply = "Không có phản hồi.";

        if (response.ok) {
            reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Không có phản hồi từ Gemini.";
            console.log("✅ Phản hồi Gemini:", data);
        } else {
            reply = `Lỗi từ Gemini: ${data.error?.message || response.statusText}`;
            console.error("❌ Lỗi API Gemini (phản hồi):", data);
        }

        // output.innerHTML += "<br><b>Gemini:</b> " + reply;
        appendToConversationHistory("Gemini", reply);

        const synth = window.speechSynthesis;
        const utter = new SpeechSynthesisUtterance(reply);
        utter.lang = 'en-US';

        utter.onend = (event) => {
            console.log('✅ Máy tính đã phát âm xong.');
            isSpeaking = false;
            if (!endRecordingButton.disabled) { // Kiểm tra trạng thái nút "Kết thúc"
                console.log("Tự động khởi động lại thu âm sau khi Gemini nói xong.");
                recognition.start();
                isRecording = true;
                mic.classList.add("pulsing");
                mic.disabled = true; // Vô hiệu hóa nút mic khi đang ghi
                endRecordingButton.disabled = false; // Kích hoạt nút kết thúc
                clearHistoryButton.disabled = true; // Vô hiệu hóa nút xóa
                output.innerHTML = "<i><br>Đang nghe tiếp...</i>";
            } else {
                // Nếu nút "Kết thúc" đã disabled (người dùng đã bấm dừng),
                // thì đảm bảo nút mic được kích hoạt lại và nút xóa được kích hoạt lại.
                mic.disabled = false;
                clearHistoryButton.disabled = false;
            }
        };

        utter.onerror = (event) => {
            console.error('❌ Lỗi khi phát âm:', event.error);
            isSpeaking = false;
            if (!endRecordingButton.disabled) {
                 recognition.start();
                 isRecording = true;
                 mic.classList.add("pulsing");
                 mic.disabled = true;
                 endRecordingButton.disabled = false;
                 clearHistoryButton.disabled = true;
                 output.innerHTML += "<i><br>Đang nghe tiếp (sau lỗi nói)...</i>";
            } else {
                mic.disabled = false;
                clearHistoryButton.disabled = false;
            }
        };

        isSpeaking = true;
        synth.speak(utter);
        output.innerHTML = "<i><br>Đang trả lời...</i>";

    } catch (error) {
        output.innerHTML += "<br><span style='color:red'>Lỗi khi gọi Gemini API.</span>";
        console.error("❌ Lỗi gọi API Gemini:", error);
        if (!endRecordingButton.disabled) {
            recognition.start();
            isRecording = true;
            mic.classList.add("pulsing");
            mic.disabled = true;
            endRecordingButton.disabled = false;
            clearHistoryButton.disabled = true;
            output.innerHTML += "<i><br>Đang nghe tiếp (sau lỗi API)...</i>";
        } else {
            mic.disabled = false;
            clearHistoryButton.disabled = false;
        }
    } finally {
        isWaitingForGeminiResponse = false;
    }
};

recognition.onend = () => {
    if (isRecording) {
        console.log("Mic tự động dừng. Chờ Gemini phản hồi hoặc khởi động lại.");
    } else {
        console.log("Nhận dạng giọng nói đã dừng (do user hoặc logic).");
        // Khi mic dừng hẳn (không phải do mình chủ động stop để gemini nói),
        // và không đang trong trạng thái ghi âm (user đã bấm end),
        // thì đảm bảo các nút được kích hoạt lại.
        if (!endRecordingButton.disabled) { // Nếu nút kết thúc chưa bị disabled (tức là user chưa bấm nó)
             mic.disabled = false;
             clearHistoryButton.disabled = false;
        }
    }
};

recognition.onerror = (e) => {
    output.innerHTML = "Lỗi nhận dạng: " + e.error;
    console.error("🎤 Lỗi nhận dạng giọng nói:", e.error);
    isRecording = false;
    mic.classList.remove("pulsing");
    isWaitingForGeminiResponse = false;
    mic.disabled = false; // Đảm bảo nút mic được kích hoạt lại khi có lỗi
    endRecordingButton.disabled = true; // Nút kết thúc nên disabled nếu mic bị lỗi dừng
    clearHistoryButton.disabled = false; // Kích hoạt nút xóa
};

// Khởi tạo trạng thái nút ban đầu
mic.disabled = false;
endRecordingButton.disabled = true; // Nút kết thúc nên disabled ban đầu
clearHistoryButton.disabled = false;