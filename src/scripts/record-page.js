import { getSupabase, getSupabaseBucket } from "./supabase-client.js";

const OWNER_ACCESS_KEYS = ["field-notes-owner-access", "field-notes-owner-v2"];
const LOCAL_RECORDS_KEY = "field-notes-local-records-v1";
const LOCAL_IMAGES_KEY = "field-notes-images";
const MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024;

const record = JSON.parse(document.querySelector("#record-data").textContent);
const recordId = document.body.dataset.recordId || new URLSearchParams(window.location.search).get("id") || record.id;
const recordIdLabel = document.querySelector("#record-id-label");
document.body.dataset.recordId = recordId;
if (recordIdLabel) recordIdLabel.textContent = recordId;
const bucketName = getSupabaseBucket();
const supabase = getSupabase();

const recordTitle = document.querySelector("#record-title");
const recordTypeLabel = document.querySelector("#record-type-label");
const recordTitleZh = document.querySelector("#record-title-zh");
const recordLocation = document.querySelector("#record-location");
const recordInstitution = document.querySelector("#record-institution");
const recordInstitutionRow = document.querySelector("#record-institution-row");
const recordVisitDate = document.querySelector("#record-visit-date");
const recordExhibitionDates = document.querySelector("#record-exhibition-dates");
const recordExhibitionDatesRow = document.querySelector("#record-exhibition-dates-row");
const recordSummary = document.querySelector("#record-summary");
const recordRouteRow = document.querySelector("#record-route-row");
const recordRoute = document.querySelector("#record-route");
const recordDetailsTools = document.querySelector("#record-details-tools");
const recordTitleEditor = document.querySelector("#record-title-editor");
const recordTypeEditor = document.querySelector("#record-type-editor");
const recordTitleZhEditor = document.querySelector("#record-title-zh-editor");
const recordCityEditor = document.querySelector("#record-city-editor");
const recordCountryEditor = document.querySelector("#record-country-editor");
const recordInstitutionEditor = document.querySelector("#record-institution-editor");
const recordInstitutionEditorRow = document.querySelector("#record-institution-editor-row");
const recordRouteEditor = document.querySelector("#record-route-editor");
const recordRouteEditorRow = document.querySelector("#record-route-editor-row");
const recordVisitDateEditor = document.querySelector("#record-visit-date-editor");
const recordExhibitionDatesEditor = document.querySelector("#record-exhibition-dates-editor");
const recordExhibitionDatesEditorRow = document.querySelector("#record-exhibition-dates-editor-row");
const recordSummaryEditor = document.querySelector("#record-summary-editor");
const saveRecordDetails = document.querySelector("#save-record-details");
const notesView = document.querySelector("#notes-view");
const notesTools = document.querySelector("#notes-tools");
const notesEditor = document.querySelector("#notes-editor");
const saveNotes = document.querySelector("#save-notes");
const imagesView = document.querySelector("#images-view");
const imagesEmpty = document.querySelector("#images-empty");
const imageTools = document.querySelector("#image-tools");
const imageFiles = document.querySelector("#image-files");
const linksView = document.querySelector("#links-view");
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

function localStorageAvailable() {
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
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
    route: getEditableField("route", record.route),
    title: getEditableField("title", record.title),
    title_zh: getEditableField("title_zh", record.titleZh),
    institution: getEditableField("institution", record.institution),
    city: getEditableField("city", record.city),
    country: getEditableField("country", record.country),
    visit_date: getEditableField("visit_date", record.visitDate),
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
    route: details.route || null,
    title_zh: details.title_zh || null,
    institution: details.institution || null,
    city: details.city || null,
    country: details.country || null,
    visit_date: details.visit_date,
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
    : '<p class="empty-state">No notes yet.</p>';
  notesEditor.value = notes.join("\n\n");
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
  const location = compactMeta([details.city, details.country]);
  const isPhotographic = details.note_type === "photographic";

  document.body.classList.toggle("is-photographic-note", isPhotographic);
  recordTypeLabel.hidden = !isPhotographic;
  recordTitle.textContent = details.title || "";
  recordTitle.hidden = isPhotographic && !details.title;
  recordTitleZh.textContent = details.title_zh || "";
  recordTitleZh.hidden = !details.title_zh;
  recordLocation.textContent = location || "Location unknown";
  recordInstitution.textContent = details.institution || "To be added";
  recordInstitutionRow.hidden = isPhotographic;
  recordVisitDate.textContent = formatDate(details.visit_date);
  recordExhibitionDates.textContent = details.exhibition_dates || "Not recorded";
  recordExhibitionDatesRow.hidden = isPhotographic;
  recordRoute.textContent = details.route || "";
  recordRouteRow.hidden = !isPhotographic || !details.route;
  recordSummary.textContent = details.summary || "";
  recordSummary.hidden = !isPhotographic || !details.summary;
  recordRouteEditorRow.hidden = !isPhotographic;
  recordInstitutionEditorRow.hidden = isPhotographic;
  recordExhibitionDatesEditorRow.hidden = isPhotographic;

  document.title = `${details.title || (isPhotographic ? "Photographic Note" : "Untitled record")} | Water Notes`;

  recordTypeEditor.value = details.note_type || "exhibition";
  recordTitleEditor.value = details.title || "";
  recordTitleZhEditor.value = details.title_zh || "";
  recordCityEditor.value = details.city || "";
  recordCountryEditor.value = details.country || "";
  recordInstitutionEditor.value = details.institution || "";
  recordRouteEditor.value = details.route || "";
  recordVisitDateEditor.value = details.visit_date || "";
  recordExhibitionDatesEditor.value = details.exhibition_dates || "";
  recordSummaryEditor.value = details.summary || "";
}

function renderImages() {
  const images = getImages();
  const coverImage = getCoverImage();
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
                          ${
                            image.source === "base" || (image.source === "remote" && !ownerSessionActive)
                              ? ""
                              : `<button class="image-order-button" type="button" data-move-image-index="${index}" data-move-direction="-1" aria-label="Move image earlier">Earlier</button>
                                 <button class="image-order-button" type="button" data-move-image-index="${index}" data-move-direction="1" aria-label="Move image later">Later</button>`
                          }
                          <button class="cover-button${image.src === coverImage?.src ? " is-active" : ""}" type="button" data-cover-index="${index}">${
                    image.src === coverImage?.src ? "Cover" : "Set cover"
                  }</button>
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
  linksView.innerHTML = links
    .map(
      (link) => `
        <li>
          <a href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label || link.url)}</a>
        </li>
      `
    )
    .join("");
  linksEmpty.hidden = links.length > 0;
  linksEditor.value = links.map((link) => `${link.label || link.url} | ${link.url}`).join("\n");
}

function renderAll() {
  renderRecordDetails();
  renderNotes();
  renderImages();
  renderLinks();
}

function updateOwnerUi() {
  recordDetailsTools.hidden = !ownerActive;
  notesTools.hidden = !ownerActive;
  imageTools.hidden = !ownerActive;
  linkTools.hidden = !ownerActive;
  ownerState.hidden = !ownerActive;
  ownerState.textContent = ownerSessionActive ? "Owner editing is active." : "Local owner editing is active.";
  renderImages();
}

async function loadRemoteData() {
  if (!supabase) {
    renderAll();
    return;
  }

  let [{ data: recordData, error: recordError }, { data: imageData }] = await Promise.all([
    supabase
      .from("exhibition_records")
      .select("title, title_zh, institution, city, country, visit_date, exhibition_dates, summary, notes, related_links, cover_src, note_type, route")
      .eq("id", recordId)
      .maybeSingle(),
    supabase
      .from("exhibition_images")
      .select("id, storage_path, src, sort_order")
      .eq("record_id", recordId)
      .order("sort_order", { ascending: true }),
  ]);

  if (recordError) {
    const fallbackResponse = await supabase
      .from("exhibition_records")
      .select("title, title_zh, institution, city, country, visit_date, exhibition_dates, summary, notes, related_links, cover_src")
      .eq("id", recordId)
      .maybeSingle();
    recordData = fallbackResponse.data ? { ...fallbackResponse.data, note_type: "exhibition", route: null } : null;
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
    const response = await supabase.auth.getSession();
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
    .select("title, title_zh, institution, city, country, visit_date, exhibition_dates, summary, notes, related_links, cover_src, note_type, route")
    .single();

  if (error) throw error;
  remoteRecord = data;
}

async function setCover(image) {
  await upsertRecord({ cover_src: image.src });
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

async function moveImage(image, direction) {
  if (!ownerActive || image.source === "base") return;
  const collection = image.source === "remote" ? remoteImages : localImages;
  const currentIndex = collection.findIndex((item) => item.id === image.id);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= collection.length) return;

  [collection[currentIndex], collection[nextIndex]] = [collection[nextIndex], collection[currentIndex]];
  if (image.source === "local") {
    saveLocalImages(collection);
  } else {
    if (!ownerSessionActive || !supabase) return;
    const updates = collection.map((item, index) =>
      supabase.from("exhibition_images").update({ sort_order: index }).eq("id", item.id)
    );
    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed) throw failed.error;
    collection.forEach((item, index) => { item.sortOrder = index; });
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

saveNotes.addEventListener("click", async () => {
  const notes = notesEditor.value
    .split(/\n{2,}/)
    .map((note) => note.trim())
    .filter(Boolean);

  await upsertRecord({ notes });
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
    route: recordRouteEditor.value.trim() || null,
    title: noteType === "photographic" ? title : title || "Untitled record",
    title_zh: recordTitleZhEditor.value.trim() || null,
    city: recordCityEditor.value.trim() || null,
    country: recordCountryEditor.value.trim() || null,
    institution: recordInstitutionEditor.value.trim() || null,
    visit_date: recordVisitDateEditor.value || details.visit_date || record.visitDate,
    exhibition_dates: recordExhibitionDatesEditor.value.trim() || null,
    summary: recordSummaryEditor.value.trim() || null,
  });
  renderRecordDetails();
});

recordTypeEditor.addEventListener("change", () => {
  const isPhotographic = recordTypeEditor.value === "photographic";
  recordRouteEditorRow.hidden = !isPhotographic;
  recordInstitutionEditorRow.hidden = isPhotographic;
  recordExhibitionDatesEditorRow.hidden = isPhotographic;
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
  const moveButton = event.target.closest("[data-move-image-index]");
  if (moveButton) {
    const image = getImages()[Number(moveButton.dataset.moveImageIndex)];
    if (image) await moveImage(image, Number(moveButton.dataset.moveDirection));
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
  supabase.auth.onAuthStateChange(() => {
    refreshOwnerAccess();
  });
}

try {
  await loadRemoteData();
  await refreshOwnerAccess();
} finally {
  document.body.classList.remove("is-loading-record");
}
