import { getPublicSupabase, getSupabaseBucket } from "./supabase-client.js";

const HOME_LIMIT = 13;
const RECENT_RECORD_LIMIT = 5;
const supabase = getPublicSupabase();
const bucketName = getSupabaseBucket();
const slots = Array.from(document.querySelectorAll("[data-home-slot]"));
const emptyState = document.querySelector("#home-empty");
const browseSlowly = document.querySelector(".browse-slowly");

function dateValue(record) {
  return record.visit_date ? new Date(`${record.visit_date}T00:00:00`).getTime() : 0;
}

function formatDate(date) {
  return date
    ? new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric" }).format(
        new Date(`${date}T00:00:00`)
      )
    : "Date unknown";
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededOrder(items, seed) {
  return [...items].sort((a, b) => {
    const aHash = hashString(`${seed}:${a.id}`);
    const bHash = hashString(`${seed}:${b.id}`);
    return aHash - bHash || String(a.id).localeCompare(String(b.id));
  });
}

function imageSrc(image) {
  if (image.src) return image.src;
  return image.storage_path
    ? supabase.storage.from(bucketName).getPublicUrl(image.storage_path).data.publicUrl
    : "";
}

function chooseRecordImage(record, images) {
  const ordered = [...images].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  return ordered.find((image) => image.src === record.cover_src) || ordered[0] || null;
}

function attachRecord(image, record) {
  return {
    ...image,
    src: imageSrc(image),
    record,
  };
}

function canAppend(selected, candidate, counts) {
  if (!candidate?.src || selected.some((item) => item.id === candidate.id)) return false;
  if ((counts.get(candidate.record.id) || 0) >= 2) return false;
  return selected.at(-1)?.record.id !== candidate.record.id;
}

function appendCandidate(selected, candidate, counts) {
  if (!canAppend(selected, candidate, counts)) return false;
  selected.push(candidate);
  counts.set(candidate.record.id, (counts.get(candidate.record.id) || 0) + 1);
  return true;
}

function selectHomeImages(records, images) {
  const imagesByRecord = new Map();
  images.forEach((image) => {
    if (!imagesByRecord.has(image.record_id)) imagesByRecord.set(image.record_id, []);
    imagesByRecord.get(image.record_id).push(image);
  });

  const recordsWithImages = records
    .filter((record) => imagesByRecord.get(record.id)?.some((image) => imageSrc(image)))
    .sort((a, b) => dateValue(b) - dateValue(a));
  const recentRecords = recordsWithImages.slice(0, RECENT_RECORD_LIMIT);
  const olderRecords = recordsWithImages.slice(RECENT_RECORD_LIMIT);
  const primaryByRecord = new Map(
    recordsWithImages.map((record) => [record.id, attachRecord(chooseRecordImage(record, imagesByRecord.get(record.id)), record)])
  );

  const selected = [];
  const counts = new Map();

  // Opening remains stable: three newest image-bearing notes, then the newest older note.
  recentRecords.slice(0, 3).forEach((record) => appendCandidate(selected, primaryByRecord.get(record.id), counts));
  const stableEarlier = olderRecords[0] || recentRecords[3];
  if (stableEarlier) appendCandidate(selected, primaryByRecord.get(stableEarlier.id), counts);

  // Finish the recent-note allocation before drawing deterministic earlier memories.
  recentRecords.slice(3).forEach((record) => appendCandidate(selected, primaryByRecord.get(record.id), counts));

  const daySeed = new Date().toISOString().slice(0, 10);
  const olderCandidates = seededOrder(
    olderRecords.flatMap((record) =>
      (imagesByRecord.get(record.id) || []).map((image) => attachRecord(image, record))
    ),
    daySeed
  );
  olderCandidates.forEach((candidate) => {
    if (selected.length < HOME_LIMIT) appendCandidate(selected, candidate, counts);
  });

  // Small archives may need a second image from recent notes; the same max/adjoining rules still apply.
  const remainingCandidates = recentRecords.flatMap((record) =>
    (imagesByRecord.get(record.id) || []).map((image) => attachRecord(image, record))
  );
  remainingCandidates.forEach((candidate) => {
    if (selected.length < HOME_LIMIT) appendCandidate(selected, candidate, counts);
  });

  return selected.slice(0, HOME_LIMIT);
}

function renderSlot(slot, item, index) {
  if (!item) {
    slot.hidden = true;
    return;
  }
  const link = slot.querySelector(".home-image-link");
  const image = slot.querySelector("img");
  const meta = slot.querySelector("[data-image-meta]");
  const title = slot.querySelector("[data-image-title]");
  const summary = slot.querySelector("[data-image-summary]");
  const record = item.record;
  const label = [record.city, formatDate(record.visit_date)].filter(Boolean).join(" · ");

  link.href = `/record/?id=${encodeURIComponent(record.id)}`;
  link.setAttribute("aria-label", `Read ${record.title || "this note"}`);
  image.src = item.src;
  image.alt = `${record.title || "Water Note"}，${record.institution || record.city || "展览现场"}`;
  if (index < 3) image.loading = "eager";
  meta.textContent = label;
  title.textContent = record.title || "Untitled record";
  if (summary) {
    summary.textContent = record.summary || "";
    summary.hidden = !record.summary;
  }

  const markLoaded = () => slot.classList.add("is-visible");
  if (image.complete && image.naturalWidth) markLoaded();
  else image.addEventListener("load", markLoaded, { once: true });
}

async function loadHome() {
  if (!supabase) return [];
  const { data: records, error: recordError } = await supabase
    .from("exhibition_records")
    .select("id, title, institution, city, visit_date, summary, cover_src, created_at")
    .eq("published", true)
    .order("visit_date", { ascending: false, nullsFirst: false })
    .abortSignal(AbortSignal.timeout(12000));
  if (recordError || !records?.length) return [];

  const { data: images, error: imageError } = await supabase
    .from("exhibition_images")
    .select("id, record_id, storage_path, src, sort_order")
    .in("record_id", records.map((record) => record.id))
    .order("sort_order", { ascending: true })
    .abortSignal(AbortSignal.timeout(12000));
  if (imageError || !images?.length) return [];
  return selectHomeImages(records, images);
}

browseSlowly?.addEventListener("click", (event) => {
  const target = document.querySelector(browseSlowly.getAttribute("href"));
  if (!target) return;
  event.preventDefault();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", "#visual-stream");
});

const homeImages = await loadHome();
slots.forEach((slot, index) => renderSlot(slot, homeImages[index], index));
if (!homeImages.length && emptyState) emptyState.hidden = false;
document.body.classList.remove("is-loading-home");
