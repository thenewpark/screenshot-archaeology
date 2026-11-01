/** Browser import lifecycle: register first, enable only once the renderer is ready. */
export function createArchiveImport({ input, label, status, open }) {
  let ready = false;
  let busy = false;

  function update() {
    input.disabled = !ready || busy;
    label.setAttribute("aria-disabled", String(input.disabled));
    label.querySelector("span").textContent = busy
      ? "Opening JSON…"
      : ready
        ? "Open analysis JSON"
        : "Preparing workspace…";
  }

  async function change() {
    const file = input.files?.[0];
    input.value = "";
    if (!file || !ready || busy) {
      return;
    }
    busy = true;
    update();
    status("Reading analysis JSON…");
    try {
      await open(JSON.parse(await file.text()));
      status("");
    } catch (error) {
      status(error.message, true);
    } finally {
      busy = false;
      update();
    }
  }

  input.addEventListener("change", change);
  update();
  return Object.freeze({
    enable() {
      ready = true;
      update();
    },
    dispose() {
      ready = false;
      input.removeEventListener("change", change);
      update();
    },
  });
}
