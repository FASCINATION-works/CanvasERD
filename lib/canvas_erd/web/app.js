"use strict";

const status = document.querySelector("#status");

fetch("/api/schema")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((schema) => {
    const count = schema.entities.length;
    status.textContent = `Loaded ${count} ${count === 1 ? "table" : "tables"}.`;
  })
  .catch((error) => {
    status.textContent = `Could not load the schema: ${error.message}`;
  });
