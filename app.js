const STORAGE_KEY = "field-notes-images";
const OWNER_KEY = "field-notes-owner-v2";
const OWNER_PASSCODE = "fieldnotes";

const records = [
  {
    id: "fn-001",
    title: "A Movement in Every Direction: Legacies of the Great Migration",
    titleZh: "每个方向中的移动",
    artists: ["Various artists"],
    curators: ["Jessica Bell Brown", "Ryan N. Dennis"],
    institution: "Baltimore Museum of Art",
    city: "Baltimore",
    country: "United States",
    visitDate: "2025-04-18",
    exhibitionDates: "2022-10-30 to 2023-01-29",
    summary:
      "A record of migration not as a single historical line, but as a lived structure of memory, material evidence, and inherited movement.",
    tags: ["migration", "archive", "memory", "spatial history"],
    coverImage: "",
    images: [],
    notes: [
      {
        type: "h2",
        text: "Opening Note",
      },
      {
        type: "paragraph",
        text:
          "The useful entry point is not whether the exhibition explains migration completely, but how it lets fragments remain accountable to bodies, family histories, and civic space.",
      },
      {
        type: "h2",
        text: "Viewing Notes",
      },
      {
        type: "paragraph",
        text:
          "Keep track of where the exhibition asked for slow reading and where it allowed image, sound, or scale to carry memory before text arrived.",
      },
    ],
    curatorialObservations: [
      {
        type: "h2",
        text: "Curatorial Observations",
      },
      {
        type: "list",
        items: [
          "The structure benefits from adjacency rather than chronology alone.",
          "Wall text should be checked for whether it gives context without closing interpretation.",
          "The spatial rhythm matters: compression, pause, and return are part of the argument.",
        ],
      },
    ],
    bodyArchiveLens: [
      {
        type: "h2",
        text: "Feminist / Body / Archive Lens",
      },
      {
        type: "paragraph",
        text:
          "Ask who is given authorship over memory, whose movement becomes public record, and what forms of care are required when private family material enters exhibition space.",
      },
    ],
    remember: [
      {
        type: "h2",
        text: "What I Want to Remember",
      },
      {
        type: "list",
        items: [
          "Migration as spatial inheritance rather than a completed journey.",
          "The difference between archive as proof and archive as responsibility.",
          "Possible research line: exhibition design for historical movement and bodily fatigue.",
        ],
      },
    ],
    relatedLinks: [
      {
        label: "Institution page",
        url: "https://artbma.org/",
      },
    ],
  },
  {
    id: "fn-002",
    title: "Record Placeholder / Future Exhibition",
    institution: "To be added",
    city: "City",
    country: "Country",
    visitDate: "2026-05-29",
    exhibitionDates: "",
    summary:
      "A blank record reserved for future field notes, uploaded evidence, ticket stubs, and research links.",
    tags: ["to-process", "field-note"],
    images: [],
    notes: [
      { type: "h2", text: "Opening Note" },
      {
        type: "paragraph",
        text:
          "Use this space as a first-pass viewing entrance: what stayed with the body before the interpretation settled.",
      },
    ],
    curatorialObservations: [
      { type: "h2", text: "Curatorial Observations" },
      {
        type: "paragraph",
        text:
          "Record how the exhibition organized movement, text, object relationships, lighting, and fatigue.",
      },
    ],
    bodyArchiveLens: [
      { type: "h2", text: "Feminist / Body / Archive Lens" },
      {
        type: "paragraph",
        text:
          "Who is made visible, who is protected, who performs care, and who is missing from the record?",
      },
    ],
    remember: [
      { type: "h2", text: "What I Want to Remember" },
      {
        type: "paragraph",
        text:
          "Capture the small observation that may later become an essay, zine page, database entry, or research question.",
      },
    ],
    relatedLinks: [],
  },
];

const archiveList = document.querySelector("#archive-list");
const recordShell = document.querySelector("#record");
const recordSelect = document.querySelector("#record-select");
const ownerForm = document.querySelector("#owner-form");
const ownerGate = document.querySelector("#owner-gate");
const uploadForm = document.querySelector("#upload-form");

function getStoredImages() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStoredImages(imagesByRecord) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(imagesByRecord));
}

function getRecordImages(record) {
  const stored = getStoredImages();
  return [...(record.images || []), ...(stored[record.id] || [])];
}

function formatDate(date) {
  if (!date) return "Date unknown";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(`${date}T00:00:00`));
}

function compactMeta(parts) {
  return parts.filter(Boolean).join(" / ");
}

function recordHref(recordId) {
  return `./index.html#/${recordId}`;
}

function renderArchive() {
  archiveList.innerHTML = records
    .map((record, index) => {
      const images = getRecordImages(record);
      const flags = [
        record.notes?.length ? "full note" : "",
        images.length ? `${images.length} image${images.length > 1 ? "s" : ""}` : "",
        record.ticketImage ? "ticket" : "",
        record.relatedLinks?.length ? "research links" : "",
      ].filter(Boolean);

      return `
        <article class="archive-row">
          <div class="archive-row__number">${String(index + 1).padStart(2, "0")}</div>
          <div>
            <a class="archive-row__title" href="${recordHref(record.id)}" target="_blank" rel="noreferrer">${record.title}</a>
            <div class="archive-row__meta">
              ${compactMeta([record.city, record.institution, formatDate(record.visitDate)])}
            </div>
            <p class="archive-row__note">${record.summary || ""}</p>
            <div class="asset-flags">${flags.join(" · ")}</div>
            <div class="archive-row__links">
              <a href="${recordHref(record.id)}" target="_blank" rel="noreferrer">Read note</a>
              <a href="${recordHref(record.id)}" target="_blank" rel="noreferrer">View record</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderBlocks(blocks = []) {
  return blocks
    .map((block) => {
      if (block.type === "h2") return `<div class="entry-block"><h2>${block.text}</h2></div>`;
      if (block.type === "h3") return `<div class="entry-block"><h3>${block.text}</h3></div>`;
      if (block.type === "list") {
        return `<div class="entry-block"><ul>${block.items.map((item) => `<li>${item}</li>`).join("")}</ul></div>`;
      }
      return `<div class="entry-block"><p>${block.text}</p></div>`;
    })
    .join("");
}

function renderImages(record) {
  const images = getRecordImages(record);
  if (!images.length) {
    return `
      <div class="entry-block">
        <h2>Images / Visual Evidence</h2>
        <p>No uploaded images yet. This section is reserved for installation views, work details, wall text, tickets, posters, and booklets.</p>
      </div>
    `;
  }

  return `
    <div class="entry-block">
      <h2>Images / Visual Evidence</h2>
      <div class="evidence-grid">
        ${images
          .map(
            (image) => `
              <figure>
                <img src="${image.src}" alt="${image.alt || ""}" />
                <figcaption>${image.caption || image.alt || "Uncaptioned visual evidence."}</figcaption>
              </figure>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderRecord(recordId = records[0].id) {
  const record = records.find((item) => item.id === recordId) || records[0];
  const names = compactMeta([
    record.artists?.join(", "),
    record.curators?.length ? `Curated by ${record.curators.join(", ")}` : "",
    record.institution,
  ]);

  recordShell.innerHTML = `
    <header class="record-header">
      <p class="eyebrow">Selected Record / ${record.id}</p>
      <h2>${record.title}</h2>
      ${record.titleZh ? `<p>${record.titleZh}</p>` : ""}
      <div class="record-meta">
        <div>People / ${names || "To be added"}</div>
        <div>Place / ${compactMeta([record.city, record.country])}</div>
        <div>Visit date / ${formatDate(record.visitDate)}</div>
        <div>Exhibition dates / ${record.exhibitionDates || "Not recorded"}</div>
      </div>
      <div class="tags">${(record.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
    </header>

    <div class="entry-blocks">
      ${renderBlocks(record.notes)}
      ${renderImages(record)}
      ${renderBlocks(record.curatorialObservations)}
      ${renderBlocks(record.bodyArchiveLens)}
      ${renderBlocks(record.remember)}
      <div class="entry-block">
        <h2>Related Links</h2>
        ${
          record.relatedLinks?.length
            ? `<ul class="related-list">${record.relatedLinks
                .map((link) => `<li><a href="${link.url}" target="_blank" rel="noreferrer">${link.label}</a></li>`)
                .join("")}</ul>`
            : "<p>No related links recorded yet.</p>"
        }
      </div>
    </div>
  `;

  recordSelect.value = record.id;
}

function populateRecordSelect() {
  recordSelect.innerHTML = records
    .map((record) => `<option value="${record.id}">${record.title}</option>`)
    .join("");
}

function currentRouteRecordId() {
  const route = window.location.hash.replace("#/", "");
  return route && !["archive", "owner"].includes(route) ? route : records[0].id;
}

function isRecordRoute() {
  const route = window.location.hash.replace("#/", "");
  return Boolean(route && !["archive", "owner"].includes(route));
}

function renderCurrentRecord() {
  renderRecord(currentRouteRecordId());
  if (isRecordRoute()) {
    recordShell.scrollIntoView({ block: "start" });
  }
}

function unlockOwnerTools() {
  ownerGate.hidden = true;
  uploadForm.hidden = false;
  localStorage.setItem(OWNER_KEY, "true");
}

ownerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = new FormData(ownerForm).get("owner-key");
  if (String(value).trim() === OWNER_PASSCODE) {
    unlockOwnerTools();
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(uploadForm);
  const file = form.get("image");
  const recordId = form.get("record");
  if (!(file instanceof File) || !file.size || !recordId) return;

  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const stored = getStoredImages();
  stored[recordId] = [
    ...(stored[recordId] || []),
    {
      src,
      alt: String(form.get("alt") || file.name),
      caption: String(form.get("caption") || ""),
      kind: "other",
    },
  ];
  saveStoredImages(stored);
  uploadForm.reset();
  renderArchive();
  renderRecord(recordId);
  window.location.hash = `#/${recordId}`;
});

window.addEventListener("hashchange", () => {
  renderCurrentRecord();
});

populateRecordSelect();
renderArchive();
renderCurrentRecord();

if (localStorage.getItem(OWNER_KEY) === "true") {
  unlockOwnerTools();
}
