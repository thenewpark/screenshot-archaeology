// Direct file opening uses the prebuilt runtime; HTTP(S) loads editable modules.
function showStartupError(error) {
  const status = document.getElementById("importStatus");
  status.textContent = `The workspace could not start. Reload and try again. ${error.message}`;
  status.classList.add("error");
}

if (location.protocol === "file:") {
  const runtime = document.createElement("script");
  runtime.src = new URL("../../runtime/offline.js", document.currentScript.src).href;
  runtime.onerror = () => showStartupError(new Error("Offline runtime unavailable."));
  document.body.append(runtime);
} else {
  import("../sketch.js").catch(showStartupError);
}
