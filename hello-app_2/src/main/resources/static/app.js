const API_URL = "/api/messages";

const form = document.getElementById("message-form");
const authorInput = document.getElementById("author");
const textInput = document.getElementById("text");
const statusEl = document.getElementById("status");
const messagesEl = document.getElementById("messages");

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU");
  } catch (e) {
    return iso;
  }
}

function renderMessages(messages) {
  messagesEl.innerHTML = "";
  messages
    .slice()
    .reverse()
    .forEach((m) => {
      const li = document.createElement("li");
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${m.author} • ${formatDate(m.createdAt)}`;
      const text = document.createElement("div");
      text.textContent = m.text;
      li.appendChild(meta);
      li.appendChild(text);
      messagesEl.appendChild(li);
    });
}

async function loadMessages() {
  statusEl.textContent = "Загрузка...";
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    renderMessages(data);
    statusEl.textContent = "";
  } catch (err) {
    statusEl.textContent = "Не удалось загрузить сообщения: " + err.message;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const author = authorInput.value.trim();
  const text = textInput.value.trim();
  if (!text) return;

  statusEl.textContent = "Отправка...";
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, text }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    textInput.value = "";
    statusEl.textContent = "Отправлено!";
    await loadMessages();
  } catch (err) {
    statusEl.textContent = "Ошибка отправки: " + err.message;
  }
});

loadMessages();
