const STORAGE_PREFIX = "schedia:event:";
const WORKING_KEY = "schedia:working";
const DAY_MS = 24 * 60 * 60 * 1000;
const supabaseConfig = getSupabaseConfig();

const state = {
  event: loadWorkingEvent(),
  activeRoute: "admin",
};

const elements = {
  navLinks: document.querySelectorAll("[data-route]"),
  adminView: document.querySelector("#adminView"),
  answerView: document.querySelector("#answerView"),
  resultsView: document.querySelector("#resultsView"),
  eventForm: document.querySelector("#eventForm"),
  eventTitle: document.querySelector("#eventTitle"),
  eventDescription: document.querySelector("#eventDescription"),
  naturalPrompt: document.querySelector("#naturalPrompt"),
  answerMode: document.querySelector("#answerMode"),
  deadline: document.querySelector("#deadline"),
  slotList: document.querySelector("#slotList"),
  shareBox: document.querySelector("#shareBox"),
  shareUrl: document.querySelector("#shareUrl"),
  manualRow: document.querySelector("#manualRow"),
  manualDate: document.querySelector("#manualDate"),
  manualTime: document.querySelector("#manualTime"),
  manualDuration: document.querySelector("#manualDuration"),
  answerTitle: document.querySelector("#answerTitle"),
  answerDescription: document.querySelector("#answerDescription"),
  participantName: document.querySelector("#participantName"),
  answerSlotList: document.querySelector("#answerSlotList"),
  responseForm: document.querySelector("#responseForm"),
  recommendation: document.querySelector("#recommendation"),
  resultsTable: document.querySelector("#resultsTable"),
  toast: document.querySelector("#toast"),
  heroSlotCount: document.querySelector("#heroSlotCount"),
  heroResponseCount: document.querySelector("#heroResponseCount"),
  heroBestSlot: document.querySelector("#heroBestSlot"),
  shareModal: document.querySelector("#shareModal"),
  modalShareUrl: document.querySelector("#modalShareUrl"),
  openAnswerLink: document.querySelector("#openAnswerLink"),
};

document.querySelector("#generateSlotsButton").addEventListener("click", () => {
  const prompt = elements.naturalPrompt.value.trim();
  if (!prompt) {
    showToast("候補条件を入力してください。");
    return;
  }
  const slots = generateSlotsFromPrompt(prompt);
  state.event.slots = uniqueSlots([...state.event.slots, ...slots]);
  saveWorkingEvent();
  renderAll();
  showToast(`${slots.length}件の候補を作成しました。`);
});

document.querySelector("#addManualSlotButton").addEventListener("click", () => {
  elements.manualRow.hidden = !elements.manualRow.hidden;
});

document.querySelector("#saveManualSlotButton").addEventListener("click", () => {
  const date = elements.manualDate.value;
  const time = elements.manualTime.value;
  const duration = Number(elements.manualDuration.value || 30);
  if (!date || !time) {
    showToast("日付と時刻を入力してください。");
    return;
  }
  state.event.slots = uniqueSlots([
    ...state.event.slots,
    { id: crypto.randomUUID(), startsAt: `${date}T${time}`, duration },
  ]);
  saveWorkingEvent();
  renderAll();
});

document.querySelector("#clearSlotsButton").addEventListener("click", () => {
  state.event.slots = [];
  saveWorkingEvent();
  renderAll();
});

document.querySelector("#loadDemoButton").addEventListener("click", () => {
  elements.eventTitle.value = "新規提案の打ち合わせ";
  elements.eventDescription.value = "各社のご都合を確認し、最も参加しやすい日時で確定します。";
  elements.naturalPrompt.value = "来週の平日、14時から18時の間で30分刻み。火曜と木曜を優先。";
  elements.answerMode.value = "tri";
});

elements.eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  syncEventFromForm();
  if (!state.event.slots.length) {
    showToast("候補日時を1件以上作成してください。");
    return;
  }
  state.event.id = state.event.id || crypto.randomUUID();
  const savedToDatabase = await saveEventToDatabase(state.event);
  saveEventLocal(state.event);
  saveWorkingEvent();
  const eventParam = savedToDatabase ? `id=${state.event.id}` : `event=${encodeEventForUrl(state.event)}`;
  const url = `${location.origin}${location.pathname}#answer?${eventParam}`;
  elements.shareUrl.value = url;
  elements.shareBox.hidden = false;
  showToast(savedToDatabase ? "Supabaseに保存して共有リンクを発行しました。" : "共有リンクを発行しました。");
  history.replaceState(null, "", `#results?${eventParam}`);
  loadRouteFromHash();
  openShareModal(url);
});

document.querySelector("#copyUrlButton").addEventListener("click", async () => {
  if (!elements.shareUrl.value) return;
  await copyToClipboard(elements.shareUrl.value);
});

document.querySelector("#copyModalUrlButton").addEventListener("click", async () => {
  if (!elements.modalShareUrl.value) return;
  await copyToClipboard(elements.modalShareUrl.value);
});

document.querySelector("#closeShareModalButton").addEventListener("click", closeShareModal);

elements.shareModal.addEventListener("click", (event) => {
  if (event.target === elements.shareModal) closeShareModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.shareModal.hidden) closeShareModal();
});

elements.responseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.participantName.value.trim();
  if (!name) {
    showToast("お名前を入力してください。");
    return;
  }
  const answers = {};
  state.event.slots.forEach((slot) => {
    const selected = document.querySelector(`input[name="slot-${slot.id}"]:checked`);
    answers[slot.id] = selected ? selected.value : "no";
  });
  const existingIndex = state.event.responses.findIndex((response) => response.name === name);
  const response = { id: crypto.randomUUID(), name, answers, submittedAt: new Date().toISOString() };
  if (existingIndex >= 0) state.event.responses[existingIndex] = response;
  else state.event.responses.push(response);
  const savedToDatabase = await saveResponseToDatabase(state.event, response);
  saveEventLocal(state.event);
  saveWorkingEvent();
  showToast(savedToDatabase ? "回答をSupabaseに保存しました。" : "回答を保存しました。");
  const eventParam = savedToDatabase ? `id=${state.event.id}` : `event=${encodeEventForUrl(state.event)}`;
  history.replaceState(null, "", `#results?${eventParam}`);
  loadRouteFromHash();
});

document.querySelector("#exportCsvButton").addEventListener("click", () => {
  const csv = buildCsv(state.event);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.event.title || "schedule"}-responses.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

window.addEventListener("hashchange", loadRouteFromHash);

function createSupabaseClient() {
  const config = window.SCHEDIA_SUPABASE;
  if (!config?.url || !config?.anonKey) return null;
  return {
    url: config.url.replace(/\/$/, ""),
    anonKey: config.anonKey,
  };
}

function getSupabaseConfig() {
  return createSupabaseClient();
}

async function supabaseRequest(path, options = {}) {
  if (!supabaseConfig) throw new Error("Supabase is not configured.");
  const headers = {
    apikey: supabaseConfig.anonKey,
    Authorization: `Bearer ${supabaseConfig.anonKey}`,
    "Content-Type": "application/json",
    ...options.headers,
  };
  const response = await fetch(`${supabaseConfig.url}/rest/v1/${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function saveEventToDatabase(event) {
  if (!supabaseConfig) return false;
  try {
    const deadline = event.deadline || null;
    await supabaseRequest("schedule_events?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: event.id,
        title: event.title,
        description: event.description,
        answer_mode: event.answerMode,
        deadline,
        updated_at: new Date().toISOString(),
      }),
    });

    await supabaseRequest(`schedule_slots?event_id=eq.${event.id}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });

    const slotRows = event.slots.map((slot, index) => ({
      id: slot.id,
      event_id: event.id,
      starts_at: new Date(slot.startsAt).toISOString(),
      duration_minutes: slot.duration,
      position: index,
    }));
    await supabaseRequest("schedule_slots", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(slotRows),
    });

    return true;
  } catch (error) {
    console.error(error);
    showToast("Supabase保存に失敗しました。ローカル保存で続行します。");
    return false;
  }
}

async function loadEventFromDatabase(eventId) {
  if (!supabaseConfig) return null;
  try {
    const eventRows = await supabaseRequest(`schedule_events?id=eq.${eventId}&select=*&limit=1`);
    const eventRow = eventRows[0];
    if (!eventRow) return null;

    const slotRows = await supabaseRequest(
      `schedule_slots?event_id=eq.${eventId}&select=*&order=position.asc`,
    );
    const responseRows = await supabaseRequest(
      `schedule_responses?event_id=eq.${eventId}&select=*&order=submitted_at.asc`,
    );

    const responseIds = responseRows.map((response) => response.id);
    const answerRows = responseIds.length
      ? await supabaseRequest(`schedule_answers?response_id=in.(${responseIds.join(",")})&select=*`)
      : [];

    const answersByResponse = answerRows.reduce((grouped, row) => {
      grouped[row.response_id] ||= {};
      grouped[row.response_id][row.slot_id] = row.answer;
      return grouped;
    }, {});

    return {
      id: eventRow.id,
      title: eventRow.title,
      description: eventRow.description || "",
      answerMode: eventRow.answer_mode,
      deadline: eventRow.deadline || "",
      slots: slotRows.map((slot) => ({
        id: slot.id,
        startsAt: toLocalInputValue(new Date(slot.starts_at)),
        duration: slot.duration_minutes,
      })),
      responses: responseRows.map((response) => ({
        id: response.id,
        name: response.name,
        submittedAt: response.submitted_at,
        answers: answersByResponse[response.id] || {},
      })),
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function saveResponseToDatabase(event, response) {
  if (!supabaseConfig || !event.id) return false;
  try {
    const responseRows = await supabaseRequest("schedule_responses?on_conflict=event_id,name&select=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: response.id,
        event_id: event.id,
        name: response.name,
        submitted_at: response.submittedAt,
      }),
    });
    const responseRow = responseRows[0];

    response.id = responseRow.id;
    await supabaseRequest(`schedule_answers?response_id=eq.${response.id}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });

    const answerRows = event.slots.map((slot) => ({
      response_id: response.id,
      slot_id: slot.id,
      answer: response.answers[slot.id] || "no",
    }));
    await supabaseRequest("schedule_answers", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(answerRows),
    });

    return true;
  } catch (error) {
    console.error(error);
    showToast("Supabase保存に失敗しました。ローカル保存で続行します。");
    return false;
  }
}

function createBlankEvent() {
  return {
    id: "",
    title: "",
    description: "",
    answerMode: "tri",
    deadline: "",
    slots: [],
    responses: [],
  };
}

function loadWorkingEvent() {
  const saved = localStorage.getItem(WORKING_KEY);
  if (!saved) return createBlankEvent();
  try {
    return { ...createBlankEvent(), ...JSON.parse(saved) };
  } catch {
    return createBlankEvent();
  }
}

function saveWorkingEvent() {
  localStorage.setItem(WORKING_KEY, JSON.stringify(state.event));
}

function saveEventLocal(event) {
  localStorage.setItem(`${STORAGE_PREFIX}${event.id}`, JSON.stringify(event));
}

function loadEvent(id) {
  const saved = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
  if (!saved) return null;
  try {
    return { ...createBlankEvent(), ...JSON.parse(saved) };
  } catch {
    return null;
  }
}

function syncEventFromForm() {
  state.event.title = elements.eventTitle.value.trim();
  state.event.description = elements.eventDescription.value.trim();
  state.event.answerMode = elements.answerMode.value;
  state.event.deadline = elements.deadline.value;
}

function encodeEventForUrl(event) {
  const compact = {
    id: event.id,
    title: event.title,
    description: event.description,
    answerMode: event.answerMode,
    deadline: event.deadline,
    slots: event.slots,
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
}

function decodeEventFromUrl(value) {
  try {
    return { ...createBlankEvent(), ...JSON.parse(decodeURIComponent(escape(atob(value)))) };
  } catch {
    return null;
  }
}

async function loadRouteFromHash() {
  const hash = location.hash.replace(/^#/, "");
  const [routeName, queryString = ""] = hash.split("?");
  const params = new URLSearchParams(queryString);
  const encoded = params.get("event");
  const eventId = params.get("id");
  if (eventId) {
    const loadedFromDatabase = await loadEventFromDatabase(eventId);
    const stored = loadEvent(eventId);
    if (loadedFromDatabase) {
      state.event = loadedFromDatabase;
      saveEventLocal(state.event);
      saveWorkingEvent();
    } else if (stored) {
      state.event = stored;
      saveWorkingEvent();
      showToast("Supabaseに接続できないため、このブラウザの保存データを表示しています。");
    } else {
      state.event = createBlankEvent();
      showToast("調整ページを読み込めませんでした。Supabase設定を確認してください。");
    }
  }
  const loadedFromUrl = encoded ? decodeEventFromUrl(encoded) : null;
  const stored = loadedFromUrl?.id ? loadEvent(loadedFromUrl.id) : null;
  if (loadedFromUrl) {
    state.event = { ...loadedFromUrl, responses: stored?.responses || state.event.responses || [] };
    saveWorkingEvent();
  }
  state.activeRoute = routeName || "admin";
  renderAll();
}

function renderAll() {
  renderRoute();
  renderAdmin();
  renderAnswer();
  renderResults();
  renderHero();
}

function openShareModal(url) {
  elements.modalShareUrl.value = url;
  elements.openAnswerLink.setAttribute("href", url);
  elements.shareModal.hidden = false;
  elements.modalShareUrl.focus();
  elements.modalShareUrl.select();
}

function closeShareModal() {
  elements.shareModal.hidden = true;
}

async function copyToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast("URLをコピーしました。");
  } catch {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = value;
    temporaryInput.setAttribute("readonly", "");
    temporaryInput.style.position = "fixed";
    temporaryInput.style.opacity = "0";
    document.body.appendChild(temporaryInput);
    temporaryInput.select();
    document.execCommand("copy");
    temporaryInput.remove();
    showToast("URLをコピーしました。");
  }
}

function renderRoute() {
  const route = ["admin", "answer", "results"].includes(state.activeRoute) ? state.activeRoute : "admin";
  elements.adminView.hidden = route !== "admin";
  elements.answerView.hidden = route !== "answer";
  elements.resultsView.hidden = route !== "results";
  elements.navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.route === route);
  });
}

function renderAdmin() {
  elements.eventTitle.value = state.event.title || elements.eventTitle.value;
  elements.eventDescription.value = state.event.description || elements.eventDescription.value;
  elements.answerMode.value = state.event.answerMode || "tri";
  elements.deadline.value = state.event.deadline || "";
  if (!state.event.slots.length) {
    elements.slotList.className = "slot-list empty-state";
    elements.slotList.textContent = "候補がまだありません。";
    return;
  }
  elements.slotList.className = "slot-list";
  elements.slotList.innerHTML = "";
  state.event.slots.forEach((slot) => {
    const item = document.createElement("div");
    item.className = "slot-item";
    item.innerHTML = `
      <div>
        <strong>${formatDate(slot.startsAt)}</strong>
        <small>${formatTime(slot.startsAt)}開始 / ${slot.duration}分</small>
      </div>
      <button type="button" class="remove-button" aria-label="候補を削除">×</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      state.event.slots = state.event.slots.filter((candidate) => candidate.id !== slot.id);
      saveWorkingEvent();
      renderAll();
    });
    elements.slotList.appendChild(item);
  });
}

function renderAnswer() {
  elements.answerTitle.textContent = state.event.title || "回答";
  elements.answerDescription.textContent = buildAnswerDescription();
  elements.answerSlotList.innerHTML = "";
  if (!state.event.slots.length) {
    elements.answerSlotList.className = "answer-slot-list empty-state";
    elements.answerSlotList.textContent = "候補日時がありません。";
    return;
  }
  elements.answerSlotList.className = "answer-slot-list";
  state.event.slots.forEach((slot) => {
    const card = document.createElement("div");
    card.className = "answer-card";
    const choices =
      state.event.answerMode === "yesno"
        ? [
            ["yes", "○"],
            ["no", "×"],
          ]
        : [
            ["yes", "○"],
            ["maybe", "△"],
            ["no", "×"],
          ];
    card.innerHTML = `
      <div>
        <strong>${formatDate(slot.startsAt)}</strong>
        <small>${formatTime(slot.startsAt)}開始 / ${slot.duration}分</small>
      </div>
      <div class="choice-group">
        ${choices
          .map(
            ([value, label], index) => `
              <label>
                <input type="radio" name="slot-${slot.id}" value="${value}" ${index === 0 ? "checked" : ""}>
                <span>${label}</span>
              </label>
            `,
          )
          .join("")}
      </div>
    `;
    elements.answerSlotList.appendChild(card);
  });
}

function renderResults() {
  if (!state.event.slots.length) {
    elements.recommendation.textContent = "候補日時を作成すると、ここに結果が表示されます。";
    elements.resultsTable.innerHTML = "";
    return;
  }
  const ranked = rankSlots(state.event);
  const best = ranked[0];
  elements.recommendation.textContent = best
    ? `おすすめ: ${formatDate(best.startsAt)} ${formatTime(best.startsAt)}開始。○が${best.yes}件、△が${best.maybe}件です。`
    : "まだ回答がありません。";
  elements.resultsTable.innerHTML = buildResultsTable(state.event, ranked);
}

function renderHero() {
  elements.heroSlotCount.textContent = String(state.event.slots.length);
  elements.heroResponseCount.textContent = String(state.event.responses.length);
  const best = rankSlots(state.event)[0];
  elements.heroBestSlot.textContent = best ? `${formatMonthDay(best.startsAt)} ${formatTime(best.startsAt)}` : "未作成";
}

function buildAnswerDescription() {
  const parts = [];
  if (state.event.description) parts.push(state.event.description);
  if (state.event.deadline) parts.push(`回答期限: ${formatDate(`${state.event.deadline}T00:00`)}`);
  return parts.join(" / ");
}

function generateSlotsFromPrompt(prompt) {
  const explicitSlots = generateExplicitSlotsFromPrompt(prompt);
  if (explicitSlots.length) return uniqueSlots(explicitSlots).slice(0, 80);

  const today = startOfDay(new Date());
  const baseMonday = getNextMonday(today);
  const dates = inferDates(prompt, today, baseMonday);
  const { startHour, endHour } = inferTimeRange(prompt);
  const duration = inferDuration(prompt);
  const step = inferStep(prompt) || duration;
  const preferredDays = inferPreferredDays(prompt);
  const orderedDates = sortByPreference(dates, preferredDays);
  const slots = [];
  orderedDates.forEach((date) => {
    for (let minutes = startHour * 60; minutes < endHour * 60; minutes += step) {
      const slotDate = new Date(date);
      slotDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      slots.push({
        id: crypto.randomUUID(),
        startsAt: toLocalInputValue(slotDate),
        duration,
      });
    }
  });
  return slots.slice(0, 80);
}

function generateExplicitSlotsFromPrompt(prompt) {
  const lines = prompt
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const slots = [];

  lines.forEach((line) => {
    const date = inferExplicitDate(line);
    const range = inferMinuteRange(line);
    if (!date || !range) return;

    const step = inferStep(line) || inferDuration(line);
    const duration = inferDuration(line);
    for (let minutes = range.start; minutes < range.end; minutes += step) {
      const slotDate = new Date(date);
      slotDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      slots.push({
        id: crypto.randomUUID(),
        startsAt: toLocalInputValue(slotDate),
        duration,
      });
    }
  });

  return slots;
}

function inferExplicitDate(text) {
  const normalized = normalizePromptText(text);
  const match = normalized.match(/(?:(20\d{2})[\/年.-])?\s*(\d{1,2})\s*[\/月.-]\s*(\d{1,2})\s*日?/);
  if (!match) return null;

  const now = new Date();
  let year = match[1] ? Number(match[1]) : now.getFullYear();
  const month = Number(match[2]);
  const day = Number(match[3]);
  let date = new Date(year, month - 1, day);

  if (!match[1] && date < startOfDay(now)) {
    date = new Date(year + 1, month - 1, day);
  }

  return startOfDay(date);
}

function inferMinuteRange(text) {
  const normalized = normalizePromptText(text);
  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(?:時)?\s*(?:から|〜|~|-|－|ー|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*(?:時)?/);
  if (!match) return null;

  const start = Number(match[1]) * 60 + Number(match[2] || 0);
  const end = Number(match[3]) * 60 + Number(match[4] || 0);
  if (end <= start) return null;

  return { start, end };
}

function normalizePromptText(text) {
  return text
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ":")
    .replace(/[（［【].*?[）］】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferDates(prompt, today, baseMonday) {
  const days = [];
  const weekdays = [
    ["日", 0],
    ["月", 1],
    ["火", 2],
    ["水", 3],
    ["木", 4],
    ["金", 5],
    ["土", 6],
  ];
  const wantsNextWeek = prompt.includes("来週");
  const wantsWeekday = prompt.includes("平日");
  const mentioned = weekdays.filter(([label]) => prompt.includes(`${label}曜`)).map(([, day]) => day);
  const mentionedAsPreference = prompt.includes("優先");
  const start = wantsNextWeek ? baseMonday : today;
  const searchDays = wantsNextWeek ? 7 : 21;
  for (let offset = 0; offset < searchDays; offset += 1) {
    const date = new Date(start.getTime() + offset * DAY_MS);
    const day = date.getDay();
    if (mentioned.length && !mentionedAsPreference && !mentioned.includes(day)) continue;
    if (!mentioned.length && wantsWeekday && (day === 0 || day === 6)) continue;
    if (mentionedAsPreference && wantsWeekday && (day === 0 || day === 6)) continue;
    if (!mentioned.length && !wantsWeekday && days.length >= 5) break;
    days.push(date);
  }
  return days.length ? days : [today];
}

function inferTimeRange(prompt) {
  const match = prompt.match(/(\d{1,2})時(?:から|〜|~|-)(\d{1,2})時/);
  if (match) {
    return { startHour: Number(match[1]), endHour: Number(match[2]) };
  }
  if (prompt.includes("午前")) return { startHour: 9, endHour: 12 };
  if (prompt.includes("午後")) return { startHour: 13, endHour: 18 };
  return { startHour: 10, endHour: 17 };
}

function inferDuration(prompt) {
  const match = prompt.match(/(\d{2,3})分/);
  if (match) return Number(match[1]);
  if (prompt.includes("1時間")) return 60;
  return 30;
}

function inferStep(prompt) {
  const match = prompt.match(/(\d{2,3})分刻み/);
  if (match) return Number(match[1]);
  const hourMatch = prompt.match(/(\d{1,2})時間刻み/);
  if (hourMatch) return Number(hourMatch[1]) * 60;
  return null;
}

function inferPreferredDays(prompt) {
  if (!prompt.includes("優先")) return [];
  const days = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };
  return Object.entries(days)
    .filter(([label]) => prompt.includes(`${label}曜`))
    .map(([, value]) => value);
}

function sortByPreference(dates, preferredDays) {
  if (!preferredDays.length) return dates;
  return [...dates].sort((a, b) => {
    const aScore = preferredDays.includes(a.getDay()) ? 0 : 1;
    const bScore = preferredDays.includes(b.getDay()) ? 0 : 1;
    return aScore - bScore || a - b;
  });
}

function uniqueSlots(slots) {
  const seen = new Set();
  return slots
    .filter((slot) => {
      const key = `${slot.startsAt}-${slot.duration}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

function rankSlots(event) {
  return event.slots
    .map((slot) => {
      const counts = event.responses.reduce(
        (sum, response) => {
          const answer = response.answers[slot.id] || "no";
          sum[answer] = (sum[answer] || 0) + 1;
          return sum;
        },
        { yes: 0, maybe: 0, no: 0 },
      );
      return { ...slot, ...counts, score: counts.yes * 2 + counts.maybe };
    })
    .sort((a, b) => b.score - a.score || b.yes - a.yes || new Date(a.startsAt) - new Date(b.startsAt));
}

function buildResultsTable(event, ranked) {
  const responses = event.responses;
  const header = `
    <tr>
      <th>候補日時</th>
      <th>スコア</th>
      <th>○</th>
      <th>△</th>
      <th>×</th>
      ${responses.map((response) => `<th>${escapeHtml(response.name)}</th>`).join("")}
    </tr>
  `;
  const rows = ranked
    .map(
      (slot) => `
        <tr>
          <td>${formatDate(slot.startsAt)} ${formatTime(slot.startsAt)}</td>
          <td><span class="score-pill">${slot.score}</span></td>
          <td>${slot.yes}</td>
          <td>${slot.maybe}</td>
          <td>${slot.no}</td>
          ${responses.map((response) => `<td>${answerLabel(response.answers[slot.id])}</td>`).join("")}
        </tr>
      `,
    )
    .join("");
  return `<table>${header}${rows}</table>`;
}

function buildCsv(event) {
  const responses = event.responses;
  const header = ["候補日時", "スコア", "○", "△", "×", ...responses.map((response) => response.name)];
  const rows = rankSlots(event).map((slot) => [
    `${formatDate(slot.startsAt)} ${formatTime(slot.startsAt)}`,
    slot.score,
    slot.yes,
    slot.maybe,
    slot.no,
    ...responses.map((response) => answerLabel(response.answers[slot.id])),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function answerLabel(value) {
  return { yes: "○", maybe: "△", no: "×" }[value] || "×";
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function formatMonthDay(value) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getNextMonday(date) {
  const next = new Date(date);
  const offset = ((8 - next.getDay()) % 7) || 7;
  next.setDate(next.getDate() + offset);
  return startOfDay(next);
}

function toLocalInputValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

loadRouteFromHash();
