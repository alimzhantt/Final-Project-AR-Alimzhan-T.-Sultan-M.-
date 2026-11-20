# RoomFit AR

WebAR app: place true-to-scale 3D furniture in your own room and find items by voice.
Brief B2 (Retail) · AR/VR/XR Applications (6B04103 AI Business) · Group AIB-2401 · Team of 2

**Live:** https://alimzhantt.github.io/Final-Project-AR-Alimzhan-T.-Sultan-M.-/
**Repository:** https://github.com/alimzhantt/Final-Project-AR-Alimzhan-T.-Sultan-M.-
**Demo video:** https://drive.google.com/file/d/1QLlnOthHgoPAHFqKSiCx-_I9goSBG5Ht/view?usp=sharing

## Team and module owners

| Member | ID | Module | Files |
|---|---|---|---|
| Alimzhan T. | 241177 | AR placement: hit-test, place/move/rotate, GLTF + animation mixer, FPS meter | `js/placement.js` |
| Sultan M. | 241280 | Voice search (AI), catalog UI, landing/permissions, fallback, result screen, models | `js/voice-search.js`, `js/app.js`, `js/catalog.js`, `css/style.css`, `models/` |

## Story (3 states)

1. **Intro** — landing page explains camera, motion and microphone permissions and asks for consent.
2. **Place** — the user finds an item by voice, typed search or catalog, then taps the floor to place it at real size; move, rotate, open wardrobe doors.
3. **Result** — the user enters the free space width and sees whether the item fits, plus time to place and FPS.

## Interactions

- Speak (voice search, AI feature)
- Place on the floor (WebXR hit-test + screen tap, XR input)
- Open wardrobe doors (animation-mixer)
- Extras: move, rotate ±15°, typed search, catalog tap

## Target device

Android phone, Chrome, ARCore (Google Play Services for AR) installed.
iPhone is not supported: Safari has no WebXR AR.

## Run (one command)

```bash
npm start
```

Starts a local server on http://localhost:8080 (needs Node.js).
WebXR needs HTTPS or localhost: to test on a phone, use the GitHub Pages link,
or `chrome://inspect` → Port forwarding 8080.

## Versions

- A-Frame 1.8.0
- aframe-extras 7.7.0 (animation-mixer)
- http-server 14.1.1 (dev only)

## Frame rate

| Device | Avg FPS | How measured |
|---|---|---|
| Android phone (model: M2) | 26 | built-in FPS meter, shown on the result screen after ~1 min in AR |

Target: 30 fps for phone AR. Measured 26 fps is slightly below target; next step: Draco-compress models and lower the renderer pixel ratio.

## AI service disclosure

Voice search uses the Web Speech API (`SpeechRecognition`, ru-RU and en-US).
In Chrome, audio is sent to Google's speech recognition service.
The app stores no audio and no transcripts.
Turning the transcript into filters (type, colour, max width) is rule-based parsing in `js/voice-search.js`.
Fallback when the microphone is denied, there is no network or the API is missing: typed search and tap catalog with the same filters.

## Privacy and comfort

- Every permission is explained on the landing page before it is requested.
- No personal data is stored; "Send to store" is a demo and sends nothing.
- No forced camera motion; the app can be used standing or seated.
- Fit result uses text and ✔ / ✖ icons, not colour only.

## Assets and licences

| Asset | Source | Licence |
|---|---|---|
| sofa.glb (loungeSofa), chair.glb, table.glb, bed.glb (bedDouble), wardrobe.glb (bookcaseClosedDoors) | Kenney Furniture Kit — https://kenney.nl/assets/furniture-kit | CC0 |

Each model is under 10 MB and the whole site under 30 MB.
If a model file is missing, the app shows a box of the real size.
Known gap: the Kenney wardrobe has no built-in animation, so the "Open doors" button has no visible effect yet.

## Code sources

- WebXR Hit Test API — https://immersive-web.github.io/hit-test/
- MDN SpeechRecognition — https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
