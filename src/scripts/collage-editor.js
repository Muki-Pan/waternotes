import { getPublicSupabase, getSupabase, getSupabaseBucket } from "./supabase-client.js";

const supabase = getSupabase();
const publicSupabase = getPublicSupabase();
const bucketName = getSupabaseBucket();
const archiveShell = document.querySelector(".archive-shell");
const layer = document.querySelector("#collage-layer");
const editor = document.querySelector("#collage-editor");
const editButton = document.querySelector("#edit-collage");
const uploadInput = document.querySelector("#collage-upload");
const uploadDate = document.querySelector("#collage-upload-date");
const selectionTools = document.querySelector("#collage-selection-tools");
const anchorDate = document.querySelector("#collage-anchor-date");
const relatedNote = document.querySelector("#collage-related-note");
const rotationInput = document.querySelector("#collage-rotation");
const widthInput = document.querySelector("#collage-width");
const editorDragHandle = document.querySelector("#collage-editor-drag-handle");
const forwardButton = document.querySelector("#collage-forward");
const backwardButton = document.querySelector("#collage-backward");
const deleteButton = document.querySelector("#collage-delete");
const saveButton = document.querySelector("#collage-save");
const exitButton = document.querySelector("#collage-exit");
const saveState = document.querySelector("#collage-save-state");

let items = [];
let deletedItems = [];
let selectedId = null;
let editMode = false;
let dirty = false;
let ownerSession = null;

const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;
const dateSections = () => Array.from(document.querySelectorAll(".archive-group[data-date]"));
const dateValues = () => [...new Set(dateSections().map((section) => section.dataset.date).filter(Boolean))];

function normalizeItem(item) {
  return {
    id: item.id,
    image_url: item.image_url,
    storage_path: item.storage_path,
    anchor_date: item.anchor_date,
    x_ratio: Number(item.x_ratio),
    offset_y: Number(item.offset_y),
    width: Number(item.width),
    rotation: Number(item.rotation),
    z_index: Number(item.z_index),
    related_note_id: item.related_note_id || null,
    alt_text: item.alt_text || "",
    isNew: Boolean(item.isNew),
  };
}

function setDirty(value = true) {
  dirty = value;
  saveState.textContent = dirty ? "Unsaved" : "Saved";
  saveState.classList.toggle("is-unsaved", dirty);
}

function keepEditorInViewport() {
  if (!editor || editor.hidden) return;
  requestAnimationFrame(() => {
    const rect = editor.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;
    if (rect.right > window.innerWidth - 8) left -= rect.right - (window.innerWidth - 8);
    if (rect.bottom > window.innerHeight - 8) top -= rect.bottom - (window.innerHeight - 8);
    left = Math.max(8, left);
    top = Math.max(8, top);
    editor.style.left = `${left}px`;
    editor.style.top = `${top}px`;
    editor.style.right = "auto";
    editor.style.bottom = "auto";
  });
}

function fillDateSelect(select, selectedValue) {
  select.replaceChildren();
  dateValues().forEach((date) => {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = date;
    option.selected = date === selectedValue;
    select.append(option);
  });
}

function nearestViewportDate() {
  const targetY = window.innerHeight / 2;
  return dateSections()
    .map((section) => ({ date: section.dataset.date, distance: Math.abs(section.getBoundingClientRect().top - targetY) }))
    .sort((a, b) => a.distance - b.distance)[0]?.date || dateValues()[0] || "";
}

function anchorElement(date) {
  return dateSections().find((section) => section.dataset.date === date) || null;
}

function positionFor(item) {
  const anchor = anchorElement(item.anchor_date);
  if (!anchor || !archiveShell) return null;
  const shellRect = archiveShell.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  return {
    left: item.x_ratio * window.innerWidth,
    top: anchorRect.top - shellRect.top + item.offset_y,
  };
}

function noteOptionsFor(date, selectedNoteId) {
  relatedNote.replaceChildren();
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "No linked note";
  relatedNote.append(none);
  const section = anchorElement(date);
  section?.querySelectorAll("[data-record-id]").forEach((record) => {
    const option = document.createElement("option");
    option.value = record.dataset.recordId;
    option.textContent = record.querySelector(".record-row__title, h4")?.textContent?.trim() || record.dataset.recordId;
    option.selected = option.value === selectedNoteId;
    relatedNote.append(option);
  });
  relatedNote.value = selectedNoteId || "";
}

function selectItem(id) {
  selectedId = id;
  const selected = items.find((item) => item.id === id);
  selectionTools.hidden = !selected;
  if (selected) {
    fillDateSelect(anchorDate, selected.anchor_date);
    noteOptionsFor(selected.anchor_date, selected.related_note_id);
    rotationInput.value = String(selected.rotation);
    widthInput.value = String(selected.width);
  }
  render();
  keepEditorInViewport();
}

function render() {
  if (!layer || !isDesktop()) return;
  const shellLeft = archiveShell.getBoundingClientRect().left;
  layer.style.left = `${-shellLeft}px`;
  layer.style.width = `${window.innerWidth}px`;
  layer.replaceChildren();
  items.forEach((item) => {
    const position = positionFor(item);
    if (!position) return;
    const wrapper = document.createElement(editMode || !item.related_note_id ? "div" : "a");
    wrapper.className = "collage-item";
    wrapper.dataset.collageId = item.id;
    if (!editMode && item.related_note_id) wrapper.href = `/record/?id=${encodeURIComponent(item.related_note_id)}`;
    wrapper.style.left = `${position.left}px`;
    wrapper.style.top = `${position.top}px`;
    wrapper.style.width = `${item.width}px`;
    wrapper.style.transform = `rotate(${item.rotation}deg)`;
    wrapper.style.zIndex = String(item.z_index);
    wrapper.classList.toggle("is-selected", editMode && selectedId === item.id);
    const image = document.createElement("img");
    image.src = item.image_url;
    image.alt = item.alt_text || "";
    image.draggable = false;
    wrapper.append(image);
    if (editMode && selectedId === item.id) {
      const handle = document.createElement("span");
      handle.className = "collage-resize-handle";
      handle.dataset.resizeHandle = "";
      wrapper.append(handle);
    }
    layer.append(wrapper);
  });
  layer.classList.toggle("is-editing", editMode);
}

async function loadItems() {
  if (!publicSupabase || !layer) return;
  const { data, error } = await publicSupabase
    .from("collage_items")
    .select("*")
    .order("z_index", { ascending: true })
    .abortSignal(AbortSignal.timeout(12000));
  if (error) {
    console.info("Collage layer is unavailable until its migration is applied.", error);
    return;
  }
  items = (data || []).map(normalizeItem);
  deletedItems = [];
  selectedId = null;
  setDirty(false);
  render();
}

function enterEditMode() {
  if (!ownerSession || !isDesktop()) return;
  editMode = true;
  editor.hidden = false;
  editButton.textContent = "Editing Collage";
  fillDateSelect(uploadDate, nearestViewportDate());
  render();
  keepEditorInViewport();
}

async function discardUnsavedUploads() {
  const paths = [...items, ...deletedItems].filter((item) => item.isNew).map((item) => item.storage_path);
  if (paths.length) await supabase.storage.from(bucketName).remove(paths);
}

async function exitEditMode() {
  if (dirty && !window.confirm("Discard unsaved collage changes?")) return;
  if (dirty) await discardUnsavedUploads();
  editMode = false;
  editor.hidden = true;
  editButton.textContent = "Edit Collage";
  await loadItems();
}

editButton?.addEventListener("click", enterEditMode);
exitButton?.addEventListener("click", exitEditMode);

uploadInput?.addEventListener("change", async () => {
  const file = uploadInput.files?.[0];
  const date = uploadDate.value;
  if (!file || !date || !ownerSession) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    window.alert("Use PNG, JPG, JPEG, or WebP.");
    uploadInput.value = "";
    return;
  }
  const id = crypto.randomUUID();
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const storagePath = `collage/${id}.${extension}`;
  uploadInput.disabled = true;
  const { error } = await supabase.storage.from(bucketName).upload(storagePath, file, { contentType: file.type, upsert: false });
  uploadInput.disabled = false;
  uploadInput.value = "";
  if (error) {
    window.alert(`Upload failed: ${error.message}`);
    return;
  }
  const imageUrl = supabase.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl;
  const maxZ = Math.max(0, ...items.map((item) => item.z_index));
  items.push(normalizeItem({
    id, image_url: imageUrl, storage_path: storagePath, anchor_date: date,
    x_ratio: 0.82, offset_y: 120, width: 210, rotation: 0, z_index: maxZ + 1,
    related_note_id: null, alt_text: "", isNew: true,
  }));
  setDirty();
  selectItem(id);
});

layer?.addEventListener("pointerdown", (event) => {
  if (!editMode) return;
  const target = event.target.closest("[data-collage-id]");
  if (!target) return;
  const item = items.find((entry) => entry.id === target.dataset.collageId);
  if (!item) return;
  if (selectedId !== item.id) {
    selectItem(item.id);
    return;
  }
  event.preventDefault();
  target.setPointerCapture(event.pointerId);
  const startX = event.clientX;
  const startY = event.clientY;
  const startRatio = item.x_ratio;
  const startOffsetY = item.offset_y;
  const startWidth = item.width;
  const resizing = Boolean(event.target.closest("[data-resize-handle]"));

  const move = (moveEvent) => {
    if (resizing) {
      item.width = Math.min(520, Math.max(80, startWidth + (moveEvent.clientX - startX)));
      target.style.width = `${item.width}px`;
    } else {
      const maxRatio = Math.max(0, (window.innerWidth - item.width) / window.innerWidth);
      item.x_ratio = Math.min(maxRatio, Math.max(0, startRatio + (moveEvent.clientX - startX) / window.innerWidth));
      item.offset_y = Math.max(0, startOffsetY + moveEvent.clientY - startY);
      const position = positionFor(item);
      if (position) {
        target.style.left = `${position.left}px`;
        target.style.top = `${position.top}px`;
      }
    }
    setDirty();
  };
  const up = () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    target.removeEventListener("pointercancel", up);
    render();
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", up);
});

anchorDate?.addEventListener("change", () => {
  const item = items.find((entry) => entry.id === selectedId);
  if (!item) return;
  item.anchor_date = anchorDate.value;
  noteOptionsFor(item.anchor_date, null);
  item.related_note_id = null;
  setDirty();
  render();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  anchorElement(item.anchor_date)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
});

relatedNote?.addEventListener("change", () => {
  const item = items.find((entry) => entry.id === selectedId);
  if (!item) return;
  item.related_note_id = relatedNote.value || null;
  setDirty();
});

rotationInput?.addEventListener("input", () => {
  const item = items.find((entry) => entry.id === selectedId);
  if (!item) return;
  item.rotation = Number(rotationInput.value);
  setDirty();
  render();
});

widthInput?.addEventListener("input", () => {
  const item = items.find((entry) => entry.id === selectedId);
  if (!item) return;
  item.width = Number(widthInput.value);
  setDirty();
  render();
});

editorDragHandle?.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button, input, select")) return;
  event.preventDefault();
  const rect = editor.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const startLeft = rect.left;
  const startTop = rect.top;
  editorDragHandle.setPointerCapture(event.pointerId);
  const move = (moveEvent) => {
    const maxLeft = Math.max(8, window.innerWidth - editor.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - editor.offsetHeight - 8);
    editor.style.left = `${Math.min(maxLeft, Math.max(8, startLeft + moveEvent.clientX - startX))}px`;
    editor.style.top = `${Math.min(maxTop, Math.max(8, startTop + moveEvent.clientY - startY))}px`;
    editor.style.right = "auto";
    editor.style.bottom = "auto";
  };
  const up = () => {
    editorDragHandle.removeEventListener("pointermove", move);
    editorDragHandle.removeEventListener("pointerup", up);
    editorDragHandle.removeEventListener("pointercancel", up);
    keepEditorInViewport();
  };
  editorDragHandle.addEventListener("pointermove", move);
  editorDragHandle.addEventListener("pointerup", up);
  editorDragHandle.addEventListener("pointercancel", up);
});

function shiftZ(direction) {
  const item = items.find((entry) => entry.id === selectedId);
  if (!item) return;
  item.z_index += direction;
  setDirty();
  render();
}
forwardButton?.addEventListener("click", () => shiftZ(1));
backwardButton?.addEventListener("click", () => shiftZ(-1));

deleteButton?.addEventListener("click", () => {
  const index = items.findIndex((entry) => entry.id === selectedId);
  if (index < 0) return;
  deletedItems.push(items[index]);
  items.splice(index, 1);
  selectedId = null;
  selectionTools.hidden = true;
  setDirty();
  render();
});

saveButton?.addEventListener("click", async () => {
  if (!dirty || !ownerSession) return;
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  const payload = items.map(({ isNew, ...item }) => ({ ...item, updated_at: new Date().toISOString() }));
  const { error } = payload.length
    ? await supabase.from("collage_items").upsert(payload, { onConflict: "id" })
    : { error: null };
  if (!error && deletedItems.length) {
    const ids = deletedItems.filter((item) => !item.isNew).map((item) => item.id);
    if (ids.length) await supabase.from("collage_items").delete().in("id", ids);
    const paths = deletedItems.map((item) => item.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from(bucketName).remove(paths);
  }
  saveButton.disabled = false;
  saveButton.textContent = "Save Layout";
  if (error) {
    window.alert(`Save failed: ${error.message}`);
    return;
  }
  items.forEach((item) => { item.isNew = false; });
  deletedItems = [];
  setDirty(false);
  render();
});

window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
window.addEventListener("resize", () => {
  render();
  keepEditorInViewport();
});
window.addEventListener("water-notes-archive-rendered", () => {
  if (uploadDate) fillDateSelect(uploadDate, uploadDate.value || nearestViewportDate());
  render();
});

layer?.addEventListener("click", (event) => {
  if (editMode) return;
  const link = event.target.closest('a[href^="/record/"]');
  if (!link) return;
  sessionStorage.setItem("water-notes-archive-scroll", String(window.scrollY));
  sessionStorage.setItem("water-notes-archive-return", "true");
});

if (publicSupabase && isDesktop()) await loadItems();

if (supabase) {
  try {
    const response = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Owner session check timed out.")), 5000)),
    ]);
    ownerSession = response.data.session;
  } catch (error) {
    console.warn("Collage owner session check failed.", error);
  }
  editButton.hidden = !ownerSession || !isDesktop();
  supabase.auth.onAuthStateChange((_event, session) => {
    ownerSession = session;
    editButton.hidden = !session || !isDesktop();
  });
}
