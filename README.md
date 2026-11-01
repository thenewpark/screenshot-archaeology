# Screenshot Archaeology

Download the repository ZIP and extract the whole folder. Double-click `index.html`, wait for **Open analysis JSON**, and select the JSON downloaded from the analyzer. Explore Constellation, Collage and Microcosm; export PNG or Print / PDF. No API key is needed.

## Read and edit the code

```text
src/
  sketch.js                    p5 setup/draw lifecycle
  config.js                    participant settings
  screenshot-archaeology/      application internals
    domain/                    archive data, state and calculations
    ui/                        DOM controls and inspector
    rendering/                 poster painters and p5 drawing callbacks
    infrastructure/            browser image decoding
    …                          layout, geometry and view coordination
lib/p5.min.js        vendored p5.js
runtime/offline.js   generated runtime for double-click opening
```

`src/` is the editable source. Start with `src/config.js` and `src/screenshot-archaeology/rendering/p5-elements.js`. Poster drawing uses millimetres. DOM/CSS handle page layout; p5 handles poster drawing.

To see source edits immediately, open this folder with VS Code Live Server, or run `python3 -m http.server 7863` and visit `http://127.0.0.1:7863`. HTTP(S) loads the source modules directly. Double-click opening uses the prebuilt `runtime/offline.js`; changes to source modules require rebuilding that offline runtime before they appear in file mode. Do not edit the generated runtime by hand.

Keep `src/`, `runtime/`, `lib/`, `style.css` and `index.html` together. Basteleur/Junction fonts are embedded locally in `style.css`; third-party licences are in `licenses/`. Development tests and extended guides are stored separately.
