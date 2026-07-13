import { getPublicSupabase, getSupabase, getSupabaseBucket } from "./supabase-client.js";

const OWNER_ACCESS_KEYS = ["field-notes-owner-access", "field-notes-owner-v2"];
const LOCAL_RECORDS_KEY = "field-notes-local-records-v1";
const LOCAL_IMAGES_KEY = "field-notes-images";
const MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024;

const record = JSON.parse(document.querySelector("#record-data").textContent);
const recordId = document.body.dataset.recordId || new URLSearchParams(window.location.search).get("id") || record.id;
const NOTES_DRAFT_KEY = `water-notes-draft:${recordId}:notes`;
const recordIdLabel = document.querySelector("#record-id-label");
document.body.dataset.recordId = recordId;
if (recordIdLabel) recordIdLabel.textContent = recordId;
const bucketName = getSupabaseBucket();
const supabase = getSupabase();
const publicSupabase = getPublicSupabase();

const recordTitle = document.querySelector("#record-title");
const recordTypeLabel = document.querySelector("#record-type-label");
const recordTitleZh = document.querySelector("#record-title-zh");
const recordLocation = document.querySelector("#record-location");
const recordLocationRow = document.querySelector("#record-location-row");
const recordInstitution = document.querySelector("#record-institution");
const recordInstitutionRow = document.querySelector("#record-institution-row");
const recordVisitDate = document.querySelector("#record-visit-date");
const recordVisitDateRow = document.querySelector("#record-visit-date-row");
const recordExhibitionDates = document.querySelector("#record-exhibition-dates");
const recordExhibitionDatesRow = document.querySelector("#record-exhibition-dates-row");
const recordSummary = document.querySelector("#record-summary");
const recordMeta = document.querySelector(".record-meta");
const recordDetailsTools = document.querySelector("#record-details-tools");
const recordTitleEditor = document.querySelector("#record-title-editor");
const recordTypeEditor = document.querySelector("#record-type-editor");
const recordTitleZhEditor = document.querySelector("#record-title-zh-editor");
const recordTitleZhEditorRow = document.querySelector("#record-title-zh-editor-row");
const recordCityEditor = document.querySelector("#record-city-editor");
const recordInstitutionEditor = document.querySelector("#record-institution-editor");
const recordInstitutionEditorRow = document.querySelector("#record-institution-editor-row");
const recordVisitDateEditor = document.querySelector("#record-visit-date-editor");
const recordArchiveOrderEditor = document.querySelector("#record-archive-order-editor");
const recordExhibitionDatesEditor = document.querySelector("#record-exhibition-dates-editor");
const recordExhibitionDatesEditorRow = document.querySelector("#record-exhibition-dates-editor-row");
const recordSummaryEditor = document.querySelector("#record-summary-editor");
const recordSummaryEditorRow = document.querySelector("#record-summary-editor-row");
const saveRecordDetails = document.querySelector("#save-record-details");
const notesView = document.querySelector("#notes-view");
const notesSection = document.querySelector("#record-notes-section");
const notesTitle = document.querySelector("#notes-title");
const recordHeader = document.querySelector(".record-header");
const notesTools = document.querySelector("#notes-tools");
const notesEditor = document.querySelector("#notes-editor");
const saveNotes = document.querySelector("#save-notes");
const imagesView = document.querySelector("#images-view");
const imagesEmpty = document.querySelector("#images-empty");
const imageTools = document.querySelector("#image-tools");
const imageFiles = document.querySelector("#image-files");
const recordImagesSection = document.querySelector("#record-images-section");
const linksView = document.querySelector("#links-view");
const linksSection = document.querySelector("#record-links-section");
const linksEmpty = document.querySelector("#links-empty");
const linkTools = document.querySelector("#link-tools");
const linksEditor = document.querySelector("#links-editor");
const saveLinks = document.querySelector("#save-links");
const ownerState = document.querySelector("#owner-state");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxClose = document.querySelector("#lightbox-close");
const lightboxPrev = document.querySelector("#lightbox-prev");
const lightboxNext = document.querySelector("#lightbox-next");
const recordDangerTools = document.querySelector("#record-danger-tools");
const deleteRecordButton = document.querySelector("#delete-record");

let ownerActive = false;
let ownerSessionActive = false;
let localOwnerActive = false;
let lightboxIndex = 0;
let remoteRecord = null;
let remoteImages = [];
let localRecord = loadLocalRecord();
let localImages = loadLocalImages();
let masonryColumnCount = 1;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function preventCjkTitleOrphan(value) {
  const characters = Array.from(String(value || ""));
  if (characters.length < 2) return characters.join("");

  const cjkCharacter = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
  const last = characters.at(-1);
  const previous = characters.at(-2);
  if (cjkCharacter.test(last) && cjkCharacter.test(previous)) {
    characters.splice(-1, 0, "\u2060");
  }
  return characters.join("");
}

function localStorageAvailable() {
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function getNotesDraft() {
  if (!localStorageAvailable()) return null;
  return window.localStorage.getItem(NOTES_DRAFT_KEY);
}

function saveNotesDraft(value) {
  if (!localStorageAvailable()) return;
  window.localStorage.setItem(NOTES_DRAFT_KEY, value);
}

function clearNotesDraft() {
  if (!localStorageAvailable()) return;
  window.localStorage.removeItem(NOTES_DRAFT_KEY);
}

function ownerAccessValueIsActive(value) {
  return ["1", "true", "yes", "owner", "active", "enabled", "fieldnotes"].includes(String(value || "").trim().toLowerCase());
}

function hasLocalOwnerAccess() {
  if (!localStorageAvailable()) return false;
  return OWNER_ACCESS_KEYS.some((key) => ownerAccessValueIsActive(localStorage.getItem(key)));
}

function loadLocalRecord() {
  if (!localStorageAvailable()) return null;

  try {
    const records = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || "{}");
    return records[recordId] || null;
  } catch {
    return null;
  }
}

function saveLocalRecord(changes = {}) {
  if (!localStorageAvailable()) return null;

  const records = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || "{}");
  records[recordId] = {
    ...(records[recordId] || {}),
    ...changes,
  };
  localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(records));
  localRecord = records[recordId];
  return localRecord;
}

function loadLocalImages() {
  if (!localStorageAvailable()) return [];

  try {
    const imagesByRecord = JSON.parse(localStorage.getItem(LOCAL_IMAGES_KEY) || "{}");
    return (imagesByRecord[recordId] || []).map((image, index) => ({
      id: image.id || `${recordId}-local-${index}`,
      source: "local",
      storagePath: null,
      src: image.src,
    }));
  } catch {
    return [];
  }
}

function saveLocalImages(images) {
  if (!localStorageAvailable()) return;

  const imagesByRecord = JSON.parse(localStorage.getItem(LOCAL_IMAGES_KEY) || "{}");
  imagesByRecord[recordId] = images.map((image) => ({
    id: image.id,
    src: image.src,
  }));
  localStorage.setItem(LOCAL_IMAGES_KEY, JSON.stringify(imagesByRecord));
  localImages = loadLocalImages();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizedBaseImages() {
  return (record.images || []).map((image, index) => ({
    id: image.id || `${recordId}-base-${index}`,
    source: "base",
    src: image.src,
    storagePath: null,
  }));
}

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

function getEditableField(key, fallback = "") {
  if (localRecord && Object.hasOwn(localRecord, key)) return localRecord[key] ?? "";
  if (remoteRecord && Object.hasOwn(remoteRecord, key)) return remoteRecord[key] ?? "";
  return fallback ?? "";
}

function getRecordDetails() {
  return {
    note_type: getEditableField("note_type", record.noteType || "exhibition"),
    photographic_cover_image_ids: getEditableField("photographic_cover_image_ids", record.photographicCoverImageIds || []),
    title: getEditableField("title", record.title),
    title_zh: getEditableField("title_zh", record.titleZh),
    institution: getEditableField("institution", record.institution),
    city: getEditableField("city", record.city),
    visit_date: getEditableField("visit_date", record.visitDate),
    archive_order: Number(getEditableField("archive_order", record.archiveOrder || 0)) || 0,
    exhibition_dates: getEditableField("exhibition_dates", record.exhibitionDates),
    summary: getEditableField("summary", record.summary),
  };
}

function staticRecordPayload() {
  const details = getRecordDetails();

  return {
    id: recordId,
    title: details.title || "",
    note_type: details.note_type || "exhibition",
    photographic_cover_image_ids: details.photographic_cover_image_ids || [],
    title_zh: details.title_zh || null,
    institution: details.institution || null,
    city: details.city || null,
    visit_date: details.visit_date,
    archive_order: details.archive_order || 0,
    exhibition_dates: details.exhibition_dates || null,
    summary: details.summary || null,
    notes: record.notes || [],
    related_links: record.relatedLinks || [],
    cover_src: getCoverImage()?.src || null,
    published: true,
  };
}

function getNotes() {
  if (localRecord?.notes) return localRecord.notes;
  return remoteRecord?.notes || record.notes || [];
}

function getImages() {
  const uploadedImages = [...remoteImages, ...localImages];
  return uploadedImages.length ? uploadedImages : normalizedBaseImages();
}

function getLinks() {
  if (localRecord?.related_links) return localRecord.related_links;
  return remoteRecord?.related_links || record.relatedLinks || [];
}

function getCoverImage() {
  const images = getImages();
  const coverSrc = localRecord?.cover_src || remoteRecord?.cover_src;
  return images.find((image) => image.src === coverSrc) || images[0] || null;
}

function getPreferredMasonryColumnCount() {
  if (window.matchMedia("(max-width: 520px)").matches) return 1;
  if (window.matchMedia("(max-width: 720px)").matches) return 2;
  if (window.matchMedia("(max-width: 1100px)").matches) return 3;
  return 4;
}

function getMasonryColumnCount(imageCount) {
  if (!imageCount) return 1;
  return Math.min(getPreferredMasonryColumnCount(), imageCount);
}

function renderNotes() {
  const notes = getNotes();
  notesView.innerHTML = notes.length
    ? notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")
    : ownerActive
      ? '<p class="empty-state">No notes yet.</p>'
      : "";
  notesSection.hidden = !notes.length && !ownerActive;
  notesEditor.value = getNotesDraft() ?? notes.join("\n\n");
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
  imagesView.querySelectorAll(".smooth-image").forEach(prepareSmoothImage);
}

function renderRecordDetails() {
  const details = getRecordDetails();
  const location = details.city || "";
  const isPhotographic = details.note_type === "photographic";
  const isField = details.note_type === "field";

  document.body.classList.toggle("is-photographic-note", isPhotographic);
  document.body.classList.toggle("is-field-note", isField);
  recordTypeLabel.hidden = !isPhotographic && !isField;
  recordTypeLabel.textContent = isField ? "Field Note" : "Photographic Note";
  recordTitle.textContent = preventCjkTitleOrphan(details.title);
  recordTitle.hidden = isPhotographic && !details.title;
  recordTitleZh.textContent = details.title_zh || "";
  recordTitleZh.hidden = isField || !details.title_zh;
  recordLocation.textContent = location || (isField ? "" : "Location unknown");
  recordLocationRow.hidden = isField && !location;
  recordInstitution.textContent = details.institution || (isField ? "" : "To be added");
  recordInstitutionRow.hidden = isPhotographic || (isField && !details.institution);
  recordVisitDate.textContent = formatDate(details.visit_date);
  recordVisitDateRow.hidden = isField && !details.visit_date;
  recordExhibitionDates.textContent = details.exhibition_dates || "";
  recordExhibitionDatesRow.hidden = isPhotographic || isField;
  recordSummary.textContent = details.summary || "";
  recordSummary.hidden = true;
  recordTitleZhEditorRow.hidden = isField;
  recordInstitutionEditorRow.hidden = isPhotographic;
  recordExhibitionDatesEditorRow.hidden = isPhotographic || isField;
  recordSummaryEditorRow.hidden = isPhotographic;
  recordImagesSection.hidden = isField;
  recordMeta.hidden = isField && !location && !details.institution && !details.visit_date;

  notesTitle.hidden = isField;
  if (isField) {
    recordMeta.before(notesSection);
  } else {
    recordImagesSection.after(notesSection);
  }

  document.title = `${details.title || (isPhotographic ? "Photographic Note" : "Untitled record")} | Water Notes`;

  recordTypeEditor.value = details.note_type || "exhibition";
  recordTitleEditor.value = details.title || "";
  recordTitleZhEditor.value = details.title_zh || "";
  recordCityEditor.value = details.city || "";
  recordInstitutionEditor.value = details.institution || "";
  recordVisitDateEditor.value = details.visit_date || "";
  recordArchiveOrderEditor.value = String(details.archive_order || 0);
  recordExhibitionDatesEditor.value = details.exhibition_dates || "";
  recordSummaryEditor.value = details.summary || "";
}

function renderImages() {
  const images = getImages();
  const coverImage = getCoverImage();
  const details = getRecordDetails();
  const isPhotographic = details.note_type === "photographic";
  const photographicCoverIds = Array.isArray(details.photographic_cover_image_ids)
    ? details.photographic_cover_image_ids
    : [];
  const columnCount = getMasonryColumnCount(images.length);

  masonryColumnCount = columnCount;
  imagesView.style.setProperty("--masonry-columns", columnCount);

  imagesView.innerHTML = images
    .map(
      (image, index) => `
        <figure class="masonry-item">
          <button class="image-button" type="button" data-image-index="${index}" aria-label="Open image">
            <img class="smooth-image" src="${escapeAttribute(image.src)}" alt="" loading="lazy" decoding="async" />
          </button>
          ${
            ownerActive
                      ? `<div class="image-actions">
                          ${isPhotographic
                            ? `<button class="cover-button${photographicCoverIds.includes(image.id) ? " is-active" : ""}" type="button" data-photo-cover-index="${index}">${photographicCoverIds.includes(image.id) ? "Preview" : "Add preview"}</button>`
                            : `<button class="cover-button${image.src === coverImage?.src ? " is-active" : ""}" type="button" data-cover-index="${index}">${image.src === coverImage?.src ? "Cover" : "Set cover"}</button>`}
                  ${
                    image.source === "base" || (image.source === "remote" && !ownerSessionActive)
                      ? ""
                      : `<button class="delete-image-button" type="button" data-delete-image-index="${index}" aria-label="Delete image">
                          <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 7h12M10 11v6M14 11v6M9 7l1-3h4l1 3M8 7l1 13h6l1-13"></path>
                          </svg>
                        </button>`
                  }
                </div>`
              : ""
          }
        </figure>
      `
    )
    .join("");

  imagesEmpty.hidden = images.length > 0;
  prepareSmoothImages();
}

function renderLinks() {
  const links = getLinks();
  const isField = getRecordDetails().note_type === "field";
  linksView.innerHTML = links
    .map(
      (link) => `
        <li>
          <a href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label || link.url)}</a>
        </li>
      `
    )
    .join("");
  linksEmpty.hidden = links.length > 0 || (isField && !ownerActive);
  linksSection.hidden = isField && !links.length && !ownerActive;
  linksEditor.value = links.map((link) => `${link.label || link.url} | ${link.url}`).join("\n");
}

function renderAll() {
  renderRecordDetails();
  renderNotes();
  renderImages();
  renderLinks();
}

function updateOwnerUi() {
  const notes = getNotes();
  const links = getLinks();
  const isField = getRecordDetails().note_type === "field";
  recordDetailsTools.hidden = !ownerActive;
  notesTools.hidden = !ownerActive;
  imageTools.hidden = !ownerActive;
  linkTools.hidden = !ownerActive;
  ownerState.hidden = !ownerActive;
  recordDangerTools.hidden = !ownerActive;
  ownerState.textContent = ownerSessionActive ? "Owner editing is active." : "Local owner editing is active.";
  notesSection.hidden = !notes.length && !ownerActive;
  linksSection.hidden = isField && !links.length && !ownerActive;
  linksEmpty.hidden = links.length > 0 || (isField && !ownerActive);
  renderImages();
}

async function loadRemoteData() {
  if (!publicSupabase) {
    renderAll();
    return;
  }

  let [{ data: recordData, error: recordError }, { data: imageData }] = await Promise.all([
    publicSupabase
      .from("exhibition_records")
      .select("title, title_zh, institution, city, visit_date, exhibition_dates, summary, notes, related_links, cover_src, note_type, photographic_cover_image_ids, archive_order")
      .eq("id", recordId)
      .maybeSingle()
      .abortSignal(AbortSignal.timeout(12000)),
    publicSupabase
      .from("exhibition_images")
      .select("id, storage_path, src, sort_order")
      .eq("record_id", recordId)
      .order("sort_order", { ascending: true })
      .abortSignal(AbortSignal.timeout(12000)),
  ]);

  if (recordError) {
    const typedFallback = await publicSupabase
      .from("exhibition_records")
      .select("title, title_zh, institution, city, visit_date, exhibition_dates, summary, notes, related_links, cover_src, note_type")
      .eq("id", recordId)
      .maybeSingle()
      .abortSignal(AbortSignal.timeout(12000));
    if (!typedFallback.error) {
      recordData = typedFallback.data ? { ...typedFallback.data, photographic_cover_image_ids: [] } : null;
    } else {
      const fallbackResponse = await publicSupabase
        .from("exhibition_records")
        .select("title, title_zh, institution, city, visit_date, exhibition_dates, summary, notes, related_links, cover_src")
        .eq("id", recordId)
        .maybeSingle()
        .abortSignal(AbortSignal.timeout(12000));
      recordData = fallbackResponse.data ? { ...fallbackResponse.data, note_type: "exhibition", photographic_cover_image_ids: [] } : null;
    }
  }

  remoteRecord = recordData || null;
  remoteImages = (imageData || []).map((image) => ({
    id: image.id,
    source: "remote",
    storagePath: image.storage_path,
    src: image.src || supabase.storage.from(bucketName).getPublicUrl(image.storage_path).data.publicUrl,
    sortOrder: image.sort_order || 0,
  }));

  renderAll();
}

async function refreshOwnerAccess() {
  let session = null;

  if (supabase) {
    const response = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Owner session check timed out.")), 5000)),
    ]);
    session = response.data.session;
  }

  ownerSessionActive = Boolean(session);
  localOwnerActive = !ownerSessionActive && hasLocalOwnerAccess();
  ownerActive = ownerSessionActive || localOwnerActive;
  updateOwnerUi();
}

async function upsertRecord(changes = {}) {
  if (!ownerActive) return;

  if (!ownerSessionActive) {
    saveLocalRecord({
      notes: getNotes(),
      related_links: getLinks(),
      cover_src: localRecord?.cover_src || remoteRecord?.cover_src || getCoverImage()?.src || null,
      ...changes,
    });
    return;
  }

  const payload = {
    ...staticRecordPayload(),
    id: recordId,
    notes: getNotes(),
    related_links: getLinks(),
    cover_src: remoteRecord?.cover_src || getCoverImage()?.src || null,
    ...changes,
  };

  const { data, error } = await supabase
    .from("exhibition_records")
    .upsert(payload, { onConflict: "id" })
    .select("title, title_zh, institution, city, visit_date, exhibition_dates, summary, notes, related_links, cover_src, note_type, photographic_cover_image_ids, archive_order")
    .single();

  if (error) throw error;
  remoteRecord = data;
}

async function setCover(image) {
  await upsertRecord({ cover_src: image.src });
  renderImages();
}

async function togglePhotographicCover(image) {
  const selected = Array.isArray(getRecordDetails().photographic_cover_image_ids)
    ? [...getRecordDetails().photographic_cover_image_ids]
    : [];
  const existingIndex = selected.indexOf(image.id);
  if (existingIndex >= 0) selected.splice(existingIndex, 1);
  else {
    if (selected.length >= 3) {
      window.alert("You can select up to 3 preview images.");
      return;
    }
    selected.push(image.id);
  }
  const selectedSet = new Set(selected);
  const orderedIds = getImages().map((item) => item.id).filter((id) => selectedSet.has(id));
  await upsertRecord({ photographic_cover_image_ids: orderedIds });
  renderImages();
}

async function deleteImage(image) {
  if (!ownerActive || image.source === "base") return;
  if (image.source === "remote" && !ownerSessionActive) return;

  if (image.source === "local") {
    saveLocalImages(localImages.filter((localImage) => localImage.id !== image.id || localImage.src !== image.src));
    if (localRecord?.cover_src === image.src) {
      saveLocalRecord({ cover_src: getImages()[0]?.src || null });
    }
    renderImages();
    return;
  }

  if (!supabase || !image.id) return;

  const { error } = await supabase.from("exhibition_images").delete().eq("id", image.id);
  if (error) throw error;

  if (image.storagePath) {
    await supabase.storage.from(bucketName).remove([image.storagePath]);
  }

  remoteImages = remoteImages.filter((remoteImage) => remoteImage.id !== image.id);
  if (remoteRecord?.cover_src === image.src) {
    await upsertRecord({ cover_src: getImages()[0]?.src || null });
  }
  renderImages();
}

function openLightbox(index) {
  const images = getImages();
  if (!images.length) return;

  lightboxIndex = (index + images.length) % images.length;
  lightboxImage.src = images[lightboxIndex].src;
  lightbox.hidden = false;
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.removeAttribute("src");
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

deleteRecordButton.addEventListener("click", async () => {
  if (!ownerActive || !window.confirm("Delete this note permanently? This cannot be undone.")) return;

  if (ownerSessionActive && supabase) {
    const storagePaths = remoteImages.map((image) => image.storagePath).filter(Boolean);
    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage.from(bucketName).remove(storagePaths);
      if (storageError) throw storageError;
    }
    const { error } = await supabase.from("exhibition_records").delete().eq("id", recordId);
    if (error) throw error;
    window.location.href = "/notes";
    return;
  }

  if (localOwnerActive && localStorageAvailable()) {
    const localRecords = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || "{}");
    const imagesByRecord = JSON.parse(localStorage.getItem(LOCAL_IMAGES_KEY) || "{}");
    if (!localRecords[recordId]) {
      window.alert("This fallback record cannot be deleted locally.");
      return;
    }
    delete localRecords[recordId];
    delete imagesByRecord[recordId];
    localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(localRecords));
    localStorage.setItem(LOCAL_IMAGES_KEY, JSON.stringify(imagesByRecord));
    window.location.href = "/notes";
  }
});

notesEditor.addEventListener("input", () => {
  saveNotesDraft(notesEditor.value);
});

saveNotes.addEventListener("click", async () => {
  const notes = notesEditor.value
    .split(/\n{2,}/)
    .map((note) => note.trim())
    .filter(Boolean);

  await upsertRecord({ notes });
  clearNotesDraft();
  renderNotes();
});

saveRecordDetails.addEventListener("click", async () => {
  const details = getRecordDetails();
  const noteType = recordTypeEditor.value;
  const title = recordTitleEditor.value.trim();

  if (!recordVisitDateEditor.value && !details.visit_date) {
    window.alert("Visit date is required.");
    return;
  }
  if (noteType === "photographic" && getImages().length < 1) {
    window.alert("Photographic Note requires at least one image.");
    return;
  }

  await upsertRecord({
    note_type: noteType,
    title: noteType === "photographic" ? title : title || "Untitled record",
    title_zh: recordTitleZhEditor.value.trim() || null,
    city: recordCityEditor.value.trim() || null,
    institution: noteType === "photographic" ? null : recordInstitutionEditor.value.trim() || null,
    visit_date: recordVisitDateEditor.value || details.visit_date || record.visitDate,
    archive_order: Number.parseInt(recordArchiveOrderEditor.value, 10) || 0,
    exhibition_dates: noteType === "exhibition" ? recordExhibitionDatesEditor.value.trim() || null : null,
    summary: noteType === "photographic" ? null : recordSummaryEditor.value.trim() || null,
  });
  renderRecordDetails();
});

recordTypeEditor.addEventListener("change", () => {
  const isPhotographic = recordTypeEditor.value === "photographic";
  const isField = recordTypeEditor.value === "field";
  recordInstitutionEditorRow.hidden = isPhotographic;
  recordExhibitionDatesEditorRow.hidden = isPhotographic || isField;
  recordSummaryEditorRow.hidden = isPhotographic;
  recordImagesSection.hidden = isField;
});

imageFiles.addEventListener("change", async () => {
  const selectedFiles = Array.from(imageFiles.files || []).filter((file) => file.type.startsWith("image/"));
  const oversizedFiles = selectedFiles.filter((file) => file.size > MAX_IMAGE_UPLOAD_SIZE);
  const files = selectedFiles.filter((file) => file.size <= MAX_IMAGE_UPLOAD_SIZE);

  if (oversizedFiles.length) {
    window.alert("单张图片最大上传大小为 5MB。请压缩后再上传。");
  }

  if (!files.length || !ownerActive) {
    imageFiles.value = "";
    return;
  }

  if (!ownerSessionActive) {
    const newImages = await Promise.all(
      files.map(async (file, index) => ({
        id: `${recordId}-local-${Date.now()}-${index}`,
        source: "local",
        storagePath: null,
        src: await readFileAsDataUrl(file),
      }))
    );

    saveLocalImages([...localImages, ...newImages]);

    if (!localRecord?.cover_src && newImages[0]) {
      saveLocalRecord({ cover_src: newImages[0].src });
    }

    imageFiles.value = "";
    renderImages();
    return;
  }

  await upsertRecord();

  const newImages = [];
  const sortStart = remoteImages.length;

  for (const [index, file] of files.entries()) {
    const extension = file.name.split(".").pop() || "jpg";
    const storagePath = `${recordId}/${Date.now()}-${index}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, file, {
      upsert: false,
      contentType: file.type,
    });

    if (uploadError) throw uploadError;

    const src = supabase.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl;
    const { data, error } = await supabase
      .from("exhibition_images")
      .insert({
        record_id: recordId,
        storage_path: storagePath,
        src,
        sort_order: sortStart + index,
      })
      .select("id, storage_path, src, sort_order")
      .single();

    if (error) throw error;
    newImages.push({
      id: data.id,
      source: "remote",
      storagePath: data.storage_path,
      src: data.src,
    });
  }

  remoteImages = [...remoteImages, ...newImages];

  if (!remoteRecord?.cover_src && newImages[0]) {
    await setCover(newImages[0]);
  }

  imageFiles.value = "";
  renderImages();
});

saveLinks.addEventListener("click", async () => {
  const links = linksEditor.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...urlParts] = line.split("|");
      const url = urlParts.join("|").trim() || label.trim();
      return {
        label: label.trim() || url,
        url,
      };
    });

  await upsertRecord({ related_links: links });
  renderLinks();
});

imagesView.addEventListener("click", async (event) => {
  const photographicCoverButton = event.target.closest("[data-photo-cover-index]");
  if (photographicCoverButton && ownerActive) {
    const image = getImages()[Number(photographicCoverButton.dataset.photoCoverIndex)];
    if (image) await togglePhotographicCover(image);
    return;
  }

  const coverButton = event.target.closest("[data-cover-index]");
  if (coverButton && ownerActive) {
    const image = getImages()[Number(coverButton.dataset.coverIndex)];
    if (image) await setCover(image);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-image-index]");
  if (deleteButton && ownerActive) {
    const image = getImages()[Number(deleteButton.dataset.deleteImageIndex)];
    if (image) await deleteImage(image);
    return;
  }

  const imageButton = event.target.closest("[data-image-index]");
  if (imageButton) {
    openLightbox(Number(imageButton.dataset.imageIndex));
  }
});

lightboxClose.addEventListener("click", closeLightbox);
lightboxPrev.addEventListener("click", () => openLightbox(lightboxIndex - 1));
lightboxNext.addEventListener("click", () => openLightbox(lightboxIndex + 1));
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", (event) => {
  if (lightbox.hidden) return;
  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") openLightbox(lightboxIndex - 1);
  if (event.key === "ArrowRight") openLightbox(lightboxIndex + 1);
});

window.addEventListener("resize", () => {
  if (getMasonryColumnCount(getImages().length) !== masonryColumnCount) {
    renderImages();
  }
});

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    ownerSessionActive = Boolean(session);
    localOwnerActive = !ownerSessionActive && hasLocalOwnerAccess();
    ownerActive = ownerSessionActive || localOwnerActive;
    updateOwnerUi();
  });
}

try {
  await loadRemoteData();
} finally {
  document.body.classList.remove("is-loading-record");
}
await refreshOwnerAccess().catch((error) => console.warn("Owner session check failed.", error));
