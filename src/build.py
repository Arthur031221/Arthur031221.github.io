#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PE//1 — static site builder.

Composes nine routes from src/content.json into the repository root.
Content in, HTML out: every string that reaches a reader exists in
English and Traditional Chinese, and both are emitted. No client-side
rendering, no router, no framework — the HTML is readable with
JavaScript switched off.

    python3 src/build.py            # preview  -> _index.html …
    python3 src/build.py --live     # publish  -> index.html …
"""

import html
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = "https://arthur031221.github.io/"

with open(os.path.join(HERE, "content.json"), encoding="utf-8") as f:
    C = json.load(f)
with open(os.path.join(HERE, "shell.html"), encoding="utf-8") as f:
    SHELL = f.read()

M = C["meta"]

# ── page table ──────────────────────────────────────────────────────
PAGES = [
    ("index",        {"en": "Home",     "zh": "首頁"},   "01"),
    ("research",     {"en": "Research", "zh": "研究"},   "02"),
    ("publications", {"en": "Papers",   "zh": "論文"},   "03"),
    ("field",        {"en": "Field",    "zh": "現場"},   "04"),
    ("record",       {"en": "Record",   "zh": "紀錄"},   "05"),
    ("about",        {"en": "About",    "zh": "關於"},   "06"),
]

TITLES = {
    "index":        "Chi-Wei Lee — NeuroAI · 李騏維",
    "research":     "Research — Chi-Wei Lee",
    "publications": "Papers — Chi-Wei Lee",
    "field":        "Field — Chi-Wei Lee",
    "field-nsf":    "20 days, 20 iterations — Chi-Wei Lee",
    "field-igem":   "57 big meows, 45 small ones — Chi-Wei Lee",
    "record":       "Record — Chi-Wei Lee",
    "about":        "About — Chi-Wei Lee",
    "404":          "Signal lost — Chi-Wei Lee",
}

DESCS = {
    "index":        "Chi-Wei Lee — predictive coding, associative memory and Bayesian inference, in brains and in machines. Physics × EECS at National Tsing Hua University, visiting UCLA.",
    "research":     "Four research threads: predictive coding with memory, Langevin inference, spatial decoding from fMRI, and controllable diffusion — with live instruments for each.",
    "publications": "Papers and preprints by Chi-Wei Lee, with status stated as it actually stands.",
    "field":        "Two trips, told in full: the NSF HDR ML Challenge in Philadelphia and New York, and iGEM in Paris.",
    "field-nsf":    "Twenty days, twenty iterations — the NSF HDR ML Challenge, second worldwide of 600+ teams, and the AAAI-25 workshop in Philadelphia.",
    "field-igem":   "Fifty-seven big meows — sixteen people, one gold medal, and the iGEM Grand Jamboree in Paris.",
    "record":       "The public record: dated entries and the photographs that go with them.",
    "about":        "Chi-Wei Lee — Physics × EECS (AI Track) at National Tsing Hua University, HMI Lab, visiting UCLA. Looking for NeuroAI PhD positions, 2027 entry.",
    "404":          "This route does not exist. Recover from here.",
}

# cortical laminae — the left depth axis
LAMINAE = [
    ("L1",   {"en": "MOLECULAR",   "zh": "分子層"}),
    ("L2/3", {"en": "ASSOCIATIVE", "zh": "聯合層"}),
    ("L4",   {"en": "GRANULAR",    "zh": "顆粒層"}),
    ("L5a",  {"en": "OUTPUT",      "zh": "輸出層"}),
    ("L5b",  {"en": "PROJECTION",  "zh": "投射層"}),
    ("L6",   {"en": "FEEDBACK",    "zh": "回饋層"}),
]


# ── helpers ─────────────────────────────────────────────────────────
def e(s):
    return html.escape(str(s), quote=True)


def bi(o, tag="span", cls=""):
    """Emit both languages. Exactly one is revealed by CSS."""
    if o is None:
        return ""
    if isinstance(o, str):
        return e(o)
    c = (cls + " ") if cls else ""
    return (f'<{tag} class="{c}en">{e(o.get("en",""))}</{tag}>'
            f'<{tag} class="{c}zh">{e(o.get("zh",""))}</{tag}>')


def attr_bi(name, o):
    if isinstance(o, str):
        return f'data-{name}-en="{e(o)}" data-{name}-zh="{e(o)}"'
    return f'data-{name}-en="{e(o.get("en",""))}" data-{name}-zh="{e(o.get("zh",""))}"'


def webp_size(path):
    """Intrinsic size, so every image can ship width/height and never shift layout."""
    try:
        with open(path, "rb") as fh:
            d = fh.read(40)
    except OSError:
        return None
    if d[:4] != b"RIFF" or d[8:12] != b"WEBP":
        return None
    fmt = d[12:16]
    if fmt == b"VP8X":
        return 1 + int.from_bytes(d[24:27], "little"), 1 + int.from_bytes(d[27:30], "little")
    if fmt == b"VP8L":
        b = int.from_bytes(d[21:25], "little")
        return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
    if fmt == b"VP8 ":
        import struct
        return (struct.unpack("<H", d[26:28])[0] & 0x3FFF,
                struct.unpack("<H", d[28:30])[0] & 0x3FFF)
    return None


def img(src, alt, cls="", sizes="100vw", loading="lazy"):
    """<img> with real derivatives in the srcset, intrinsic size, bilingual alt."""
    alt_en = alt.get("en", "") if isinstance(alt, dict) else alt
    full = os.path.join(ROOT, src + ".webp")
    dim = webp_size(full)
    wh = f' width="{dim[0]}" height="{dim[1]}"' if dim else ""
    cand = []
    for w in (400, 800, 1200):
        if dim and w < dim[0] and os.path.exists(os.path.join(ROOT, f"{src}-{w}.webp")):
            cand.append(f"{src}-{w}.webp {w}w")
    if dim:
        cand.append(f"{src}.webp {dim[0]}w")
    srcset = f' srcset="{e(", ".join(cand))}" sizes="{e(sizes)}"' if len(cand) > 1 else ""
    return (f'<img src="{e(src)}.webp"{srcset}{wh} '
            f'alt="{e(alt_en)}" {attr_bi("alt", alt)} loading="{loading}" decoding="async" '
            f'class="{e(cls)}">')


def plate(photo, cls="", sizes="100vw", loading="lazy", lightbox=False):
    lb = f' data-lb="{e(photo["src"])}.webp" {attr_bi("cap", photo["cap"])}' if lightbox else ""
    slug = f'<span class="slug">{e(photo.get("slug",""))}</span>' if photo.get("slug") else ""
    lqip = f' style="background-image:url({e(photo["src"])}.thumb.webp)"'
    return (f'<figure class="plate {cls}"{lqip}{lb}>'
            f'{img(photo["src"], photo["cap"], sizes=sizes, loading=loading)}'
            f'{slug}'
            f'<figcaption class="cap">{bi(photo["cap"])}</figcaption>'
            f'<span class="iris" aria-hidden="true"></span>'
            f'</figure>')


def section(sid, lam, title, body, rail=None, note=None):
    rail = rail or (title.get("en") if isinstance(title, dict) else title)
    n = f'<span class="note">{bi(note)}</span>' if note else ""
    return (f'<section class="sec" id="{e(sid)}" data-rail="{e(rail)}" '
            f'data-cmd="1" data-cmd-en="{e(title.get("en",""))}" data-cmd-zh="{e(title.get("zh",""))}">'
            f'<div class="sec-h err">'
            f'<span class="lay">{e(lam)}</span>'
            f'<h2>{bi(title)}</h2>{n}'
            f'</div>{body}</section>')


def status_class(status):
    return {"review": "p", "accepted": "s", "published": "s", "service": "i"}.get(status, "")


# ── page: index ─────────────────────────────────────────────────────
def p_index():
    o = []
    o.append(f'''
<div class="hero">
  <div class="band err">
    <span class="live">● <span class="en">RECORDING</span><span class="zh">錄製中</span></span>
    <span>·</span><span>{bi(M["location"])}</span>
    <span>·</span><span><span class="en">SINGLE UNIT · PE//1</span><span class="zh">單一單元 · PE//1</span></span>
  </div>
  <div class="hero-stage err"><canvas id="hero" aria-label="Live retrieval of the name from a corrupted lattice, then release into an eight-mode sampler"></canvas></div>
  <h1 class="err"><span class="en" data-pe>{e(M["name"]["en"])}</span><span class="zh" data-pe>{e(M["name"]["zh"])}</span></h1>
  <p class="lede err">{bi(M["tagline"])}</p>
  <div class="meters err">
    <span class="m"><span class="en">RETRIEVAL</span><span class="zh">回想</span> <b data-h="ret">—</b></span>
    <span class="m"><span class="en">OVERLAP m</span><span class="zh">重疊度 m</span> <b data-h="m">—</b></span>
    <span class="m"><span class="en">MODES</span><span class="zh">模態</span> <b data-h="modes">8</b></span>
    <span class="m"><span class="en">TEMPERATURE T</span><span class="zh">溫度 T</span> <b data-h="temp">—</b></span>
    <span class="m"><span class="en">STEP</span><span class="zh">步數</span> <b data-h="step">—</b></span>
  </div>
  <div class="acts err">
    <a class="act p" href="research.html"><span class="en">Read the research</span><span class="zh">閱讀研究</span></a>
    <a class="act" href="Chi-Wei_Lee_CV.pdf"><span class="en">CV (PDF)</span><span class="zh">履歷 PDF</span></a>
    <button class="act" type="button" data-act="mail" data-mail="{e(M["email"])}"><span class="en">Copy email</span><span class="zh">複製信箱</span></button>
  </div>
</div>''')

    # threads
    units = []
    for i, t in enumerate(C["threads"]):
        units.append(f'''<article class="unit err">
  <div class="idx"><span class="n">{i+1:02d}</span>{bi(t["tag"])}</div>
  <h3>{bi(t["title"])}</h3>
  <p>{bi(t["body"])}</p>
  <a class="more" href="research.html#{e(t["id"])}"><span class="en">Open thread</span><span class="zh">展開</span></a>
</article>''')
    o.append(section("threads", "L2/3",
                     {"en": "Four threads, one question", "zh": "四條線，一個問題"},
                     f'<div class="grid c2">{"".join(units)}</div>',
                     rail="THREADS",
                     note={"en": "what memory does for inference", "zh": "記憶為推論做了什麼"}))

    # selected papers
    rows = []
    for p in C["publications"][:3]:
        rows.append(pub_row(p))
    o.append(section("papers", "L4",
                     {"en": "Selected papers", "zh": "選錄論文"},
                     f'<div class="ledger err">{"".join(rows)}</div>'
                     f'<div class="acts"><a class="act" href="publications.html">'
                     f'<span class="en">All five entries</span><span class="zh">全部五筆</span></a></div>',
                     rail="PAPERS",
                     note={"en": "status as it actually stands", "zh": "狀態據實陳述"}))

    # honours
    cards = []
    for a in C["awards"]:
        if not a.get("hero"):
            continue
        cards.append(f'''<article class="card err">
  <div class="idx"><span class="n">{e(a["year"])}</span>{bi(a["org"])}</div>
  <h3>{bi(a["title"])}</h3>
  <p>{bi(a["note"])}</p>
</article>''')
    o.append(section("honours", "L5a",
                     {"en": "Two that mattered", "zh": "兩項最重要的"},
                     f'<div class="grid c2">{"".join(cards)}</div>'
                     f'<div class="acts"><a class="act" href="about.html#awards">'
                     f'<span class="en">Every honour</span><span class="zh">完整獎項</span></a></div>',
                     rail="HONOURS"))

    # field
    lr = C["longreads"]
    trips = []
    for key, href in (("nsf", "field-nsf.html"), ("igem", "field-igem.html")):
        t = lr[key]
        hero = next((p for p in t["photos"] if p.get("role") == "hero"), t["photos"][0])
        trips.append(f'''<a class="unit err" href="{href}" style="padding:0;display:block">
  <div class="plate wide">{img(hero["src"], hero["cap"], sizes="(max-width:900px) 100vw, 50vw")}<span class="iris" aria-hidden="true"></span></div>
  <div style="padding:var(--s5)">
    <div class="idx"><span class="n">{e(t["date"])}</span>{e(t["place"])}</div>
    <h3>{bi(t["title"])}</h3>
    <span class="more"><span class="en">Read it</span><span class="zh">讀下去</span></span>
  </div>
</a>''')
    o.append(section("field", "L5b",
                     {"en": "Two trips, told in full", "zh": "兩趟旅程，完整說完"},
                     f'<div class="grid c2">{"".join(trips)}</div>',
                     rail="FIELD"))

    # contact
    facts = "".join(
        f'<div class="row" style="grid-template-columns:180px minmax(0,1fr)">'
        f'<div class="yr">{bi(f["k"])}</div><div class="bd"><h3>{bi(f["v"])}</h3></div></div>'
        for f in C["about"]["facts"])
    o.append(section("now", "L6",
                     {"en": "Where this is going", "zh": "接下來要去哪裡"},
                     f'<div class="ledger err">{facts}</div>'
                     f'<div class="acts">'
                     f'<button class="act p" type="button" data-act="mail" data-mail="{e(M["email"])}">'
                     f'<span class="en">Copy email</span><span class="zh">複製信箱</span></button>'
                     f'<a class="act" href="about.html"><span class="en">About</span><span class="zh">關於</span></a>'
                     f'</div>',
                     rail="NOW"))
    return "".join(o)


def pub_row(p):
    note = ""
    n = p.get("note") or {}
    if n.get("en") or n.get("zh"):
        note = f'<p class="note">{bi(n)}</p>'
    link = ""
    if p.get("doi"):
        label = "arXiv" if "arxiv" in p["doi"] else "DOI"
        link = f'<a class="chip s" href="{e(p["doi"])}" rel="noopener">{label} ↗</a>'
    return f'''<article class="row" data-status="{e(p["status"])}">
  <div class="yr">{e(p["year"])}</div>
  <div class="bd">
    <h3>{e(p["title"])}</h3>
    <p class="who">{e(p["authors"])}</p>
    <p class="where">{e(p["venue"])}</p>
    {note}
  </div>
  <div class="rt"><span class="chip {status_class(p["status"])}">{bi(p["badge"])}</span>{link}</div>
</article>'''


# ── page: research ──────────────────────────────────────────────────
FIGS = {
    "pc": ("hopfield", {"en": "Covariance-rule retrieval from a corrupted lattice",
                        "zh": "以共變異規則從受損晶格中回想"},
           {"en": "Three patterns are stored. The lattice starts corrupted at the bit-flip rate you set; asynchronous sweeps drive it back. Under the plain Hebb rule the shared background swamps the cue and the widest basin wins every time — the patterns are centred first, which is why the correct one comes back.",
            "zh": "儲存三個樣式。晶格以你設定的位元翻轉率開始受損，再由非同步掃描推回原狀。若用單純的 Hebb 規則，共同背景會淹沒提示，最寬的吸引盆每次都會勝出——因此樣式先被置中化，正確的那一個才回得來。"}),
    "langevin": ("langevin", {"en": "Eight-mode Langevin sampling against gradient descent",
                              "zh": "八模態 Langevin 取樣 vs 梯度下降"},
                 {"en": "Both columns descend the same energy. The left one only descends and arrives at point masses; the right one descends and diffuses, and recovers the density's actual width. The readout measures that width against the density's own sigma — drag the temperature to zero and the sampler collapses into the descent.",
                  "zh": "兩欄下降的是同一個能量。左欄只下降，最後停在點質量上；右欄同時下降並擴散，還原出密度真正的寬度。讀數量的就是這個寬度，以密度自身的 sigma 為單位——把溫度拉到零，取樣就會塌陷成下降。"}),
    "fmri": ("fmri", {"en": "Reading position out of a population of voxels",
                      "zh": "從一群體素中讀出位置"},
             {"en": "Each voxel has a preferred location and a width. Move the stimulus and the population response moves with it; the decoded estimate is the population vector, and it degrades exactly as fast as you would expect when voxels are dropped.",
              "zh": "每個體素都有偏好位置與調諧寬度。移動刺激，群體反應就跟著移動；解碼估計即群體向量，而當體素被移除時，它退化的速度正如預期。"}),
    "diffusion": ("guidance", {"en": "Guidance strength against sample diversity",
                               "zh": "引導強度 vs 樣本多樣性"},
                  {"en": "Turn the guidance up and every sample obeys the constraint — and every sample becomes the same sample. The interesting region is the one where reliability rises before diversity has collapsed, and that region is narrow.",
                   "zh": "把引導調強，每個樣本都會服從約束——然後每個樣本都變成同一個樣本。有意思的區間是可靠度已經上升、但多樣性尚未崩潰的那一段，而它很窄。"}),
}


def p_research():
    o = [f'''
<div class="masthead">
  <div class="band err"><span class="en">SECTION 02 · FOUR THREADS</span><span class="zh">第 02 節 · 四條線</span></div>
  <h1 class="err"><span class="en" data-pe>RESEARCH</span><span class="zh" data-pe>研究</span></h1>
  <p class="lede err"><span class="en">Every figure below runs. None of them is a picture of a result — each one computes, live, in your browser, and prints what it actually measured. Where a number comes from a paper instead, it says so.</span><span class="zh">底下每一張圖都在運算。它們不是結果的圖片——每一張都在你的瀏覽器裡即時計算，並印出它真正量到的值。若某個數字來自論文而非現場計算，圖上會註明。</span></p>
</div>''']

    for i, t in enumerate(C["threads"]):
        fig_id, fig_title, fig_note = FIGS[t["id"]]
        body = f'''<div class="reading err">
  <p class="lede" style="max-width:66ch;color:var(--ink-dim);font-size:var(--t-md)">{bi(t["body"])}</p>
</div>
<div class="fig err" data-fig="{fig_id}" style="margin-top:var(--s6)">
  <div class="fh">
    <span class="t">{bi(fig_title)}</span>
    <span class="out" data-out>—</span>
  </div>
  <canvas></canvas>
  <div class="ctl" data-ctl></div>
  <div class="fc">{bi(fig_note)}</div>
</div>'''
        o.append(section(t["id"], LAMINAE[i + 1][0], t["title"], body,
                         rail=t["id"].upper(), note=t["tag"]))

    # the relationship map is generated from the record, not hand-drawn:
    # an edge exists only where a thread's own description names the work.
    thread_short = {
        "pc":        {"en": "Predictive coding", "zh": "預測編碼"},
        "langevin":  {"en": "Langevin inference", "zh": "Langevin 推論"},
        "fmri":      {"en": "Spatial decoding", "zh": "空間解碼"},
        "diffusion": {"en": "Controllable diffusion", "zh": "可控擴散"},
    }
    nodes = [{"id": t["id"], "kind": "thread", "label": thread_short[t["id"]]} for t in C["threads"]]
    short = [
        {"en": "PC + memory denoiser", "zh": "預測編碼 + 記憶去噪"},
        {"en": "Langevin TPC", "zh": "Langevin 時序預測編碼"},
        {"en": "MatrixQR", "zh": "MatrixQR"},
        {"en": "Interferometer modes", "zh": "干涉儀模態分類"},
        {"en": "Anomaly benchmark", "zh": "異常偵測基準"},
    ]
    for i, p in enumerate(C["publications"]):
        nodes.append({"id": "p%d" % i, "kind": "paper", "label": short[i],
                      "year": p["year"], "status": p["status"]})
    edges = [
        {"a": "pc", "b": "p0", "why": {"en": "HOPE is this thread", "zh": "HOPE 即此線"}},
        {"a": "langevin", "b": "p1", "why": {"en": "the manuscript is this thread", "zh": "該手稿即此線"}},
        {"a": "diffusion", "b": "p2", "why": {"en": "MatrixQR is this thread", "zh": "MatrixQR 即此線"}},
        {"a": "pc", "b": "langevin", "why": {"en": "same energy, sampled instead of descended", "zh": "同一能量，改為取樣而非下降"}},
        {"a": "langevin", "b": "diffusion", "why": {"en": "same mathematics, different clothes", "zh": "同一套數學，換了衣服"}},
        {"a": "fmri", "b": "pc", "why": {"en": "the theory decides what a decoder may claim", "zh": "理論決定解碼器能宣稱什麼"}},
    ]
    o.append('<script type="application/json" id="fig-map">'
             + json.dumps({"nodes": nodes, "edges": edges}, ensure_ascii=False) + "</script>")

    o.append(section("map", "L6",
                     {"en": "What connects to what", "zh": "什麼連到什麼"},
                     '<div class="fig err" data-fig="map">'
                     '<div class="fh"><span class="t"><span class="en">Threads, papers and the edges that are real</span>'
                     '<span class="zh">研究線、論文，以及真正存在的連線</span></span>'
                     '<span class="out" data-out>—</span></div>'
                     '<canvas></canvas>'
                     '<div class="fc"><span class="en">An edge is drawn only where a paper actually uses the thread. '
                     'Hover a node to isolate its edges.</span>'
                     '<span class="zh">只有論文真正用到該研究線時才畫上連線。將游標移到節點上可單獨顯示它的連線。</span></div></div>',
                     rail="MAP"))
    o.append('<p class="err" style="max-width:62ch;margin-top:var(--s5);color:var(--muted);font-size:var(--t-sm)">'
             '<span class="en">Two entries have no edge. The interferometer paper is undergraduate physics and the '
             'anomaly benchmark is community service — neither belongs to a thread, and the spatial-decoding thread '
             'has no paper yet because the work is still running.</span>'
             '<span class="zh">有兩筆沒有連線。干涉儀那篇是大學部物理，異常偵測基準屬於社群服務——兩者都不屬於任何一條研究線；'
             '而空間解碼那條線目前沒有論文，因為工作仍在進行中。</span></p>')
    return "".join(o)


# ── page: publications ──────────────────────────────────────────────
def p_publications():
    pubs = sorted(C["publications"], key=lambda p: (-int(p["year"]), p["title"]))
    rows = "".join(pub_row(p) for p in pubs)
    n = len(pubs)
    filters = "".join(
        f'<button type="button" data-filter="{k}" aria-pressed="{"true" if k=="all" else "false"}">{bi(lab)}</button>'
        for k, lab in [
            ("all",       {"en": "All", "zh": "全部"}),
            ("review",    {"en": "Under review", "zh": "審查中"}),
            ("accepted",  {"en": "Accepted", "zh": "已接受"}),
            ("published", {"en": "Published", "zh": "已發表"}),
            ("service",   {"en": "Co-author", "zh": "共同作者"}),
        ])
    body = f'''<div class="filters err">{filters}</div>
<div class="ledger err">{rows}</div>
<p class="err" style="margin-top:var(--s5);font-family:var(--f-mono);font-size:var(--t-2xs);letter-spacing:.13em;text-transform:uppercase;color:var(--muted)">
  <span class="en">SHOWING <b data-filter-count style="color:var(--sig)">{n:02d}</b> OF {n:02d}</span>
  <span class="zh">顯示 <b data-filter-count style="color:var(--sig)">{n:02d}</b> / {n:02d} 筆</span>
</p>
<p class="err" style="margin-top:var(--s5);max-width:62ch;color:var(--muted);font-size:var(--t-sm)">
  <span class="en">Two entries are under anonymous review, so the author list and the venue stay unnamed until the process permits disclosure. Nothing here is stated at a status it has not reached.</span>
  <span class="zh">其中兩筆正在匿名審查，因此在流程允許揭露之前，作者名單與發表場域維持不具名。此處沒有任何一筆被寫成它尚未達到的狀態。</span>
</p>'''
    return f'''
<div class="masthead">
  <div class="band err"><span class="en">SECTION 03 · THE RECORD</span><span class="zh">第 03 節 · 紀錄</span></div>
  <h1 class="err"><span class="en" data-pe>PAPERS</span><span class="zh" data-pe>論文</span></h1>
  <p class="lede err"><span class="en">Five entries. Two are co-first-author manuscripts under review, one is an accepted TAAI poster, one is published, and one is a 150-author community benchmark I contributed to.</span><span class="zh">五筆。其中兩篇是共同第一作者、審查中的手稿，一篇是已接受的 TAAI 海報，一篇已發表，另一篇是我參與的 150 人社群基準論文。</span></p>
</div>
{section("list", "L4", {"en": "Entries", "zh": "條目"}, body, rail="PAPERS")}'''


# ── page: field ─────────────────────────────────────────────────────
def p_field():
    lr = C["longreads"]
    cards = []
    for key, href in (("nsf", "field-nsf.html"), ("igem", "field-igem.html")):
        t = lr[key]
        hero = next((p for p in t["photos"] if p.get("role") == "hero"), t["photos"][0])
        n_en, n_zh = len(t["en"]), len(t["zh"])
        cards.append(f'''<a class="unit err" href="{href}" style="padding:0;display:block">
  <div class="plate wide">{img(hero["src"], hero["cap"], sizes="(max-width:900px) 100vw, 50vw", loading="eager")}<span class="iris" aria-hidden="true"></span></div>
  <div style="padding:var(--s5)">
    <div class="idx"><span class="n">{e(t["date"])}</span>{e(t["place"])}</div>
    <h3>{bi(t["title"])}</h3>
    <p><span class="en">{n_en} paragraphs, written at the time.</span><span class="zh">{n_zh} 段，當時寫下的。</span></p>
    <span class="more"><span class="en">Read it</span><span class="zh">讀下去</span></span>
  </div>
</a>''')

    sheet = []
    for key in ("nsf", "igem"):
        for p in lr[key]["photos"]:
            sheet.append(plate(p, sizes="(max-width:640px) 50vw, 200px", lightbox=True))
    sheet.append(plate(C["slider"], sizes="(max-width:640px) 50vw, 200px", lightbox=True))

    return f'''
<div class="masthead">
  <div class="band err"><span class="en">SECTION 04 · AWAY FROM THE DESK</span><span class="zh">第 04 節 · 離開桌前</span></div>
  <h1 class="err"><span class="en" data-pe>FIELD</span><span class="zh" data-pe>現場</span></h1>
  <p class="lede err"><span class="en">Two trips that changed what I work on, written out in full rather than summarised into a line on a CV.</span><span class="zh">兩趟改變了我研究方向的旅程，完整寫出來，而不是壓縮成履歷上的一行。</span></p>
</div>
{section("trips", "L5a", {"en": "The two of them", "zh": "這兩趟"}, f'<div class="grid c2">{"".join(cards)}</div>', rail="TRIPS")}
{section("sheet", "L5b", {"en": "Contact sheet", "zh": "印樣"},
         f'<div class="strip err">{"".join(sheet)}</div>'
         f'<p class="err" style="margin-top:var(--s4);font-family:var(--f-mono);font-size:var(--t-2xs);'
         f'letter-spacing:.13em;text-transform:uppercase;color:var(--muted)">'
         f'<span class="en">{len(sheet):02d} FRAMES · CLICK TO ENLARGE · ← → TO STEP</span>'
         f'<span class="zh">{len(sheet):02d} 張 · 點擊放大 · ← → 切換</span></p>', rail="SHEET")}'''


# ── pages: the two essays ───────────────────────────────────────────
def p_essay(key):
    t = C["longreads"][key]
    hero = next((p for p in t["photos"] if p.get("role") == "hero"), t["photos"][0])
    rest = [p for p in t["photos"] if p is not hero]

    def flow(lang):
        paras = t[lang]
        n = len(paras)
        # place the remaining photographs proportionally through the essay
        slots = {}
        for i, ph in enumerate(rest):
            slots[max(1, int(round(n * (i + 1) / (len(rest) + 1))))] = ph
        out = []
        for i, para in enumerate(paras):
            cls = ' class="lead"' if i == 0 else ""
            out.append(f"<p{cls}>{e(para)}</p>")
            if i + 1 in slots:
                ph = slots[i + 1]
                cls2 = "wide" if ph.get("role") == "bleed" else "tall" if ph.get("role") == "detail" else ""
                out.append(f'<figure style="margin:var(--s7) 0">{plate(ph, cls=cls2, sizes="(max-width:900px) 100vw, 720px")}</figure>')
        return "".join(out)

    other = "field-igem.html" if key == "nsf" else "field-nsf.html"
    other_t = C["longreads"]["igem" if key == "nsf" else "nsf"]

    return f'''
<div class="masthead">
  <div class="band err">{e(t["place"])} · {e(t["date"])}</div>
  <h1 class="err"><span class="en" data-pe>{e(t["title"]["en"])}</span><span class="zh" data-pe>{e(t["title"]["zh"])}</span></h1>
</div>
<div class="err" style="margin-bottom:var(--s7)">{plate(hero, cls="wide", sizes="100vw", loading="eager")}</div>
<article class="sec settle reading" id="essay" data-rail="ESSAY">
  <div class="prose err">
    <div class="en">{flow("en")}</div>
    <div class="zh">{flow("zh")}</div>
  </div>
</article>
<nav class="pager">
  <a href="field.html"><span><span class="en">← BACK</span><span class="zh">← 返回</span></span>
    <b><span class="en">Field</span><span class="zh">現場</span></b></a>
  <a class="nx" href="{other}"><span><span class="en">THE OTHER ONE →</span><span class="zh">另一趟 →</span></span>
    <b>{bi(other_t["title"])}</b></a>
</nav>'''


# ── page: record ────────────────────────────────────────────────────
def p_record():
    lr = C["longreads"]
    entries = []
    for key, href in (("nsf", "field-nsf.html"), ("igem", "field-igem.html")):
        t = lr[key]
        shots = "".join(plate(p, sizes="(max-width:640px) 50vw, 220px", lightbox=True) for p in t["photos"])
        entries.append(f'''<article class="err" style="margin-bottom:var(--s8)">
  <div class="row" style="grid-template-columns:minmax(0,1fr) auto;align-items:baseline">
    <div class="bd">
      <h3 style="font-family:var(--f-display);font-size:var(--t-md)">{bi(t["title"])}</h3>
      <p class="where">{e(t["place"])} · {e(t["date"])}</p>
    </div>
    <div class="rt"><a class="chip s" href="{href}"><span class="en">READ →</span><span class="zh">閱讀 →</span></a></div>
  </div>
  <div class="strip" style="margin-top:var(--s4)">{shots}</div>
</article>''')

    aw = "".join(f'''<article class="row">
  <div class="yr">{e(a["year"])}</div>
  <div class="bd"><h3>{bi(a["title"])}</h3><p class="where">{bi(a["org"])}</p><p class="note">{bi(a["note"])}</p></div>
  <div class="rt">{'<span class="chip s"><span class="dot"></span>HERO</span>' if a.get("hero") else ''}</div>
</article>''' for a in C["awards"])

    # every tick on the career raster is a dated fact from the record above
    events = [{"year": int(a["year"]), "kind": "award", "label": a["title"]} for a in C["awards"]]
    events += [{"year": int(p["year"]), "kind": "paper", "label": {"en": p["title"], "zh": p["title"]},
                "status": p["status"]} for p in C["publications"]]
    raster_data = ('<script type="application/json" id="fig-career">'
                   + json.dumps(events, ensure_ascii=False) + "</script>")

    return f'''{raster_data}
<div class="masthead">
  <div class="band err"><span class="en">SECTION 05 · PUBLIC RECORD</span><span class="zh">第 05 節 · 公開紀錄</span></div>
  <h1 class="err"><span class="en" data-pe>RECORD</span><span class="zh" data-pe>紀錄</span></h1>
  <p class="lede err"><span class="en">Dated entries and the photographs that go with them. Everything here is either a fact from the record or a frame from a camera.</span><span class="zh">有日期的條目，以及與之對應的照片。這裡的一切不是紀錄上的事實，就是相機拍下的一格。</span></p>
</div>
{section("trips", "L5a", {"en": "Where I went", "zh": "去過哪裡"}, "".join(entries), rail="TRIPS")}
{section("honours", "L5b", {"en": "What was awarded", "zh": "獲得什麼"}, f'<div class="ledger err">{aw}</div>', rail="HONOURS")}
{section("raster", "L6", {"en": "The whole thing as a spike train", "zh": "把整份紀錄畫成尖峰序列"},
         '<div class="fig err" data-fig="career"><div class="fh">'
         '<span class="t"><span class="en">Every dated event, on one axis</span><span class="zh">所有有日期的事件，畫在同一條軸上</span></span>'
         '<span class="out" data-out>—</span></div><canvas></canvas>'
         '<div class="fc"><span class="en">One tick per dated event from the record above — awards below the axis, papers above it. '
         'Nothing is interpolated and nothing is smoothed.</span>'
         '<span class="zh">上方紀錄中每個有日期的事件各一刻度——獎項在軸下，論文在軸上。沒有內插，也沒有平滑。</span></div></div>',
         rail="RASTER")}'''


# ── page: about ─────────────────────────────────────────────────────
def p_about():
    facts = "".join(f'''<article class="row" style="grid-template-columns:200px minmax(0,1fr)">
  <div class="yr">{bi(f["k"])}</div><div class="bd"><h3>{bi(f["v"])}</h3></div></article>''' for f in C["about"]["facts"])

    aw = "".join(f'''<article class="row">
  <div class="yr">{e(a["year"])}</div>
  <div class="bd"><h3>{bi(a["title"])}</h3><p class="where">{bi(a["org"])}</p><p class="note">{bi(a["note"])}</p></div>
  <div class="rt">{'<span class="chip s"><span class="dot"></span>HERO</span>' if a.get("hero") else ''}</div>
</article>''' for a in C["awards"])

    port = C["portrait"]
    bio_en = "".join(f"<p>{e(p)}</p>" for p in C["about"]["body"]["en"]) if isinstance(C["about"]["body"]["en"], list) else f'<p>{e(C["about"]["body"]["en"])}</p>'
    bio_zh = "".join(f"<p>{e(p)}</p>" for p in C["about"]["body"]["zh"]) if isinstance(C["about"]["body"]["zh"], list) else f'<p>{e(C["about"]["body"]["zh"])}</p>'

    return f'''
<div class="masthead">
  <div class="band err"><span class="en">SECTION 06 · WHO IS RECORDING</span><span class="zh">第 06 節 · 誰在記錄</span></div>
  <h1 class="err"><span class="en" data-pe>ABOUT</span><span class="zh" data-pe>關於</span></h1>
  <p class="lede err">{bi(C["about"]["lead"])}</p>
</div>
{section("bio", "L2/3", {"en": "In his own words", "zh": "他自己的說法"},
         f'''<div class="grid c2" style="background:transparent;border:0;gap:var(--s6)">
  <div class="reading err"><div class="prose"><div class="en">{bio_en}</div><div class="zh">{bio_zh}</div></div></div>
  <div class="err">{plate(port, cls="tall", sizes="(max-width:900px) 100vw, 420px", loading="eager")}</div>
</div>''', rail="BIO")}
{section("facts", "L4", {"en": "The short version", "zh": "簡短版本"}, f'<div class="ledger err">{facts}</div>', rail="FACTS")}
{section("awards", "L5a", {"en": "Honours", "zh": "獎項"}, f'<div class="ledger err">{aw}</div>', rail="HONOURS")}
{section("contact", "L6", {"en": "Reaching him", "zh": "聯絡方式"},
         f'''<div class="grid c3" style="background:transparent;border:0;gap:var(--s3)">
  <button class="card err" type="button" data-act="mail" data-mail="{e(M["email"])}" style="text-align:left">
    <div class="idx"><span class="n">01</span><span class="en">EMAIL</span><span class="zh">電子郵件</span></div>
    <h3 style="font-size:var(--t-sm);word-break:break-all">{e(M["email"])}</h3>
    <span class="more"><span class="en">Copy</span><span class="zh">複製</span></span>
  </button>
  <a class="card err" href="{e(M["github"])}" rel="noopener">
    <div class="idx"><span class="n">02</span>GITHUB</div>
    <h3 style="font-size:var(--t-sm)">Arthur031221</h3>
    <span class="more"><span class="en">Open</span><span class="zh">前往</span></span>
  </a>
  <a class="card err" href="{e(M["cv"])}">
    <div class="idx"><span class="n">03</span><span class="en">CURRICULUM VITAE</span><span class="zh">履歷</span></div>
    <h3 style="font-size:var(--t-sm)">Chi-Wei_Lee_CV.pdf</h3>
    <span class="more"><span class="en">Download</span><span class="zh">下載</span></span>
  </a>
</div>''', rail="CONTACT")}'''


# ── page: 404 ───────────────────────────────────────────────────────
def p_404():
    links = "".join(
        f'<a class="card err" href="{pid}.html"><div class="idx"><span class="n">{ch}</span>CH.{ch}</div>'
        f'<h3>{bi(lab)}</h3></a>' for pid, lab, ch in PAGES)
    return f'''
<div class="masthead">
  <div class="band err"><span class="en">ERROR · UNRESOLVED RESIDUAL</span><span class="zh">錯誤 · 未解殘差</span></div>
  <h1 class="err"><span class="en" data-pe>SIGNAL LOST</span><span class="zh" data-pe>訊號中斷</span></h1>
  <p class="lede err"><span class="en">The prediction was made and nothing came back to cancel it. This route does not exist — pick a channel below.</span><span class="zh">預測發出去了，卻沒有任何東西回來抵消它。這條路由不存在——請從下面選一個頻道。</span></p>
</div>
{section("recover", "L1", {"en": "Recover", "zh": "回復"}, f'<div class="grid c3" style="background:transparent;border:0;gap:var(--s3)">{links}</div>', rail="RECOVER")}'''


RENDER = {
    "index": p_index, "research": p_research, "publications": p_publications,
    "field": p_field, "field-nsf": lambda: p_essay("nsf"), "field-igem": lambda: p_essay("igem"),
    "record": p_record, "about": p_about, "404": p_404,
}


# ── shell composition ───────────────────────────────────────────────
def nav_html(current):
    out = []
    for pid, lab, ch in PAGES:
        cur = ' aria-current="page"' if pid == current else ""
        out.append(f'<a href="{pid}.html"{cur}><span class="ch">{ch}</span>{bi(lab)}</a>')
    return "".join(out)


def drawer_html(current):
    out = []
    for pid, lab, ch in PAGES:
        cur = ' aria-current="page"' if pid == current else ""
        out.append(f'<a href="{pid}.html"{cur}><span class="ch">CH.{ch}</span>{bi(lab)}</a>')
    return "".join(out)


def depth_html():
    out = []
    for code, name in LAMINAE:
        out.append(f'<div class="lay"><span class="t"></span><b>{code}</b>'
                   f'<span class="nm"><span class="en">{name["en"]}</span>'
                   f'<span class="zh">{name["zh"]}</span></span></div>')
    return "".join(out)


def jsonld(pid):
    if pid != "index":
        return ""
    data = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": M["name"]["en"],
        "alternateName": M["name"]["zh"],
        "jobTitle": M["role"]["en"],
        "url": SITE,
        "email": "mailto:" + M["email"],
        "sameAs": [M["github"]],
        "affiliation": {"@type": "CollegeOrUniversity", "name": "National Tsing Hua University"},
        "knowsAbout": ["Predictive coding", "Associative memory", "Bayesian inference",
                       "Computational neuroscience", "Machine learning"],
    }
    return ('<script type="application/ld+json">'
            + json.dumps(data, ensure_ascii=False) + "</script>")


def build(live):
    written = []
    for pid in list(RENDER):
        page = SHELL
        page = page.replace("{{title}}", e(TITLES[pid]))
        page = page.replace("{{description}}", e(DESCS[pid]))
        page = page.replace("{{canonical}}", SITE + ("" if pid == "index" else pid + ".html"))
        page = page.replace("{{nav}}", nav_html(pid))
        page = page.replace("{{drawer}}", drawer_html(pid))
        page = page.replace("{{depth}}", depth_html())
        page = page.replace("{{jsonld}}", jsonld(pid))
        page = page.replace("{{main}}", RENDER[pid]())
        name = (pid if live else "_" + pid) + ".html"
        with open(os.path.join(ROOT, name), "w", encoding="utf-8") as fh:
            fh.write(page)
        written.append((name, len(page.encode("utf-8"))))

    for name, size in written:
        print(f"  {name:<24} {size/1024:6.1f} KB")
    total = sum(s for _, s in written)
    print(f"  {'':<24} {'-'*8}\n  {len(written)} routes         {total/1024:6.1f} KB")
    return written


if __name__ == "__main__":
    live = "--live" in sys.argv
    print(("PUBLISH" if live else "PREVIEW") + " → " + ROOT)
    build(live)
