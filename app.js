(() => {
  const API_URL = "https://3lcdv46wrmlrmj5xyknk2pbi7u0sfobl.lambda-url.us-east-2.on.aws";
  const USER_ID = "user-2";
  const TOP_K = 3;
  const REQUEST_TIMEOUT_MS = 45000; // даём серверу до 45 секунд на ответ

  const form = document.getElementById("chat-form");
  const apiKeyInput = document.getElementById("api-key-input");
  const queryInput = document.getElementById("query-input");
  const bookSelect = document.getElementById("book-select");
  const chatLog = document.getElementById("chat-log");

  const appendMessage = (role, text, className) => {
    const message = document.createElement("div");
    message.className = `message${className ? ` ${className}` : ""}`;

    const roleEl = document.createElement("div");
    roleEl.className = "role";
    roleEl.textContent = role;

    const content = document.createElement("div");
    content.className = "content";
    content.textContent = text;

    message.append(roleEl, content);
    chatLog.appendChild(message);
    chatLog.scrollTop = chatLog.scrollHeight;
    return message;
  };

  const setFormDisabled = (disabled) => {
    apiKeyInput.disabled = disabled;
    queryInput.disabled = disabled;
    bookSelect.disabled = disabled;
    form.querySelector("button[type='submit']").disabled = disabled;
  };

  const appendSources = (sources, bookId) => {
    if (!sources?.length) return;

    const message = document.createElement("div");
    message.className = "message";

    const roleEl = document.createElement("div");
    roleEl.className = "role";
    roleEl.textContent = "материалы";

    const content = document.createElement("div");
    content.className = "content";

    const title = document.createElement("div");
    title.textContent = "материалы по запросу:";
    content.appendChild(title);

    const list = document.createElement("ul");
    list.className = "sources";

    sources.forEach((source) => {
      const { metadata } = source || {};
      if (!metadata) return;
      const { volumeTitle, articleTitle, volumeId, articleId, bookId: sourceBookId } = metadata;

      const labelParts = [volumeTitle, articleTitle].filter(Boolean);
      if (!labelParts.length) return;

      const link = document.createElement("a");
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = labelParts.join(", ");

      const selectedBookId = bookId || sourceBookId;
      if (String(selectedBookId) === "4490") {
        link.href = `https://dlib.eastview.com/browse/book/${volumeId}/udb/${selectedBookId}`;
      } else {
        link.href = `https://beed.eastview.com/api/article/${articleId}`;
      }

      const item = document.createElement("li");
      item.appendChild(link);
      list.appendChild(item);
    });

    content.appendChild(list);
    message.append(roleEl, content);
    chatLog.appendChild(message);
    chatLog.scrollTop = chatLog.scrollHeight;
  };

  const parseBody = (data) => {
    const body = data?.body;
    if (!body) return null;
    if (typeof body === "string") {
      try {
        return JSON.parse(body);
      } catch {
        return null;
      }
    }
    return body;
  };

  const fetchWithTimeout = async (url, options, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal, mode: "cors", cache: "no-store" });
    } finally {
      clearTimeout(timer);
    }
  };

  const sendQuery = async (query, bookId, apiKey) => {
    const payload = {
      query,
      filters: { bookId, userId: USER_ID },
      topK: TOP_K,
    };

    const response = await fetchWithTimeout(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    }, REQUEST_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(`Ошибка запроса: ${response.status}`);
    }

    const data = await response.json();
    const body = parseBody(data);
    if (!body?.answer) {
      throw new Error("Некорректный ответ от сервера");
    }
    return { answer: body.answer, sources: body.sources || [], bookId };
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = queryInput.value.trim();
    const bookId = bookSelect.value;
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      appendMessage("ошибка", "Введите x-api-key", "error");
      return;
    }

    if (!query) return;

    appendMessage("вы", query);
    queryInput.value = "";
    setFormDisabled(true);

    const loading = appendMessage("бот", "Ждём ответ (может занять до 45 сек)...", "loading");

    try {
      const result = await sendQuery(query, bookId, apiKey);
      loading.remove();
      appendMessage("бот", result.answer);
      appendSources(result.sources, bookId);
    } catch (error) {
      loading.remove();
      const isAbort = error.name === "AbortError";
      const message = isAbort
        ? "Время ожидания ответа истекло. Попробуйте ещё раз."
        : error.message || "Что-то пошло не так";
      appendMessage("ошибка", message, "error");
    }
    setFormDisabled(false);
  });
})();
