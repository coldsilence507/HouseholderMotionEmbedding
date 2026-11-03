(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const V = "static/videos";

  /* ---------- link buttons: empty href => "soon" ---------- */
  document.querySelectorAll(".links .btn[data-label]").forEach((a) => {
    const href = (a.getAttribute("href") || "").trim();
    if (!href || href === "#") {
      a.classList.add("soon");
      a.removeAttribute("href");
      a.setAttribute("aria-disabled", "true");
      a.title = a.dataset.label + " link coming soon";
    } else {
      a.target = "_blank";
      a.rel = "noopener";
    }
  });

  /* ---------- data ---------- */
  const METHOD_NAMES = { ours: "HME (ours)", ttm: "TTM", gwtf: "GWTF", dismo: "DisMo", motionpro: "MotionPro" };
  const ALL6 = ["ttm", "gwtf", "dismo", "motionpro"];

  const TASKS = {
    transfer: {
      input: "Reference video",
      examples: [
        { id: "bear", name: "Bear" },
        { id: "car-roundabout", name: "Car" },
        { id: "goat", name: "Goat" },
        { id: "hike", name: "Hiker" },
        { id: "mallard-water", name: "Mallard" },
        { id: "night-race", name: "Night race" },
        { id: "paragliding", name: "Paragliding" },
        { id: "snowboard", name: "Snowboard" },
        {
          id: "cyberpunk", name: "Robots", ar: "720 / 480", baselines: ["gwtf", "dismo", "motionpro"],
          caption: "The motion of three people in the reference video is transferred to a different scene, generated from a new first frame and the prompt “Cyberpunk rooftop at night … three humanoid robots standing in a triangular group pose …”."
        }
      ]
    },
    object: {
      input: "Motion signal",
      examples: [
        { id: "fox", name: "Fox" },
        { id: "ball", name: "Ball" },
        { id: "mc8_1638-01", name: "Toy bus" },
        { id: "mc9_0126-05", name: "Planet" },
        { id: "astronaut", name: "Astronaut" },
        { id: "mc9_0301-01", name: "Clownfish" },
        { id: "mc9_0308-02", name: "Fish" },
        { id: "orca", name: "Orcas" },
        { id: "mc9_0409-01", name: "Junk boat" },
        { id: "mc9_0429-02", name: "Balloon" },
        { id: "mc9_0436-02", name: "Jellyfish" },
        { id: "mc9_0458-01", name: "Geese" },
        { id: "mc9_0522-01", name: "Bird" },
        { id: "mc9_0533-01", name: "Ducks" },
        { id: "mc9_0551-02", name: "Swan" },
        { id: "mc9_0556-01", name: "Daisy" }
      ]
    },
    camera: {
      input: "Reference video",
      examples: [
        { id: "garden", name: "Garden" },
        { id: "lobby", name: "Store" },
        { id: "dl072425", name: "Hedges" },
        { id: "dl0b6c10", name: "Canopy" },
        { id: "dl1056cf", name: "Rock" },
        { id: "park", name: "Park" }
      ]
    }
  };

  /* ---------- sync helper: followers track a master video ---------- */
  function syncGroup(master, getFollowers) {
    const align = () => {
      for (const v of getFollowers()) {
        if (!v.src || v.readyState < 2 || v.seeking) continue;
        if (Math.abs(v.currentTime - master.currentTime) > 0.12) {
          try { v.currentTime = master.currentTime; } catch (e) { /* not ready yet */ }
        }
      }
    };
    master.addEventListener("timeupdate", align);
    master.addEventListener("seeked", align);
    master.addEventListener("play", () => getFollowers().forEach((v) => v.play().catch(() => {})));
    master.addEventListener("pause", () => getFollowers().forEach((v) => v.pause()));
    return align;
  }

  function makePane(label, src, poster, isOurs, ar) {
    const fig = document.createElement("figure");
    fig.className = "pane" + (isOurs ? " is-ours" : "");
    if (ar) fig.style.setProperty("--ar", ar);
    const tag = document.createElement("span");
    tag.className = "tag" + (isOurs ? " ours" : "");
    tag.textContent = label;
    const v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true;
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.preload = "auto";
    v.poster = poster;
    v.dataset.src = src;
    v.setAttribute("aria-label", label);
    fig.append(tag, v);
    return { fig, v };
  }

  /* ---------- comparison viewer ---------- */
  class Viewer {
    constructor(root, key) {
      this.root = root; this.key = key; this.task = TASKS[key];
      this.exIdx = 0; this.mode = "gwtf"; this.active = false; this.userPaused = reduceMotion;
      this.build();
    }
    get ex() { return this.task.examples[this.exIdx]; }
    get baselines() { return this.ex.baselines || ALL6; }
    path(m) { return `${V}/${this.key}/${this.ex.id}/${m}`; }

    build() {
      const exWrap = document.createElement("div");
      exWrap.className = "examples";
      exWrap.setAttribute("role", "group");
      exWrap.setAttribute("aria-label", "Examples");
      this.task.examples.forEach((ex, i) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "ex";
        b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
        b.innerHTML = `<img src="${V}/${this.key}/${ex.id}/ours.jpg" alt="" loading="lazy"><span>${ex.name}</span>`;
        b.addEventListener("click", () => this.selectExample(i));
        exWrap.append(b);
      });
      this.exButtons = [...exWrap.children];

      this.toolbar = document.createElement("div");
      this.toolbar.className = "toolbar";

      this.stage = document.createElement("div");
      this.stage.className = "stage";

      this.caption = document.createElement("p");
      this.caption.className = "caption";

      this.root.append(exWrap, this.toolbar, this.stage, this.caption);
      this.renderToolbar();
      this.renderStage();
    }

    renderToolbar() {
      const t = this.toolbar;
      t.innerHTML = "";
      const lbl = document.createElement("span");
      lbl.className = "lbl"; lbl.textContent = "Compare with";
      t.append(lbl);
      if (!this.baselines.includes(this.mode) && this.mode !== "all") this.mode = this.baselines.includes("gwtf") ? "gwtf" : this.baselines[0];
      [...this.baselines, "all"].forEach((m) => {
        const c = document.createElement("button");
        c.type = "button"; c.className = "chip";
        c.textContent = m === "all" ? "All methods" : METHOD_NAMES[m];
        c.setAttribute("aria-pressed", this.mode === m ? "true" : "false");
        c.addEventListener("click", () => { this.mode = m; this.renderToolbar(); this.renderStage(); });
        t.append(c);
      });
      const sp = document.createElement("span"); sp.className = "spacer"; t.append(sp);
      this.playBtn = document.createElement("button");
      this.playBtn.type = "button"; this.playBtn.className = "play";
      this.playBtn.addEventListener("click", () => {
        this.userPaused = !this.userPaused;
        this.userPaused ? this.pause() : this.play();
      });
      this.updatePlayBtn();
      t.append(this.playBtn);
    }

    updatePlayBtn() {
      if (this.playBtn) this.playBtn.textContent = this.userPaused ? "▶ Play" : "❚❚ Pause";
    }

    renderStage() {
      const ex = this.ex;
      const t0 = this.master && this.master.currentTime ? this.master.currentTime : 0;
      this.stage.innerHTML = "";
      this.stage.classList.toggle("all", this.mode === "all");
      const methods = this.mode === "all" ? ["ours", ...this.baselines] : ["ours", this.mode];
      const panes = [makePane(this.task.input, this.path("ref") + ".mp4", this.path("ref") + ".jpg", false, ex.ar)];
      methods.forEach((m) => panes.push(makePane(METHOD_NAMES[m], this.path(m) + ".mp4", this.path(m) + ".jpg", m === "ours", ex.ar)));
      panes.forEach((p) => this.stage.append(p.fig));
      this.videos = panes.map((p) => p.v);
      this.master = panes[1].v;
      const followers = this.videos.filter((v) => v !== this.master);
      this.followers = followers;
      syncGroup(this.master, () => followers);
      this.caption.textContent = ex.caption || "";
      this.caption.hidden = !ex.caption;
      if (this.active) this.load(t0);
    }

    selectExample(i) {
      if (i === this.exIdx) return;
      this.exIdx = i;
      this.exButtons.forEach((b, j) => b.setAttribute("aria-pressed", j === i ? "true" : "false"));
      if (this.master) this.master.currentTime = 0;
      this.renderToolbar();
      this.renderStage();
    }

    load(t0 = 0) {
      this.videos.forEach((v) => { if (!v.src) { v.src = v.dataset.src; } });
      if (t0) this.videos.forEach((v) => v.addEventListener("loadedmetadata", () => { try { v.currentTime = t0; } catch (e) {} }, { once: true }));
      if (!this.userPaused) this.play();
    }
    play() { if (!this.master) return; this.master.play().catch(() => {}); this.followers.forEach((v) => v.play().catch(() => {})); this.updatePlayBtn(); }
    pause() { (this.videos || []).forEach((v) => v.pause()); this.updatePlayBtn(); }
    activate() { this.active = true; this.load(); }
    deactivate() { this.active = false; this.pause(); }
  }

  const viewers = [];
  document.querySelectorAll(".task[data-task]").forEach((el) => {
    const v = new Viewer(el.querySelector(".viewer"), el.dataset.task);
    viewers.push([el, v]);
  });

  /* ---------- gamma slider ---------- */
  const gammaVals = ["01", "03", "05", "07", "09"];
  const gRoot = document.getElementById("task-gamma");
  const gVideos = [...gRoot.querySelectorAll("video")];
  const gRef = gVideos[0];
  const gGen = document.getElementById("gamma-video");
  const gTag = document.getElementById("gamma-tag");
  const gRange = document.getElementById("gamma-range");
  let gActive = false;
  syncGroup(gRef, () => gVideos.slice(1));
  gRange.addEventListener("input", () => {
    const k = gammaVals[+gRange.value];
    const val = "0." + k[1];
    gTag.textContent = `HME, γ = ${val}`;
    gRange.setAttribute("aria-valuetext", val);
    const src = `${V}/gamma/g${k}.mp4`;
    gGen.dataset.src = src;
    gGen.poster = `${V}/gamma/g${k}.jpg`;
    if (gActive) {
      const t = gRef.currentTime;
      gGen.src = src;
      gGen.addEventListener("loadedmetadata", () => { try { gGen.currentTime = t; } catch (e) {} if (!gRef.paused) gGen.play().catch(() => {}); }, { once: true });
    }
  });
  const gamma = {
    activate() {
      gActive = true;
      gVideos.forEach((v) => { if (!v.src) v.src = v.dataset.src; });
      if (!reduceMotion) { gRef.play().catch(() => {}); gVideos.slice(1).forEach((v) => v.play().catch(() => {})); }
    },
    deactivate() { gActive = false; gVideos.forEach((v) => v.pause()); }
  };
  if (reduceMotion) gVideos.forEach((v) => (v.controls = true));

  /* ---------- highlights rows ---------- */
  const hlRoot = document.getElementById("task-highlights");
  const hlRows = hlRoot ? [...hlRoot.querySelectorAll(".hl-row")].map((row) => {
    const vids = [...row.querySelectorAll("video")];
    const master = vids[vids.length - 1];
    syncGroup(master, () => vids.slice(0, -1));
    return vids;
  }) : [];
  const highlights = {
    activate() {
      hlRows.forEach((vids) => {
        vids.forEach((v) => { if (!v.src) v.src = v.dataset.src; });
        if (!reduceMotion) vids.forEach((v) => v.play().catch(() => {}));
      });
    },
    deactivate() { hlRows.forEach((vids) => vids.forEach((v) => v.pause())); }
  };
  if (reduceMotion) hlRows.flat().forEach((v) => (v.controls = true));

  /* ---------- play only what is on screen ---------- */
  const teaser = document.getElementById("teaser");
  const targets = new Map(viewers.map(([el, v]) => [el, v]));
  targets.set(gRoot, gamma);
  if (hlRoot) targets.set(hlRoot, highlights);
  targets.set(teaser, {
    activate() { if (!reduceMotion) teaser.play().catch(() => {}); },
    deactivate() { teaser.pause(); }
  });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const t = targets.get(e.target);
        if (!t) return;
        e.isIntersecting ? t.activate() : t.deactivate();
      });
    }, { rootMargin: "200px 0px", threshold: 0.01 });
    targets.forEach((_, el) => io.observe(el));
  } else {
    targets.forEach((t) => t.activate());
  }

  /* ---------- tabs ---------- */
  const tabs = [...document.querySelectorAll(".tabs [role=tab]")];
  tabs.forEach((b) => b.addEventListener("click", () => {
    tabs.forEach((x) => {
      const on = x === b;
      x.setAttribute("aria-selected", on ? "true" : "false");
      document.getElementById(x.dataset.tab).hidden = !on;
    });
  }));

  /* ---------- copy bibtex ---------- */
  const copyBtn = document.querySelector(".copy");
  copyBtn.addEventListener("click", async () => {
    const text = document.getElementById("bibcode").textContent;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied";
    } catch (e) {
      const r = document.createRange();
      r.selectNodeContents(document.getElementById("bibcode"));
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      copyBtn.textContent = "Selected";
    }
    setTimeout(() => (copyBtn.textContent = "Copy"), 1600);
  });
})();
