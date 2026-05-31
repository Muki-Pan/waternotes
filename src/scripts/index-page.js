import { getSupabase } from "./supabase-client.js";

const OWNER_ACCESS_KEYS = ["field-notes-owner-access", "field-notes-owner-v2"];
const LOCAL_RECORDS_KEY = "field-notes-local-records-v1";
const supabase = getSupabase();
const recordList = document.querySelector(".record-list");
const createNoteButton = document.querySelector("#create-note");

function formatDate(date) {
  return date
    ? new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(new Date(`${date}T00:00:00`))
    : "Date unknown";
}

function compactMeta(parts) {
  return parts.filter(Boolean).join(" / ");
}

function loadLocalRecords() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || "{}");
  } catch {
    return {};
  }
}

function ownerAccessValueIsActive(value) {
  return ["1", "true", "yes", "owner", "active", "enabled", "fieldnotes"].includes(String(value || "").trim().toLowerCase());
}

function hasLocalOwnerAccess() {
  try {
    return OWNER_ACCESS_KEYS.some((key) => ownerAccessValueIsActive(localStorage.getItem(key)));
  } catch {
    return false;
  }
}

function recordHref(id) {
  return `/record/?id=${encodeURIComponent(id)}`;
}

function createRecordRow(record, index) {
  const article = document.createElement("article");
  article.className = "record-row";
  article.dataset.recordId = record.id;

  const number = document.createElement("div");
  number.className = "record-row__number";
  number.textContent = String(index + 1).padStart(2, "0");

  const coverLink = document.createElement("a");
  coverLink.className = "record-cover";
  coverLink.href = recordHref(record.id);

  const cover = document.createElement("img");
  cover.className = "smooth-image";
  cover.alt = "";
  cover.loading = "lazy";
  cover.decoding = "async";
  cover.dataset.coverRecord = record.id;
  if (record.cover_src) {
    cover.src = record.cover_src;
  } else {
    cover.hidden = true;
  }
  coverLink.append(cover);

  const content = document.createElement("div");
  const title = document.createElement("a");
  title.className = "record-row__title";
  title.href = recordHref(record.id);
  title.dataset.recordTitle = "";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.dataset.recordMeta = "";

  const summary = document.createElement("p");
  summary.className = "record-row__summary";
  summary.dataset.recordSummary = "";

  content.append(title, meta, summary);
  article.append(number, coverLink, content);
  return article;
}

function prepareSmoothImage(image) {
  if (!image || image.dataset.smoothReady) return;

  image.dataset.smoothReady = "true";

  if (image.complete && image.naturalWidth > 0) {
    image.classList.add("is-loaded");
    return;
  }

  image.addEventListener(
    "load",
    () => {
      image.classList.add("is-loaded");
    },
    { once: true }
  );
}

function prepareSmoothImages() {
  document.querySelectorAll(".smooth-image").forEach(prepareSmoothImage);
}

function ensureRecordRows(recordsById) {
  if (!recordList) return;

  recordsById.forEach((record) => {
    const existingRow = Array.from(document.querySelectorAll("[data-record-id]")).find((row) => row.dataset.recordId === record.id);
    if (!record?.id || existingRow) return;
    recordList.append(createRecordRow(record, recordList.querySelectorAll("[data-record-id]").length));
  });
}

function applyRecordUpdates(recordsById) {
  Array.from(document.querySelectorAll("[data-record-id]")).forEach((row) => {
    const record = recordsById.get(row.dataset.recordId);
    if (!record) return;
    const hasField = (key) => Object.hasOwn(record, key);

    const title = row.querySelector("[data-record-title]");
    const meta = row.querySelector("[data-record-meta]");
    const summary = row.querySelector("[data-record-summary]");
    const coverLink = row.querySelector(".record-cover");
    let cover = row.querySelector("[data-cover-record]");

    if (!cover && coverLink) {
      cover = document.createElement("img");
      cover.alt = "";
      cover.dataset.coverRecord = row.dataset.recordId;
      cover.hidden = true;
      coverLink.append(cover);
    }

    if (title && hasField("title") && record.title) title.textContent = record.title;
    if (meta && (hasField("city") || hasField("institution") || hasField("visit_date"))) {
      meta.textContent = compactMeta([record.city, record.institution, formatDate(record.visit_date)]);
    }
    if (summary && hasField("summary")) summary.textContent = record.summary || "";
    if (cover && hasField("cover_src")) {
      if (record.cover_src) {
        if (cover.src !== record.cover_src) {
          cover.classList.remove("is-loaded");
          delete cover.dataset.smoothReady;
        }
        cover.src = record.cover_src;
        cover.hidden = false;
        prepareSmoothImage(cover);
      } else {
        cover.removeAttribute("src");
        cover.hidden = true;
        cover.classList.remove("is-loaded");
        delete cover.dataset.smoothReady;
      }
    }
  });
}

const recordsById = new Map();

if (supabase) {
  const { data, error } = await supabase
    .from("exhibition_records")
    .select("id, title, institution, city, visit_date, summary, cover_src")
    .eq("published", true)
    .order("created_at", { ascending: true });

  if (!error && data) {
    data.forEach((record) => recordsById.set(record.id, record));
  }
}

const localRecords = loadLocalRecords();
Object.entries(localRecords).forEach(([id, record]) => {
  recordsById.set(id, {
    ...(recordsById.get(id) || {}),
    ...record,
  });
});

async function refreshOwnerAccess() {
  let session = null;

  if (supabase) {
    const response = await supabase.auth.getSession();
    session = response.data.session;
  }

  if (createNoteButton) {
    createNoteButton.hidden = !(session || hasLocalOwnerAccess());
  }
  return Boolean(session);
}

window.fieldNotesSignIn = async (email, password) => {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await refreshOwnerAccess();
};

window.fieldNotesSignOut = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  await refreshOwnerAccess();
};

createNoteButton?.addEventListener("click", async () => {
  const id = `fn-${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  const record = {
    id,
    title: "Untitled record",
    title_zh: null,
    institution: null,
    city: null,
    country: null,
    visit_date: today,
    exhibition_dates: null,
    summary: null,
    notes: [],
    related_links: [],
    cover_src: null,
    published: true,
  };

  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const { error } = await supabase.from("exhibition_records").insert(record);
      if (error) throw error;
      window.location.href = recordHref(id);
      return;
    }
  }

  if (hasLocalOwnerAccess()) {
    const localRecords = loadLocalRecords();
    localRecords[id] = record;
    localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(localRecords));
    window.location.href = recordHref(id);
  }
});

if (supabase) {
  supabase.auth.onAuthStateChange(() => {
    refreshOwnerAccess();
  });
}

ensureRecordRows(recordsById);
applyRecordUpdates(recordsById);
prepareSmoothImages();
await refreshOwnerAccess();
document.body.classList.remove("is-syncing-records");
