const state = {
  logs: [],
  filteredLogs: [],
  currentPage: 1,
  pageSize: 10,
  sortOrder: "desc",
  eventType: "all",
  searchText: "",
  fileName: ""
};

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const fileStatus = document.getElementById("fileStatus");
const eventTypeSelect = document.getElementById("eventType");
const searchInput = document.getElementById("searchInput");
const sortOrderSelect = document.getElementById("sortOrder");
const clearButton = document.getElementById("clearButton");
const tableBody = document.getElementById("logTableBody");
const emptyState = document.getElementById("emptyState");
const resultCount = document.getElementById("resultCount");
const pageInfo = document.getElementById("pageInfo");
const pagination = document.getElementById("pagination");
const errorBox = document.getElementById("errorBox");

const jsonModal = document.getElementById("jsonModal");
const rawJson = document.getElementById("rawJson");
const closeModal = document.getElementById("closeModal");


/* -----------------------------
 File Loading
----------------------------- */

fileInput.addEventListener("change", function (event) {
  const file = event.target.files[0];

  if (file) {
      loadFile(file);
  }
});

dropZone.addEventListener("dragover", function (event) {
  event.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", function () {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", function (event) {
  event.preventDefault();

  dropZone.classList.remove("dragover");

  const file = event.dataTransfer.files[0];

  if (file) {
      loadFile(file);
  }
});


async function loadFile(file) {
  clearError();

  if (!file.name.toLowerCase().endsWith(".jsonl") &&
      !file.name.toLowerCase().endsWith(".json") &&
      !file.name.toLowerCase().endsWith(".txt")) {

      showError("Please select a JSONL, JSON or TXT file.");
      return;
  }

  fileStatus.textContent = `Loading ${file.name}...`;

  try {
      const text = await file.text();

      parseJSONL(text, file.name);
  } catch (error) {
      showError("Unable to read the selected file.");
      fileStatus.textContent = "File loading failed.";
  }
}


/* -----------------------------
 Parse JSONL
----------------------------- */

function parseJSONL(text, fileName) {
  const lines = text.split(/\r?\n/);

  const logs = [];
  const invalidLines = [];

  lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
          return;
      }

      try {
          const parsed = JSON.parse(trimmedLine);

          if (
              parsed &&
              typeof parsed === "object" &&
              !Array.isArray(parsed)
          ) {
              logs.push(parsed);
          } else {
              invalidLines.push(index + 1);
          }

      } catch (error) {
          invalidLines.push(index + 1);
      }
  });

  state.logs = logs;
  state.fileName = fileName;
  state.currentPage = 1;

  populateEventTypes();
  applyFilters();

  fileStatus.textContent =
      `${fileName}: ${logs.length.toLocaleString()} events loaded.`;

  if (invalidLines.length > 0) {
      showError(
          `${invalidLines.length} invalid line(s) were skipped. ` +
          `Line numbers: ${invalidLines.slice(0, 10).join(", ")}` +
          (invalidLines.length > 10 ? "..." : "")
      );
  }
}


/* -----------------------------
 Auto Load eve-sample.jsonl
----------------------------- */

async function autoLoadSampleFile() {
  try {
      const response = await fetch("eve-sample.jsonl", {
          cache: "no-store"
      });

      if (!response.ok) {
          throw new Error("Sample file not found.");
      }

      const text = await response.text();

      parseJSONL(text, "eve-sample.jsonl");

  } catch (error) {

      fileStatus.textContent =
          "eve-sample.jsonl was not loaded automatically. " +
          "Use Upload JSONL to select the file.";

  }
}


/* -----------------------------
 Event Type Filter
----------------------------- */

function populateEventTypes() {

  const eventTypes = [
      ...new Set(
          state.logs
              .map(log => log.event_type)
              .filter(Boolean)
      )
  ].sort();

  eventTypeSelect.innerHTML = `
      <option value="all">All Events</option>
  `;

  eventTypes.forEach(type => {

      const option = document.createElement("option");

      option.value = type;
      option.textContent = type;

      eventTypeSelect.appendChild(option);
  });

  eventTypeSelect.value = state.eventType;
}


/* -----------------------------
 Filters
----------------------------- */

eventTypeSelect.addEventListener("change", function () {
  state.eventType = this.value;
  state.currentPage = 1;

  applyFilters();
});


searchInput.addEventListener("input", function () {
  state.searchText = this.value.trim().toLowerCase();
  state.currentPage = 1;

  applyFilters();
});


sortOrderSelect.addEventListener("change", function () {
  state.sortOrder = this.value;

  applyFilters();
});


clearButton.addEventListener("click", function () {

  state.eventType = "all";
  state.searchText = "";
  state.sortOrder = "desc";
  state.currentPage = 1;

  eventTypeSelect.value = "all";
  searchInput.value = "";
  sortOrderSelect.value = "desc";

  applyFilters();
});


function applyFilters() {

  let results = [...state.logs];

  if (state.eventType !== "all") {
      results = results.filter(
          log => log.event_type === state.eventType
      );
  }

  if (state.searchText) {

      results = results.filter(log => {

          try {
              return JSON.stringify(log)
                  .toLowerCase()
                  .includes(state.searchText);
          } catch {
              return false;
          }

      });
  }

  results.sort((a, b) => {

      const timestampA = getTimestampValue(a.timestamp);
      const timestampB = getTimestampValue(b.timestamp);

      /*
       * Missing/null/invalid timestamps always stay at the bottom.
       */
      if (timestampA === null && timestampB === null) {
          return 0;
      }

      if (timestampA === null) {
          return 1;
      }

      if (timestampB === null) {
          return -1;
      }

      return state.sortOrder === "asc"
          ? timestampA - timestampB
          : timestampB - timestampA;
  });

  state.filteredLogs = results;

  renderTable();
  renderPagination();
}


/* -----------------------------
 Timestamp Handling
----------------------------- */

function getTimestampValue(timestamp) {

  if (
      timestamp === null ||
      timestamp === undefined ||
      timestamp === ""
  ) {
      return null;
  }

  let value = timestamp;

  if (typeof value === "number") {

      if (!Number.isFinite(value)) {
          return null;
      }

      /*
       * Unix seconds are around 10 digits.
       * Unix milliseconds are around 13 digits.
       */
      if (Math.abs(value) < 1000000000000) {
          value *= 1000;
      }

      return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {

      const numericValue = Number(value);

      if (value.trim() !== "" && Number.isFinite(numericValue)) {

          if (Math.abs(numericValue) < 1000000000000) {
              return numericValue * 1000;
          }

          return numericValue;
      }

      const parsedDate = Date.parse(value);

      if (!Number.isNaN(parsedDate)) {
          return parsedDate;
      }
  }

  return null;
}


function formatTimestamp(timestamp) {

  const value = getTimestampValue(timestamp);

  if (value === null) {
      return "No timestamp";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
      return "No timestamp";
  }

  return date.toLocaleString();
}


/* -----------------------------
 Endpoint Formatting
----------------------------- */

function formatEndpoint(ip, port) {

  if (!ip) {
      return "-";
  }

  if (port !== undefined && port !== null && port !== "") {
      return `${ip}:${port}`;
  }

  return ip;
}


/* -----------------------------
 Severity
----------------------------- */

function getSeverity(log) {

  if (log.event_type !== "alert") {
      return {
          level: "info",
          label: "Info"
      };
  }

  const severity = log.alert?.severity;

  if (typeof severity === "number") {

      if (severity <= 1) {
          return {
              level: "high",
              label: `Severity ${severity}`
          };
      }

      if (severity === 2) {
          return {
              level: "medium",
              label: `Severity ${severity}`
          };
      }

      if (severity >= 3) {
          return {
              level: "low",
              label: `Severity ${severity}`
          };
      }
  }

  if (typeof severity === "string") {

      const normalized = severity.toLowerCase();

      if (
          normalized.includes("critical") ||
          normalized.includes("high")
      ) {
          return {
              level: "high",
              label: severity
          };
      }

      if (
          normalized.includes("medium") ||
          normalized.includes("warning")
      ) {
          return {
              level: "medium",
              label: severity
          };
      }

      if (normalized.includes("low")) {
          return {
              level: "low",
              label: severity
          };
      }
  }

  return {
      level: "unknown",
      label: "Unknown"
  };
}


/* -----------------------------
 Human Readable Summary
----------------------------- */

function getSummary(log) {

    const eventType = log.event_type;
  
    // Helper: bold title + optional muted subtitle line
    const build = (title, subtitle) => {
        let html = `<strong>${escapeHtml(title)}</strong>`;
        if (subtitle) {
            html += `<br><span class="summary-category">${escapeHtml(subtitle)}</span>`;
        }
        return html;
    };
  
    switch (eventType) {
  
        case "alert": {
            const signature = log.alert?.signature;
            const category = log.alert?.category;
            const action = log.alert?.action;
  
            const title = signature || action || "Security alert detected";
  
            return build(
                title,
                category ? `Category: ${category}` : ""
            );
        }
  
        case "http": {
            const method = log.http?.http_method || log.http?.method;
            const hostname = log.http?.hostname || log.http?.host;
            const url = log.http?.url;
            const status = log.http?.status;
            const userAgent = log.http?.http_user_agent;
  
            const title =
                method && hostname
                    ? `${method} ${hostname}`
                    : method || hostname || url || "HTTP event";
  
            const subtitleParts = [];
  
            if (url && url !== title) {
                subtitleParts.push(url);
            }
  
            if (status) {
                subtitleParts.push(`Status ${status}`);
            }
  
            if (userAgent) {
                subtitleParts.push(userAgent);
            }
  
            return build(title, subtitleParts.join(" · "));
        }
  
        case "dns": {
            const type = log.dns?.type;
            const query = log.dns?.rrname || log.dns?.query;
            const rcode = log.dns?.rcode;
  
            const title = query || "DNS event";
  
            const subtitleParts = [];
  
            if (type) {
                subtitleParts.push(`Type: ${type}`);
            }
  
            if (rcode) {
                subtitleParts.push(`Rcode: ${rcode}`);
            }
  
            return build(title, subtitleParts.join(" · "));
        }
  
        case "tls": {
            const sni = log.tls?.sni;
            const version = log.tls?.version;
            const subject = log.tls?.subject;
  
            const title = sni || subject || "TLS event";
  
            const subtitleParts = [];
  
            if (version) {
                subtitleParts.push(`Version: ${version}`);
            }
  
            if (subject && subject !== title) {
                subtitleParts.push(subject);
            }
  
            return build(title, subtitleParts.join(" · "));
        }
  
        case "ssh": {
            const client = log.ssh?.client;
            const server = log.ssh?.server;
  
            const formatSoftware = (side) => {
                if (!side) return "";
                if (typeof side === "string") return side;
  
                const parts = [];
                if (side.software_version) parts.push(side.software_version);
                if (side.proto_version) parts.push(`proto ${side.proto_version}`);
                return parts.join(" ");
            };
  
            const clientText = formatSoftware(client);
            const serverText = formatSoftware(server);
  
            const title =
                clientText
                    ? `SSH client: ${clientText}`
                    : serverText
                        ? `SSH server: ${serverText}`
                        : "SSH event";
  
            const subtitle =
                clientText && serverText
                    ? `Server: ${serverText}`
                    : "";
  
            return build(title, subtitle);
        }
  
        case "flow": {
            const state = log.flow?.state;
            const reason = log.flow?.reason;
            const bytes = log.flow?.bytes_toserver;
  
            const title = state ? `Flow state: ${state}` : "Network flow";
  
            const subtitleParts = [];
  
            if (reason) {
                subtitleParts.push(`Reason: ${reason}`);
            }
  
            if (bytes !== undefined && bytes !== null) {
                subtitleParts.push(`Bytes: ${bytes}`);
            }
  
            return build(title, subtitleParts.join(" · "));
        }
  
        case "fileinfo": {
            const filename = log.fileinfo?.filename;
            const magic = log.fileinfo?.magic;
            const md5 = log.fileinfo?.md5;
  
            const title = filename || "File information event";
  
            const subtitleParts = [];
  
            if (magic) {
                subtitleParts.push(magic);
            }
  
            if (md5) {
                subtitleParts.push(`MD5: ${md5}`);
            }
  
            return build(title, subtitleParts.join(" · "));
        }
  
        case "stats":
            return build("Suricata statistics");
  
        case "anomaly": {
            const event = log.anomaly?.event;
            const type = log.anomaly?.type;
  
            const title = event || type || "Network anomaly detected";
  
            const subtitle =
                event && type
                    ? `Type: ${type}`
                    : "";
  
            return build(title, subtitle);
        }
  
        case "drop":
            return build("Packet dropped");
  
        default: {
            const title =
                log.message ||
                log.event_type ||
                "Suricata event";
  
            return build(title);
        }
    }
}


/* -----------------------------
 Render Table
----------------------------- */

function renderTable() {

  tableBody.innerHTML = "";

  const total = state.filteredLogs.length;

  resultCount.textContent =
      `${total.toLocaleString()} event${total === 1 ? "" : "s"}`;

  if (total === 0) {
      emptyState.classList.remove("hidden");
      pageInfo.textContent = "";
      return;
  }

  emptyState.classList.add("hidden");

  const start =
      (state.currentPage - 1) * state.pageSize;

  const end =
      start + state.pageSize;

  const pageLogs =
      state.filteredLogs.slice(start, end);

  pageLogs.forEach((log, index) => {

      const row = document.createElement("tr");

      const severity = getSeverity(log);

      const source = formatEndpoint(
          log.src_ip,
          log.src_port
      );

      const destination = formatEndpoint(
          log.dest_ip,
          log.dest_port
      );

      const eventType =
        log.event_type || "-";

      const eventTypeClass =
        getEventTypeClass(log.event_type);

      const protocol =
          log.proto ||
          log.protocol ||
          "-";

      row.innerHTML = `
          <td>
              <span class="severity severity-${severity.level}">
                  ${escapeHtml(severity.label)}
              </span>
          </td>

          <td class="timestamp">
              ${escapeHtml(formatTimestamp(log.timestamp))}
          </td>

          <td>
              <span class="event-type ${eventTypeClass}">
                ${escapeHtml(eventType)}
              </span>
          </td>

          <td class="endpoint">
              ${escapeHtml(source)}
          </td>

          <td class="endpoint">
              ${escapeHtml(destination)}
          </td>

          <td>
              ${escapeHtml(protocol)}
          </td>

          <td class="summary">
            ${getSummary(log)}
          </td>

          <td>
              <button
                  class="details-button"
                  data-index="${start + index}"
              >
                  View JSON
              </button>
          </td>
      `;

      tableBody.appendChild(row);
  });

  const firstItem = start + 1;
  const lastItem = Math.min(end, total);

  pageInfo.textContent =
      `${firstItem}-${lastItem} of ${total}`;
}


/* -----------------------------
 Raw JSON Modal
----------------------------- */

tableBody.addEventListener("click", function (event) {

  const button =
      event.target.closest(".details-button");

  if (!button) {
      return;
  }

  const index =
      Number(button.dataset.index);

  const log =
      state.filteredLogs[index];

  if (!log) {
      return;
  }

  rawJson.textContent =
      JSON.stringify(log, null, 2);

  jsonModal.classList.remove("hidden");
});


closeModal.addEventListener("click", function () {
  jsonModal.classList.add("hidden");
});


jsonModal.addEventListener("click", function (event) {

  if (event.target === jsonModal) {
      jsonModal.classList.add("hidden");
  }
});


/* -----------------------------
 Pagination
----------------------------- */

function renderPagination() {

  pagination.innerHTML = "";

  const totalPages =
      Math.ceil(
          state.filteredLogs.length /
          state.pageSize
      );

  if (totalPages <= 1) {
      return;
  }

  const previousButton =
      createPageButton("Previous");

  previousButton.disabled =
      state.currentPage === 1;

  previousButton.addEventListener("click", function () {

      if (state.currentPage > 1) {
          state.currentPage--;
          renderTable();
          renderPagination();
      }
  });

  pagination.appendChild(previousButton);

  const pages = getPageNumbers(
      state.currentPage,
      totalPages
  );

  pages.forEach(page => {

      if (page === "...") {

          const span =
              document.createElement("span");

          span.className = "ellipsis";
          span.textContent = "...";

          pagination.appendChild(span);

          return;
      }

      const button =
          createPageButton(page);

      if (page === state.currentPage) {
          button.classList.add("active");
      }

      button.addEventListener("click", function () {

          state.currentPage = page;

          renderTable();
          renderPagination();
      });

      pagination.appendChild(button);
  });

  const nextButton =
      createPageButton("Next");

  nextButton.disabled =
      state.currentPage === totalPages;

  nextButton.addEventListener("click", function () {

      if (state.currentPage < totalPages) {
          state.currentPage++;
          renderTable();
          renderPagination();
      }
  });

  pagination.appendChild(nextButton);
}


function createPageButton(text) {

  const button =
      document.createElement("button");

  button.type = "button";
  button.textContent = text;

  return button;
}


function getPageNumbers(currentPage, totalPages) {

  if (totalPages <= 7) {
      return Array.from(
          { length: totalPages },
          (_, i) => i + 1
      );
  }

  const pages = [];

  pages.push(1);

  if (currentPage > 4) {
      pages.push("...");
  }

  const start =
      Math.max(2, currentPage - 1);

  const end =
      Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
      pages.push(i);
  }

  if (currentPage < totalPages - 3) {
      pages.push("...");
  }

  pages.push(totalPages);

  return pages;
}


/* -----------------------------
 Helpers
----------------------------- */

function escapeHtml(value) {

  return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}


function showError(message) {

  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}


function clearError() {

  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function getEventTypeClass(eventType) {

  const type = String(eventType || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");

  const supportedTypes = [
      "alert",
      "http",
      "dns",
      "tls",
      "ssh",
      "flow",
      "fileinfo",
      "stats",
      "anomaly",
      "drop"
  ];

  return supportedTypes.includes(type)
      ? type
      : "default";
}


/* -----------------------------
 Start Application
----------------------------- */

document.addEventListener("DOMContentLoaded", function () {
  autoLoadSampleFile();
});