# HME project page

Static project page for **Householder Motion Embedding: Noise Modulation for Motion-Controllable Video Generation** (NeurIPS 2026). No build step: plain HTML, CSS and JS.

```
index.html              page content (title, authors, abstract, method, results, tables, BibTeX)
static/css/style.css    styles (light + dark mode)
static/js/main.js       video comparison viewer, γ slider, tabs, copy button
static/images/          Fig. 1, Fig. 2, social preview image
static/videos/          teaser video + curated comparison clips (H.264 MP4, ~47 MB)
```

## Preview locally

```
cd HME_project_page
python -m http.server 8000
```
Then open http://localhost:8000. (Opening index.html directly also works in most browsers.)

## Publish on GitHub Pages

1. Create a public GitHub repository (e.g. `HME` or `hme-project-page`).
2. Upload the contents of this folder to the repository root (all files are under GitHub's 100 MB per-file limit).
3. Repository **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`. Save.
4. After a minute the page is live at `https://<your-username>.github.io/<repo-name>/`.

## Fill in the arXiv and Code links

In `index.html`, find the two buttons with `data-label="arXiv"` and `data-label="Code"` and paste the URL into `href=""`.
While `href` is empty, the button shows a "soon" badge and is not clickable.

## Add or change comparison videos

Each example lives in `static/videos/<task>/<example>/` with one clip per method:
`ref.mp4`, `ours.mp4`, `ttm.mp4`, `gwtf.mp4`, `dismo.mp4`, `motionpro.mp4` (plus a `.jpg` poster for each).
Tasks are `transfer`, `object` and `camera`. Register a new example in the `TASKS` list at the top of `static/js/main.js`.

The clips were cut from the supplementary composites (6 × 720 px columns), with the top 32 px removed to drop the burned-in method labels:
```
ffmpeg -i composite.mp4 -vf "crop=720:448:<col*720>:32" -an -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -movflags +faststart ours.mp4
```
