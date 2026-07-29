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
    "field-igem":   "Sixteen people, one gold medal — Chi-Wei Lee",
    "record":       "Record — Chi-Wei Lee",
    "about":        "About — Chi-Wei Lee",
    "404":          "Page not found — Chi-Wei Lee",
}

DESCS = {
    "index":        "Chi-Wei Lee — NeuroAI researcher studying predictive coding, associative memory, and Bayesian inference. NTHU Physics × EECS graduate, currently visiting UCLA.",
    "research":     "Four research threads: predictive coding with memory, Langevin inference, spatial decoding from fMRI, and controllable diffusion.",
    "publications": "Five papers and preprints by Chi-Wei Lee across NeuroAI, generative modelling, and scientific machine learning.",
    "field":        "Field notes from the NSF HDR ML Challenge in Philadelphia and New York, and the iGEM Grand Jamboree in Paris.",
    "field-nsf":    "Twenty days, twenty iterations — leading a six-person team to second place in the NSF HDR ML Challenge Year 1 overall competition and presenting at AAAI-25 in Philadelphia.",
    "field-igem":   "Sixteen people, one gold medal — leading the Dry Lab team at the iGEM Grand Jamboree in Paris.",
    "record":       "Twelve research, field and award milestones from 2023 to 2026, grouped into a readable chronology.",
    "about":        "Chi-Wei Lee — NTHU Physics × EECS (AI Track) graduate, HMI Lab researcher, and UCLA visitor. Seeking NeuroAI PhD positions for 2027 entry.",
    "404":          "The requested page does not exist. Continue to one of the site's six sections.",
}


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


def img(src, alt, cls="", sizes="100vw", loading="lazy", position=""):
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
    style = f' style="object-position:{e(position)}"' if position else ""
    priority = ' fetchpriority="high"' if loading == "eager" else ""
    return (f'<img src="{e(src)}.webp"{srcset}{wh}{style}{priority} '
            f'alt="{e(alt_en)}" {attr_bi("alt", alt)} loading="{loading}" decoding="async" '
            f'class="{e(cls)}">')


def plate(photo, cls="", sizes="100vw", loading="lazy", lightbox=False):
    dim = webp_size(os.path.join(ROOT, photo["src"] + ".webp"))
    lb_dim = f' data-lb-width="{dim[0]}" data-lb-height="{dim[1]}"' if dim else ""
    lb = (f' data-lb="{e(photo["src"])}.webp"{lb_dim} {attr_bi("cap", photo["cap"])}'
          if lightbox else "")
    slug = f'<span class="slug">{e(photo.get("slug",""))}</span>' if photo.get("slug") else ""
    lqip = f' style="background-image:url({e(photo["src"])}.thumb.webp)"'
    position = f'{photo.get("fx", "50%")} {photo.get("fy", "50%")} '
    return (f'<figure class="plate {cls}"{lqip}{lb}>'
            f'{img(photo["src"], photo["cap"], sizes=sizes, loading=loading, position=position.strip())}'
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


ART_DIR = os.path.join(ROOT, "img", "art")

def art(name, alt, cls="chapter-art", sizes="(max-width:720px) 100vw, 1120px", loading="lazy"):
    """Responsive chapter art with its native panoramic ratio preserved."""
    path = os.path.join(ART_DIR, name + ".webp")
    if not os.path.exists(path):
        return ""
    return (f'<figure class="artwork {e(cls)}" data-art="{e(name)}">'
            f'{img("img/art/" + name, alt, cls="art-img", sizes=sizes, loading=loading)}'
            f'<span class="art-registration" aria-hidden="true"></span>'
            f'</figure>')


def cartouche(label_zh, seal="李"):
    """浮世繪 title cartouche: one vertical label block per page, with the
    seal below it — the way a print signs itself."""
    return (f'<aside class="cartouche" aria-hidden="true">'
            f'<span>{e(label_zh)}</span><b>{e(seal)}</b></aside>')


def opening(o):
    """The first sentence. The index hooks; the research page argues.

    Nothing on this site should be readable twice in full — a teaser
    that reproduces its own destination is not a teaser."""
    def cut(text, mark):
        i = text.find(mark)
        return text if i < 0 else text[:i + len(mark)].strip()
    return {"en": cut(o["en"], ". "), "zh": cut(o["zh"], "。")}


def status_class(status):
    return {"review": "p", "accepted": "s", "published": "s", "service": "i"}.get(status, "")


# ── page: index ─────────────────────────────────────────────────────
def p_index():
    o = []
    o.append(f'''
<div class="hero-stage">
  <div class="hero">
    {cartouche("推論之間")}
    <div class="band err">
      <span class="live">● <span class="en">NEUROAI</span><span class="zh">腦神經 × 機器學習</span></span>
      <span>·</span><span>{bi(M["location"])}</span>
      <span>·</span><span><span class="en">OPEN TO 2027 PHD</span><span class="zh">尋找 2027 博士班機會</span></span>
    </div>
    <h1 class="err"><span class="en">{e(M["name"]["en"])}</span><span class="zh">{e(M["name"]["zh"])}</span></h1>
    <p class="lede err">{bi(M["tagline"])}</p>
    <p class="sub err">{bi(M["role"])} · {bi(C["about"]["facts"][1]["v"])}</p>
    <div class="acts err">
      <a class="act p" href="research.html"><span class="en">Explore the research</span><span class="zh">閱讀研究</span></a>
      <a class="act" href="Chi-Wei_Lee_CV.pdf"><span class="en">CV (PDF)</span><span class="zh">履歷 PDF</span></a>
      <button class="act" type="button" data-act="mail" data-mail="{e(M["email"])}"><span class="en">Copy email</span><span class="zh">複製信箱</span></button>
    </div>
  </div>
  {art("home-ink", {"en": "Indigo ink flowing into cortical contours", "zh": "靛藍墨流化為皮層般的線條"}, cls="hero-art", loading="eager")}
</div>''')

    # threads
    units = []
    for i, t in enumerate(C["threads"]):
        units.append(f'''<article class="unit err">
  <div class="idx"><span class="n">{i+1:02d}</span>{bi(t["tag"])}</div>
  <h3>{bi(t["title"])}</h3>
  <p>{bi(opening(t["body"]))}</p>
  <a class="more" href="research.html#{e(t["id"])}"><span class="en">Open thread</span><span class="zh">展開</span></a>
</article>''')
    o.append(section("threads", "L2/3",
                     {"en": "Research directions", "zh": "研究方向"},
                     f'<div class="grid c2">{"".join(units)}</div>',
                     rail="THREADS"))

    # selected papers
    rows = []
    for p in C["publications"][:3]:
        rows.append(pub_row(p, note=False))
    o.append(section("papers", "L4",
                     {"en": "Selected papers", "zh": "選錄論文"},
                     f'<div class="ledger err">{"".join(rows)}</div>'
                     f'<div class="acts"><a class="act" href="publications.html">'
                     f'<span class="en">All five entries</span><span class="zh">全部五筆</span></a></div>',
                     rail="PAPERS"))

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
                     {"en": "Selected honours", "zh": "代表獎項"},
                     f'<div class="grid c2">{"".join(cards)}</div>'
                     f'<div class="acts"><a class="act" href="record.html#honours">'
                     f'<span class="en">Every honour</span><span class="zh">完整獎項</span></a></div>',
                     rail="HONOURS"))

    # field — a pointer, not a second gallery. The photographs belong to
    # `field` and to the essays; showing them a third time here would make
    # the same two trips the loudest thing on a page that is not about them.
    lr = C["longreads"]
    trips = []
    for key, href in (("nsf", "field-nsf.html"), ("igem", "field-igem.html")):
        t = lr[key]
        trips.append(f'''<a class="row err" href="{href}">
  <div class="yr">{e(t["date"])}</div>
  <div class="bd"><h3>{bi(t["title"])}</h3><p class="where">{e(t["place"])}</p></div>
  <div class="rt"><span class="chip i"><span class="en">FIELD NOTE</span><span class="zh">現場筆記</span></span></div>
</a>''')
    o.append(section("field", "L5b",
                     {"en": "Field notes", "zh": "現場筆記"},
                     f'<div class="ledger">{"".join(trips)}</div>'
                     f'<div class="acts err"><a class="act" href="field.html">'
                     f'<span class="en">The photographs</span><span class="zh">看照片</span></a></div>',
                     rail="FIELD"))

    # contact
    facts = "".join(
        f'<div class="row" style="grid-template-columns:180px minmax(0,1fr)">'
        f'<div class="yr">{bi(f["k"])}</div><div class="bd"><h3>{bi(f["v"])}</h3></div></div>'
        for f in C["about"]["facts"][2:])
    o.append(section("now", "L6",
                     {"en": "Now", "zh": "現在"},
                     f'<div class="ledger err">{facts}</div>'
                     f'<div class="acts">'
                     f'<button class="act p" type="button" data-act="mail" data-mail="{e(M["email"])}">'
                     f'<span class="en">Copy email</span><span class="zh">複製信箱</span></button>'
                     f'<a class="act" href="about.html"><span class="en">About</span><span class="zh">關於</span></a>'
                     f'</div>',
                     rail="NOW"))
    return "".join(o)


def pub_row(p, note=True):
    n = (p.get("note") or {}) if note else {}
    note = ""
    if n.get("en") or n.get("zh"):
        note = f'<p class="note">{bi(n)}</p>'
    link = ""
    if p.get("doi"):
        label = "arXiv" if "arxiv" in p["doi"] else "DOI"
        link = f'<a class="chip s" href="{e(p["doi"])}" rel="noopener">{label} ↗</a>'
    return f'''<article class="row" data-status="{e(p["status"])}">
  <div class="yr">{e(p["year"])}</div>
  <div class="bd">
    <h3 lang="en">{e(p["title"])}</h3>
    <p class="who" lang="en">{e(p["authors"])}</p>
    <p class="where" lang="en">{e(p["venue"])}</p>
    {note}
  </div>
  <div class="rt"><span class="chip {status_class(p["status"])}">{bi(p["badge"])}</span>{link}</div>
</article>'''


# ── page: research ──────────────────────────────────────────────────
def p_research():
    o = [f'''
<div class="masthead">
  {cartouche("研究")}
  <div class="band err"><span class="en">SECTION 02 · FOUR THREADS</span><span class="zh">第 02 節 · 四條線</span></div>
  <h1 class="err"><span class="en">RESEARCH</span><span class="zh">研究</span></h1>
  <p class="lede err"><span class="en">One programme across theory and neural data: memory as denoising, posterior sampling, fMRI decoding, and controllable generation.</span><span class="zh">一個橫跨理論與神經資料的研究計畫：記憶即去噪、後驗取樣、fMRI 解碼與可控生成。</span></p>
</div>
{art("research", {"en": "Four indigo currents meeting around a clear centre", "zh": "四股靛藍墨流在留白中心交會"})}''']

    ART_ALT = {
        "pc":        {"en": "Two currents of ink meeting", "zh": "兩股墨流相會"},
        "langevin":  {"en": "Ink circling a ring of wells", "zh": "墨繞著八個勢阱迴旋"},
        "fmri":      {"en": "Threads of ink pulled into a loose lattice", "zh": "墨絲被拉成疏鬆的網格"},
        "diffusion": {"en": "Ink drifting from crisp to diffuse", "zh": "墨由清晰漂向瀰散"},
    }
    cards = []
    for i, t in enumerate(C["threads"]):
        cards.append(f'''<article class="unit thread-card err" id="{e(t["id"])}">
  <div class="plate">{img("img/art/thread-" + t["id"], ART_ALT[t["id"]], sizes="(max-width:900px) 100vw, 50vw")}</div>
  <div class="tc-body">
    <div class="idx"><span class="n">{i+1:02d}</span>{bi(t["tag"])}</div>
    <h3>{bi(t["title"])}</h3>
    <p>{bi(t["body"])}</p>
  </div>
</article>''')
    o.append(section("threads", "L2/3",
                     {"en": "Four threads", "zh": "四條線"},
                     f'<div class="grid c2 thread-deck">{"".join(cards)}</div>',
                     rail="THREADS"))

    o.append(section("papers-link", "L6",
                     {"en": "Where the threads are written down", "zh": "這些線寫在哪裡"},
                     '<p class="err" style="max-width:62ch;color:var(--ink-dim)">'
                     '<span class="en">The predictive-coding and Langevin projects are co-first-author manuscripts under review. MatrixQR was accepted as a TAAI 2025 poster. The fMRI decoding project is ongoing.</span>'
                     '<span class="zh">預測編碼與 Langevin 專案為共同第一作者、審查中的手稿；MatrixQR 已接受為 TAAI 2025 海報；fMRI 解碼專案仍在進行。</span></p>'
                     '<div class="acts err"><a class="act p" href="publications.html">'
                     '<span class="en">The papers</span><span class="zh">論文列表</span></a></div>',
                     rail="PAPERS"))
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
<p class="err publication-note">
  <span class="en">Two manuscripts are in anonymous review; full author lists and target venues remain withheld until disclosure is permitted.</span>
  <span class="zh">兩篇手稿正處於匿名審查；完整作者名單與投稿場域將於允許揭露後補上。</span>
</p>'''
    return f'''
<div class="masthead">
  {cartouche("論文")}
  <div class="band err"><span class="en">SECTION 03 · RESEARCH OUTPUTS</span><span class="zh">第 03 節 · 研究成果</span></div>
  <h1 class="err"><span class="en">PAPERS</span><span class="zh">論文</span></h1>
  <p class="lede err"><span class="en">Five research outputs across predictive coding, Bayesian sampling, controllable generation, scientific imaging, and anomaly-detection benchmarks.</span><span class="zh">五項研究成果，涵蓋預測編碼、貝氏取樣、可控生成、科學影像與異常偵測基準。</span></p>
</div>
{art("papers", {"en": "Five quiet layers of indigo pigment settling on paper", "zh": "五層靛藍顏料沉積於紙上"})}
{section("list", "L4", {"en": "Entries", "zh": "條目"}, body, rail="PAPERS")}'''


# ── page: field ─────────────────────────────────────────────────────
def p_field():
    lr = C["longreads"]
    trip_meta = {
        "nsf": {
            "en": "Six-person team · Team lead · 2nd overall",
            "zh": "六人團隊 · 隊長 · 總排名第二",
        },
        "igem": {
            "en": "16-person team · Dry Lab lead · Gold Medal",
            "zh": "十六人團隊 · Dry Lab 組長 · 金牌",
        },
    }
    cards = []
    for key, href in (("nsf", "field-nsf.html"), ("igem", "field-igem.html")):
        t = lr[key]
        hero = next((p for p in t["photos"] if p.get("role") == "hero"), t["photos"][0])
        cards.append(f'''<a class="unit err" href="{href}" style="padding:0;display:block">
  <div class="plate wide">{img(hero["src"], hero["cap"], sizes="(max-width:900px) 100vw, 50vw", loading="eager")}<span class="iris" aria-hidden="true"></span></div>
  <div style="padding:var(--s5)">
    <div class="idx"><span class="n">{e(t["date"])}</span>{e(t["place"])}</div>
    <h3>{bi(t["title"])}</h3>
    <p>{bi(trip_meta[key])}</p>
    <span class="more"><span class="en">Read it</span><span class="zh">讀下去</span></span>
  </div>
</a>''')

    # the two frames already enlarged as trip cards are not repeated here
    shown = {next((ph for ph in lr[k]["photos"] if ph.get("role") == "hero"),
                  lr[k]["photos"][0])["src"] for k in ("nsf", "igem")}
    sheet = []
    for key in ("nsf", "igem"):
        for ph in lr[key]["photos"]:
            if ph["src"] in shown:
                continue
            sheet.append(plate(ph, sizes="(max-width:640px) 50vw, 200px", lightbox=True))
    return f'''
<div class="masthead">
  {cartouche("現場")}
  <div class="band err"><span class="en">SECTION 04 · AWAY FROM THE DESK</span><span class="zh">第 04 節 · 離開桌前</span></div>
  <h1 class="err"><span class="en">FIELD</span><span class="zh">現場</span></h1>
  <p class="lede err"><span class="en">Two teams, two international stages, and the work behind the result: the NSF HDR ML Challenge and iGEM.</span><span class="zh">兩個團隊、兩個國際舞台，以及成果背後的工作：NSF HDR ML Challenge 與 iGEM。</span></p>
</div>
{art("field", {"en": "Two indigo paths crossing an imagined coastline", "zh": "兩條靛藍旅路跨過想像的海岸"})}
{section("trips", "L5a", {"en": "Two journeys", "zh": "兩段現場"}, f'<div class="grid c2">{"".join(cards)}</div>', rail="TRIPS")}
{section("sheet", "L5b", {"en": "Contact sheet", "zh": "印樣"},
         f'<div class="strip err">{"".join(sheet)}</div>'
         f'<p class="err" style="margin-top:var(--s4);font-family:var(--f-mono);font-size:var(--t-2xs);'
         f'letter-spacing:.13em;text-transform:uppercase;color:var(--muted)">'
         f'<span class="en">{len(sheet):02d} REMAINING FRAMES · CLICK TO ENLARGE · ← → TO STEP</span>'
         f'<span class="zh">其餘 {len(sheet):02d} 張 · 點擊放大 · ← → 切換</span></p>', rail="SHEET")}'''


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
                out.append(plate(ph, cls=f"essay-plate {cls2}".strip(), sizes="(max-width:900px) 100vw, 720px"))
        return "".join(out)

    other = "field-igem.html" if key == "nsf" else "field-nsf.html"
    other_t = C["longreads"]["igem" if key == "nsf" else "nsf"]

    return f'''
<div class="masthead essay-masthead">
  {cartouche(t["title"]["zh"][:6])}
  <div class="band err">{e(t["place"])} · {e(t["date"])}</div>
  <h1 class="err"><span class="en">{e(t["title"]["en"])}</span><span class="zh">{e(t["title"]["zh"])}</span></h1>
</div>
<div class="essay-hero" style="margin-bottom:var(--s7)">{plate(hero, cls="wide", sizes="100vw", loading="eager")}</div>
<article class="sec settle reading" id="essay" data-rail="ESSAY">
  <div class="prose err">
    <div class="en">{flow("en")}</div>
    <div class="zh">{flow("zh")}</div>
  </div>
</article>
<nav class="pager">
  <a href="field.html"><span><span class="en">← BACK</span><span class="zh">← 返回</span></span>
    <b><span class="en">Field</span><span class="zh">現場</span></b></a>
  <a class="nx" href="{other}"><span><span class="en">THE OTHER TRIP →</span><span class="zh">另一趟 →</span></span>
    <b>{e(other_t["place"])}</b></a>
</nav>'''


# ── page: record ────────────────────────────────────────────────────
def p_record():
    """The complete record, grouped by year, with honours in full."""
    lr = C["longreads"]

    kind_labels = {
        "paper": {"en": "Paper", "zh": "論文"},
        "field": {"en": "Field", "zh": "現場"},
        "award": {"en": "Award", "zh": "獎項"},
    }

    def chron_event(kind, href, title, detail):
        title_html = (f'<span class="en" lang="en">{e(title)}</span>'
                      f'<span class="zh" lang="en">{e(title)}</span>') if isinstance(title, str) else bi(title)
        detail_html = (f'<span class="en" lang="en">{e(detail)}</span>'
                       f'<span class="zh" lang="en">{e(detail)}</span>') if isinstance(detail, str) else bi(detail)
        return f'''<li>
  <a class="chron-event chron-event--{kind}" href="{e(href)}" data-kind="{kind}">
    <span class="chron-kind">{bi(kind_labels[kind])}</span>
    <h4 class="chron-title">{title_html}</h4>
    <p class="chron-detail">{detail_html}</p>
  </a>
</li>'''

    chronology = {year: [] for year in range(2023, 2027)}
    for pub in sorted(C["publications"], key=lambda p: (int(p["year"]), p["title"])):
        chronology[int(pub["year"])].append(
            chron_event("paper", "publications.html", pub["title"], pub["venue"])
        )
    for key, href in (("nsf", "field-nsf.html"), ("igem", "field-igem.html")):
        t = lr[key]
        chronology[int(t["date"][:4])].append(
            chron_event("field", href, t["title"],
                        {"en": f'{t["date"]} · {t["place"]}',
                         "zh": f'{t["date"]} · {t["place"]}'})
        )
    for award in sorted(C["awards"], key=lambda a: (int(a["year"]), a["title"]["en"])):
        chronology[int(award["year"])].append(
            chron_event("award", "#honours", award["title"], award["org"])
        )

    chron_years = "".join(f'''<li class="chron-year" data-year="{year}" data-count="{len(chronology[year])}">
  <header class="chron-year-head">
    <h3 class="chron-year-title">{year}</h3>
    <span class="chron-count"><span class="en">{len(chronology[year])} {'entry' if len(chronology[year]) == 1 else 'entries'}</span><span class="zh">{len(chronology[year])} 筆</span></span>
  </header>
  <ol class="chron-events">{"".join(chronology[year])}</ol>
</li>''' for year in range(2023, 2027))
    chron = f'<ol class="chronology err">{chron_years}</ol>'

    def honour_actions(a):
        actions = []
        if a.get("hero"):
            actions.append('<span class="chip p"><span class="dot"></span><span class="en">FEATURED</span><span class="zh">精選</span></span>')
        if a.get("url"):
            actions.append(f'<a class="chip s" href="{e(a["url"])}" rel="noopener"><span class="en">OFFICIAL ↗</span><span class="zh">官方紀錄 ↗</span></a>')
        return "".join(actions)

    honours = "".join(f'''<article class="row">
  <div class="yr">{e(a["year"])}</div>
  <div class="bd"><h3>{bi(a["title"])}</h3><p class="where">{bi(a["org"])}</p><p class="note">{bi(a["note"])}</p></div>
  <div class="rt">{honour_actions(a)}</div>
</article>''' for a in sorted(C["awards"], key=lambda x: -int(x["year"])))

    field = "".join(f'''<a class="row" href="{href}">
  <div class="yr">{e(lr[k]["date"])}</div>
  <div class="bd"><h3>{e(lr[k]["place"])}</h3><p class="where"><span class="en">Field notes</span><span class="zh">現場筆記</span></p></div>
  <div class="rt"><span class="chip i"><span class="en">ESSAY</span><span class="zh">長文</span></span></div>
</a>''' for k, href in (("nsf", "field-nsf.html"), ("igem", "field-igem.html")))

    n_aw, n_pa, n_tr = len(C["awards"]), len(C["publications"]), 2

    return f'''<div class="masthead">
  {cartouche("紀錄")}
  <div class="band err"><span class="en">SECTION 05 · THE RECORD</span><span class="zh">第 05 節 · 紀錄</span></div>
  <h1 class="err"><span class="en">RECORD</span><span class="zh">紀錄</span></h1>
  <p class="lede err"><span class="en">{n_aw + n_pa + n_tr} entries · 2023–2026 · {n_pa} papers · {n_aw} honours · {n_tr} field notes.</span><span class="zh">{n_aw + n_pa + n_tr} 筆紀錄 · 2023–2026 · {n_pa} 篇論文 · {n_aw} 項獎項 · {n_tr} 篇現場筆記。</span></p>
</div>
{art("record", {"en": "A four-terrace indigo river carrying twelve milestones", "zh": "承載十二個里程碑的四段靛藍河階"})}
{section("chronology", "L4", {"en": "Chronology", "zh": "年表"}, chron, rail="CHRONOLOGY")}
{section("honours", "L5a", {"en": "Honours", "zh": "獎項"},
         f'<div class="ledger err">{honours}</div>', rail="HONOURS")}
{section("field", "L5b", {"en": "Field work", "zh": "現場"},
         f'<div class="ledger err">{field}</div>'
         f'<p class="err" style="margin-top:var(--s5);font-family:var(--f-mono);font-size:var(--t-2xs);'
         f'letter-spacing:.13em;text-transform:uppercase;color:var(--muted)">'
         f'<span class="en">{n_aw + n_pa + n_tr:02d} ENTRIES · {n_aw:02d} AWARDS · {n_pa:02d} PAPERS · {n_tr:02d} FIELD</span>'
         f'<span class="zh">{n_aw + n_pa + n_tr:02d} 筆紀錄 · 獎項 {n_aw:02d} · 論文 {n_pa:02d} · 現場 {n_tr:02d}</span></p>',
         rail="FIELD")}'''


# ── page: about ─────────────────────────────────────────────────────
def p_about():
    facts = "".join(f'''<article class="row" style="grid-template-columns:200px minmax(0,1fr)">
  <div class="yr">{bi(f["k"])}</div><div class="bd"><h3>{bi(f["v"])}</h3></div></article>''' for f in C["about"]["facts"])

    port = C["portrait"]
    bio_en = "".join(f"<p>{e(p)}</p>" for p in C["about"]["body"]["en"]) if isinstance(C["about"]["body"]["en"], list) else f'<p>{e(C["about"]["body"]["en"])}</p>'
    bio_zh = "".join(f"<p>{e(p)}</p>" for p in C["about"]["body"]["zh"]) if isinstance(C["about"]["body"]["zh"], list) else f'<p>{e(C["about"]["body"]["zh"])}</p>'

    return f'''
<div class="masthead">
  {cartouche("關於")}
  <div class="band err"><span class="en">SECTION 06 · PROFILE</span><span class="zh">第 06 節 · 個人簡介</span></div>
  <h1 class="err"><span class="en">ABOUT</span><span class="zh">關於</span></h1>
  <p class="lede err">{bi(C["about"]["lead"])}</p>
</div>
{section("bio", "L2/3", {"en": "In my own words", "zh": "關於我"},
         f'''<div class="grid c2" style="background:transparent;border:0;gap:var(--s6)">
  <div class="reading err"><div class="prose"><div class="en">{bio_en}</div><div class="zh">{bio_zh}</div></div></div>
  <div class="err">{plate(port, cls="tall", sizes="(max-width:900px) 100vw, 420px", loading="eager")}</div>
</div>''', rail="BIO")}
{section("facts", "L4", {"en": "Profile", "zh": "簡歷"},
         f'<div class="ledger err">{facts}</div>'
         f'<div class="acts"><a class="act" href="record.html#honours">'
         f'<span class="en">Honours and chronology</span><span class="zh">獎項與年表</span></a></div>', rail="FACTS")}
{section("contact", "L6", {"en": "Contact", "zh": "聯絡方式"},
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
        f'<a class="card err" href="{pid}.html"><div class="idx"><span class="n">CH.{ch}</span></div>'
        f'<h3>{bi(lab)}</h3></a>' for pid, lab, ch in PAGES)
    return f'''
<div class="masthead">
  {cartouche("迷途")}
  <div class="band err"><span class="en">404 · PAGE NOT FOUND</span><span class="zh">404 · 找不到頁面</span></div>
  <h1 class="err"><span class="en">WRONG TURN</span><span class="zh">走錯路了</span></h1>
  <p class="lede err"><span class="en">This address does not exist. Continue from one of the six sections below.</span><span class="zh">這個網址不存在。請從下方六個章節繼續瀏覽。</span></p>
</div>
{section("continue", "L1", {"en": "Continue", "zh": "繼續瀏覽"}, f'<div class="grid c3" style="background:transparent;border:0;gap:var(--s3)">{links}</div>', rail="CONTINUE")}'''


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


def asset_hash(rel):
    """Short content hash, so a changed asset gets a changed URL.

    GitHub Pages serves everything with max-age=600 and no versioning;
    without this, every visitor who has been here before sees up to ten
    minutes of the previous design stitched onto the new HTML."""
    import hashlib
    try:
        with open(os.path.join(ROOT, rel), "rb") as fh:
            return hashlib.md5(fh.read()).hexdigest()[:8]
    except OSError:
        return "0"


VERSIONED = [
    "assets/site.css",
    "assets/runtime.js",
    "assets/substrate.js",
    "assets/fonts/MartianMono-normal-100-800-latin.woff2",
    "assets/fonts/InstrumentSans-normal-400-700-latin.woff2",
]


def stamp(page):
    for rel in VERSIONED:
        page = page.replace(f'"{rel}"', f'"{rel}?v={asset_hash(rel)}"')
    return page


def build(live):
    written = []
    for pid in list(RENDER):
        page = SHELL
        page = page.replace("{{title}}", e(TITLES[pid]))
        page = page.replace("{{description}}", e(DESCS[pid]))
        page = page.replace("{{canonical}}", SITE + ("" if pid == "index" else pid + ".html"))
        page = page.replace("{{nav}}", nav_html(pid))
        page = page.replace("{{drawer}}", drawer_html(pid))
        page = page.replace("{{jsonld}}", jsonld(pid))
        page = page.replace("{{main}}", RENDER[pid]())
        page = stamp(page)
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
