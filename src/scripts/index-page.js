import { getSupabase, getSupabaseBucket } from "./supabase-client.js";

const OWNER_ACCESS_KEYS = ["field-notes-owner-access", "field-notes-owner-v2"];
const LOCAL_RECORDS_KEY = "field-notes-local-records-v1";
const LOCAL_IMAGES_KEY = "field-notes-images";
const supabase = getSupabase();
const bucketName = getSupabaseBucket();
const timeline = document.querySelector("#archive-timeline");
const yearIndex = document.querySelector(".archive-year-index");
const createNoteButton = document.querySelector("#create-note");
const createNoteType = document.querySelector("#create-note-type");
const createTools = document.querySelector("#archive-create-tools");
const ARCHIVE_SCROLL_KEY = "water-notes-archive-scroll";
const ARCHIVE_RETURN_KEY = "water-notes-archive-return";
let currentOwnerSession = null;
let isCreatingNote = false;

function fallbackRecords() {
  try {
    return JSON.parse(document.querySelector("#archive-fallback-data")?.textContent || "[]");
  } catch {
    return [];
  }
}

function loadLocalRecords() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || "{}");
  } catch {
    return {};
  }
}

function loadLocalImages() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_IMAGES_KEY) || "{}");
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

function value(record, snakeKey, camelKey = snakeKey) {
  return record?.[snakeKey] ?? record?.[camelKey] ?? "";
}

function visitDate(record) {
  return value(record, "visit_date", "visitDate");
}

function timestamp(record) {
  return visitDate(record) ? new Date(`${visitDate(record)}T00:00:00`).getTime() : -Infinity;
}

function formatGroupDate(date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" })
    .format(new Date(`${date}T00:00:00`))
    .toUpperCase();
}

function recordHref(id) {
  return `/record/?id=${encodeURIComponent(id)}`;
}

function groupArchive(records) {
  const dated = records.filter((record) => visitDate(record)).sort((a, b) => timestamp(b) - timestamp(a));
  const undated = records.filter((record) => !visitDate(record));
  const sections = new Map();

  dated.forEach((record) => {
    const date = visitDate(record);
    const year = date.slice(0, 4);
    if (!sections.has(year)) sections.set(year, new Map());
    const groups = sections.get(year);
    const city = String(record.city || "").trim();
    const key = `${date}::${city}`;
    if (!groups.has(key)) groups.set(key, { date, city, records: [] });
    groups.get(key).records.push(record);
  });

  sections.forEach((groups) => groups.forEach((group) => {
    group.records.sort((a, b) =>
      (Number(a.archive_order) || 0) - (Number(b.archive_order) || 0)
      || String(a.created_at || "").localeCompare(String(b.created_at || ""))
      || String(a.id).localeCompare(String(b.id))
    );
  }));

  const result = Array.from(sections, ([year, groups]) => ({ year, groups: Array.from(groups.values()) }));
  if (undated.length) result.push({ year: "undated", groups: [{ date: "", city: "", records: undated }] });
  return result;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createRecord(record) {
  if (record.note_type === "photographic") return createPhotographicRecord(record);
  if (record.note_type === "field") return createFieldRecord(record);

  const article = element("article", "archive-record");
  article.dataset.recordId = record.id;
  const coverLink = element("a", "record-cover");
  coverLink.href = recordHref(record.id);
  const cover = element("img", "smooth-image");
  cover.alt = "";
  cover.loading = "lazy";
  cover.decoding = "async";
  const coverSrc = value(record, "cover_src", "coverSrc") || record.images?.[0]?.src || "";
  if (coverSrc) cover.src = coverSrc;
  else cover.hidden = true;
  coverLink.append(cover);

  const copy = element("div", "archive-record__copy");
  const title = element("a", "record-row__title", record.title || "Untitled record");
  title.href = recordHref(record.id);
  copy.append(title);
  if (record.institution) copy.append(element("p", "archive-record__institution", record.institution));
  if (record.summary) copy.append(element("p", "record-row__summary", record.summary));
  article.append(coverLink, copy);
  return article;
}

function createPhotographicRecord(record) {
  const article = element("article", "photographic-card archive-record");
  article.dataset.recordId = record.id;
  const link = element("a", "photographic-card__link");
  link.href = recordHref(record.id);

  const copy = element("div", "photographic-card__copy");
  copy.append(element("span", "note-type-label", "Photographic Note"));
  if (record.title) copy.append(element("h4", "", record.title));
  if (record.city) copy.append(element("p", "photographic-card__route", record.city));

  const orderedImages = [...(record.images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const selectedIds = Array.isArray(record.photographic_cover_image_ids) ? record.photographic_cover_image_ids : [];
  const selectedImages = orderedImages.filter((image) => selectedIds.includes(image.id));
  const previews = (selectedImages.length ? selectedImages : orderedImages).slice(0, 3);
  const previewArea = element("div", `photographic-card__previews photographic-card__previews--${previews.length}`);
  previewArea.setAttribute("aria-hidden", "true");
  previews.forEach((preview) => {
    const image = element("img");
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.src = preview.src || (preview.storage_path
      ? supabase.storage.from(bucketName).getPublicUrl(preview.storage_path).data.publicUrl
      : "");
    previewArea.append(image);
  });

  const count = orderedImages.length;
  const countArea = element("div", "photographic-card__count");
  countArea.append(
    element("span", "", `${count} ${count === 1 ? "photograph" : "photographs"}`),
    element("span", "", "→")
  );
  link.append(copy, previewArea, countArea);
  article.append(link);
  return article;
}

function createFieldRecord(record) {
  const article = element("article", "field-note-card archive-record");
  article.dataset.recordId = record.id;
  const link = element("a", "field-note-card__link");
  link.href = recordHref(record.id);
  link.append(element("span", "note-type-label", "Field Note"));
  if (record.title) link.append(element("h4", "", record.title));
  if (record.institution) link.append(element("p", "field-note-card__institution", record.institution));
  if (record.summary) link.append(element("p", "field-note-card__summary", record.summary));
  const read = element("span", "field-note-card__read", "Read note →");
  link.append(read);
  article.append(link);
  return article;
}

function createGroup(group) {
  const section = element("section", "archive-group");
  if (group.date) section.dataset.date = group.date;
  const header = element("header", "archive-group__header");
  header.append(element("h3", "", group.date ? formatGroupDate(group.date) : "Undated / 日期未定"));
  if (group.city) header.append(element("p", "", group.city));
  const records = element("div", "archive-group__records");
  group.records.forEach((record) => records.append(createRecord(record)));
  section.append(header, records);
  return section;
}

function renderArchive(records) {
  if (!timeline || !yearIndex) return;
  const sections = groupArchive(records);
  timeline.replaceChildren();
  yearIndex.replaceChildren();

  sections.forEach((archiveSection) => {
    const id = `archive-year-${archiveSection.year}`;
    if (archiveSection.year !== "undated") {
      const link = element("a", "", archiveSection.year);
      link.href = `#${id}`;
      yearIndex.append(link);
    }
    const section = element("section", "archive-year");
    section.id = id;
    section.dataset.archiveYear = archiveSection.year;
    section.append(element("h2", "", archiveSection.year === "undated" ? "Undated / 日期未定" : archiveSection.year));
    const groups = element("div", "archive-year__groups");
    archiveSection.groups.forEach((group) => groups.append(createGroup(group)));
    section.append(groups);
    timeline.append(section);
  });
  prepareSmoothImages();
  window.dispatchEvent(new CustomEvent("water-notes-archive-rendered"));
}

function prepareSmoothImage(image) {
  if (!image || image.dataset.smoothReady) return;
  image.dataset.smoothReady = "true";
  if (image.complete && image.naturalWidth > 0) image.classList.add("is-loaded");
  else image.addEventListener("load", () => image.classList.add("is-loaded"), { once: true });
}

function prepareSmoothImages() {
  document.querySelectorAll(".smooth-image").forEach(prepareSmoothImage);
}

const recordsById = new Map(fallbackRecords().map((record) => [record.id, record]));
if (supabase) {
  let { data, error } = await supabase
    .from("exhibition_records")
    .select("id, title, institution, city, visit_date, summary, cover_src, note_type, photographic_cover_image_ids, archive_order, created_at")
    .eq("published", true)
    .order("visit_date", { ascending: false, nullsFirst: false });
  if (error) {
    const typedFallback = await supabase
      .from("exhibition_records")
      .select("id, title, institution, city, visit_date, summary, cover_src, note_type, created_at")
      .eq("published", true)
      .order("visit_date", { ascending: false, nullsFirst: false });
    if (!typedFallback.error) {
      data = typedFallback.data?.map((record) => ({ ...record, photographic_cover_image_ids: [] }));
      error = null;
    } else {
      const fallbackResponse = await supabase
      .from("exhibition_records")
      .select("id, title, institution, city, visit_date, summary, cover_src")
      .eq("published", true)
      .order("visit_date", { ascending: false, nullsFirst: false });
      data = fallbackResponse.data?.map((record) => ({ ...record, note_type: "exhibition", photographic_cover_image_ids: [] }));
      error = fallbackResponse.error;
    }
  }
  if (!error && data) {
    recordsById.clear();
    data.forEach((record) => recordsById.set(record.id, record));
    if (data.length) {
      const { data: imageData } = await supabase
        .from("exhibition_images")
        .select("id, record_id, storage_path, src, sort_order")
        .in("record_id", data.map((record) => record.id))
        .order("sort_order", { ascending: true });
      (imageData || []).forEach((image) => {
        const record = recordsById.get(image.record_id);
        if (!record) return;
        if (!record.images) record.images = [];
        record.images.push(image);
      });
    }
  }
}
Object.entries(loadLocalRecords()).forEach(([id, record]) => {
  recordsById.set(id, { ...(recordsById.get(id) || {}), ...record });
});
Object.entries(loadLocalImages()).forEach(([id, images]) => {
  const record = recordsById.get(id);
  if (record) record.images = images.map((image, index) => ({ ...image, sort_order: index }));
});

async function refreshOwnerAccess() {
  let session = null;
  if (supabase) session = (await supabase.auth.getSession()).data.session;
  currentOwnerSession = session;
  if (createTools) createTools.hidden = !(session || hasLocalOwnerAccess());
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
  if (isCreatingNote) return;
  isCreatingNote = true;
  const originalLabel = createNoteButton.textContent;
  createNoteButton.disabled = true;
  createNoteButton.textContent = "Creating…";
  createTools?.setAttribute("aria-busy", "true");

  const id = `fn-${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  const selectedType = createNoteType?.value;
  const noteType = ["photographic", "field"].includes(selectedType) ? selectedType : "exhibition";
  const record = {
    id, title: noteType === "photographic" ? "" : "Untitled record", title_zh: null, institution: null, city: null,
    visit_date: today, exhibition_dates: null, summary: null, notes: [], related_links: [], cover_src: null, published: true,
    note_type: noteType, photographic_cover_image_ids: [],
    archive_order: 0,
  };
  try {
    if (supabase && currentOwnerSession) {
      const { error } = await supabase.from("exhibition_records").insert(record);
      if (error) throw error;
      window.location.href = recordHref(id);
      return;
    }
    if (hasLocalOwnerAccess()) {
      const localRecords = loadLocalRecords();
      localRecords[id] = record;
      localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(localRecords));
      window.location.href = recordHref(id);
      return;
    }
    throw new Error("Owner session is no longer active. Please sign in again.");
  } catch (error) {
    console.error("Create Note failed:", error);
    window.alert(`Create Note failed: ${error?.message || "Unknown error"}`);
  } finally {
    isCreatingNote = false;
    createNoteButton.disabled = false;
    createNoteButton.textContent = originalLabel;
    createTools?.removeAttribute("aria-busy");
  }
});

if (supabase) supabase.auth.onAuthStateChange(() => refreshOwnerAccess());

yearIndex?.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#archive-year-"]');
  if (!link) return;
  const target = document.querySelector(link.getAttribute("href"));
  if (!target) return;
  event.preventDefault();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", link.getAttribute("href"));
});

timeline?.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="/record/"]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  sessionStorage.setItem(ARCHIVE_SCROLL_KEY, String(window.scrollY));
  sessionStorage.setItem(ARCHIVE_RETURN_KEY, "true");
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) sessionStorage.removeItem(ARCHIVE_RETURN_KEY);
});

renderArchive(Array.from(recordsById.values()));
await refreshOwnerAccess();
document.body.classList.remove("is-syncing-records");

if (sessionStorage.getItem(ARCHIVE_RETURN_KEY) === "true") {
  const savedPosition = Number(sessionStorage.getItem(ARCHIVE_SCROLL_KEY) || 0);
  sessionStorage.removeItem(ARCHIVE_RETURN_KEY);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: savedPosition, behavior: reduceMotion ? "auto" : "smooth" })));
}
