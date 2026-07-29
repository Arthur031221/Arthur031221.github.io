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


ART_DIR = os.path.join(ROOT, "img", "art")

def art(name, alt, cls="wide", sizes="100vw", loading="lazy"):
    """A full-bleed artwork slot. Emits nothing until img/art/<name>.webp
    exists — generate the pieces (see CODEX_ART_BRIEF.md), rebuild, and
    the page makes room for them."""
    path = os.path.join(ART_DIR, name + ".webp")
    if not os.path.exists(path):
        return ""
    dim = webp_size(path)
    wh = f' width="{dim[0]}" height="{dim[1]}"' if dim else ""
    return (f'<figure class="plate artwork {cls} err">'
            f'<img src="img/art/{e(name)}.webp"{wh} alt="{e(alt.get("en", ""))}" '
            f'{attr_bi("alt", alt)} loading="{loading}" decoding="async">'
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
<div class="hero">
  {cartouche("預測誤差")}
  <div class="band err">
    <span class="live">● <span class="en">RECORDING</span><span class="zh">錄製中</span></span>
    <span>·</span><span>{bi(M["location"])}</span>
    <span>·</span><span><span class="en">SINGLE UNIT · PE//1</span><span class="zh">單一單元 · PE//1</span></span>
  </div>
  <h1 class="err"><span class="en" data-pe>{e(M["name"]["en"])}</span><span class="zh">{e(M["name"]["zh"])}</span></h1>
  <p class="lede err">{bi(M["tagline"])}</p>
  <p class="sub err">{bi(M["role"])} · {bi(C["about"]["facts"][0]["v"])}</p>
  <div class="acts err">
    <a class="act p" href="research.html"><span class="en">Read the research</span><span class="zh">閱讀研究</span></a>
    <a class="act" href="Chi-Wei_Lee_CV.pdf"><span class="en">CV (PDF)</span><span class="zh">履歷 PDF</span></a>
    <button class="act" type="button" data-act="mail" data-mail="{e(M["email"])}"><span class="en">Copy email</span><span class="zh">複製信箱</span></button>
  </div>
</div>''')

    o.append(art("home-ink", {"en": "Ink dispersing in water", "zh": "墨在水中暈開"}, loading="eager"))

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
                     {"en": "Four threads, one question", "zh": "四條線，一個問題"},
                     f'<div class="grid c2">{"".join(units)}</div>',
                     rail="THREADS",
                     note={"en": "what memory does for inference", "zh": "記憶為推論做了什麼"}))

    # selected papers
    rows = []
    for p in C["publications"][:3]:
        rows.append(pub_row(p, note=False))
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

    # field — a pointer, not a second gallery. The photographs belong to
    # `field` and to the essays; showing them a third time here would make
    # the same two trips the loudest thing on a page that is not about them.
    lr = C["longreads"]
    trips = []
    for key, href in (("nsf", "field-nsf.html"), ("igem", "field-igem.html")):
        t = lr[key]
        trips.append(f'''<a class="row err" href="{href}">
  <div class="yr">{e(t["date"])}</div>
  <div class="bd"><h3>{e(t["place"])}</h3></div>
  <div class="rt"><span class="chip i"><span class="en">READ THE ESSAY</span><span class="zh">讀長文</span></span></div>
</a>''')
    o.append(section("field", "L5b",
                     {"en": "Two trips, told in full", "zh": "兩趟旅程，完整說完"},
                     f'<div class="ledger">{"".join(trips)}</div>'
                     f'<div class="acts err"><a class="act" href="field.html">'
                     f'<span class="en">The photographs</span><span class="zh">看照片</span></a></div>',
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
    <h3>{e(p["title"])}</h3>
    <p class="who">{e(p["authors"])}</p>
    <p class="where">{e(p["venue"])}</p>
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
  <p class="lede err"><span class="en">Four threads, one question — what a posterior should carry, and what memory has to do with carrying it.</span><span class="zh">四條研究線，一個問題——後驗應該承載什麼，而記憶與這件事有什麼關係。</span></p>
</div>
{art("research", {"en": "Ink artwork", "zh": "墨圖"})}''']

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
                     '<span class="en">The first two threads are the two co-first-author manuscripts under '
                     'review; the fourth is MatrixQR at TAAI 2025. The spatial-decoding thread has no paper '
                     'yet because the work is still running — that gap is real, and it is the next thing.</span>'
                     '<span class="zh">前兩條線就是兩篇共同第一作者、審查中的手稿；第四條是 TAAI 2025 的 MatrixQR。'
                     '空間解碼那條線目前沒有論文，因為工作仍在進行——這個缺口是真實的，也是下一步。</span></p>'
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
<p class="err" style="margin-top:var(--s5);max-width:62ch;color:var(--muted);font-size:var(--t-sm)">
  <span class="en">Two entries are under anonymous review, so the author list and the venue stay unnamed until the process permits disclosure. Nothing here is stated at a status it has not reached.</span>
  <span class="zh">其中兩筆正在匿名審查，因此在流程允許揭露之前，作者名單與發表場域維持不具名。此處沒有任何一筆被寫成它尚未達到的狀態。</span>
</p>'''
    return f'''
<div class="masthead">
  {cartouche("論文")}
  <div class="band err"><span class="en">SECTION 03 · THE RECORD</span><span class="zh">第 03 節 · 紀錄</span></div>
  <h1 class="err"><span class="en">PAPERS</span><span class="zh">論文</span></h1>
  <p class="lede err"><span class="en">Five entries. Two are co-first-author manuscripts under review, one is an accepted TAAI poster, one is published, and one is a 150-author community benchmark I contributed to.</span><span class="zh">五筆。其中兩篇是共同第一作者、審查中的手稿，一篇是已接受的 TAAI 海報，一篇已發表，另一篇是我參與的 150 人社群基準論文。</span></p>
</div>
{art("papers", {"en": "Ink artwork", "zh": "墨圖"})}
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

    # the two frames already enlarged as trip cards are not repeated here
    shown = {next((ph for ph in lr[k]["photos"] if ph.get("role") == "hero"),
                  lr[k]["photos"][0])["src"] for k in ("nsf", "igem")}
    sheet = []
    for key in ("nsf", "igem"):
        for ph in lr[key]["photos"]:
            if ph["src"] in shown:
                continue
            sheet.append(plate(ph, sizes="(max-width:640px) 50vw, 200px", lightbox=True))
    sheet.append(plate(C["slider"], sizes="(max-width:640px) 50vw, 200px", lightbox=True))

    return f'''
<div class="masthead">
  {cartouche("現場")}
  <div class="band err"><span class="en">SECTION 04 · AWAY FROM THE DESK</span><span class="zh">第 04 節 · 離開桌前</span></div>
  <h1 class="err"><span class="en">FIELD</span><span class="zh">現場</span></h1>
  <p class="lede err"><span class="en">Two trips that changed what I work on, written out in full rather than summarised into a line on a CV.</span><span class="zh">兩趟改變了我研究方向的旅程，完整寫出來，而不是壓縮成履歷上的一行。</span></p>
</div>
{art("field", {"en": "Ink artwork", "zh": "墨圖"})}
{section("trips", "L5a", {"en": "The two of them", "zh": "這兩趟"}, f'<div class="grid c2">{"".join(cards)}</div>', rail="TRIPS")}
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
                out.append(f'<figure style="margin:var(--s7) 0">{plate(ph, cls=cls2, sizes="(max-width:900px) 100vw, 720px")}</figure>')
        return "".join(out)

    other = "field-igem.html" if key == "nsf" else "field-nsf.html"
    other_t = C["longreads"]["igem" if key == "nsf" else "nsf"]

    return f'''
<div class="masthead">
  {cartouche(t["title"]["zh"][:6])}
  <div class="band err">{e(t["place"])} · {e(t["date"])}</div>
  <h1 class="err"><span class="en">{e(t["title"]["en"])}</span><span class="zh">{e(t["title"]["zh"])}</span></h1>
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
  <a class="nx" href="{other}"><span><span class="en">THE OTHER TRIP →</span><span class="zh">另一趟 →</span></span>
    <b>{e(other_t["place"])}</b></a>
</nav>'''


# ── page: record ────────────────────────────────────────────────────
def p_record():
    """The complete dated record, and the only place the honours are set
    out in full.

    Each page here has exactly one job. `about` says who he is, `papers`
    lists the papers, the essays tell the trips — and this page holds the
    record itself: every honour with its citation, the field work, and all
    of it plotted on one axis. Nothing that is written out on another page
    is written out again here, which is why the papers appear as ticks
    above the axis and not as a second list."""
    lr = C["longreads"]

    AWARD_SHORT = {
        "Mei Yi-Chi Memorial Medal":        {"en": "Mei Yi-Chi Medal", "zh": "梅貽琦獎章"},
        "2nd worldwide — NSF HDR ML Challenge": {"en": "NSF HDR · 2nd", "zh": "NSF HDR · 第二"},
        "3rd worldwide — NSF HDR ML Challenge": {"en": "NSF HDR · 3rd", "zh": "NSF HDR · 第三"},
        "1st place — Mei-Chu Hackathon":    {"en": "Mei-Chu · 1st", "zh": "梅竹 · 冠軍"},
        "Gold Medal — iGEM":                {"en": "iGEM · Gold", "zh": "iGEM · 金牌"},
    }
    def venue_short(v):
        if "Preprint" in v: return {"en": "Under review", "zh": "審查中"}
        if "TAAI" in v: return {"en": "TAAI 2025", "zh": "TAAI 2025"}
        if "Modern Physics" in v: return {"en": "JMP 15(12)", "zh": "JMP 15(12)"}
        if "arXiv" in v: return {"en": "arXiv 2503", "zh": "arXiv 2503"}
        return {"en": v[:14], "zh": v[:14]}
    events = []
    for a in C["awards"]:
        events.append({"year": int(a["year"]), "kind": "award", "label": a["title"],
                       "short": AWARD_SHORT.get(a["title"]["en"], a["title"])})
    for pub in C["publications"]:
        # the axis needs the date and the kind; the title is set on `papers`
        # and on the front page, and this would be the third printing
        events.append({"year": int(pub["year"]), "kind": "paper",
                       "label": {"en": "Paper · " + pub["venue"], "zh": "論文 · " + pub["venue"]},
                       "short": venue_short(pub["venue"])})
    for key in ("nsf", "igem"):
        t = lr[key]
        events.append({"year": int(t["date"][:4]), "kind": "trip",
                       "label": {"en": t["place"], "zh": t["place"]},
                       "short": {"en": "Philadelphia" if key == "nsf" else "Paris",
                                 "zh": "費城" if key == "nsf" else "巴黎"}})
    raster = ('<script type="application/json" id="fig-career">'
              + json.dumps(events, ensure_ascii=False) + "</script>")

    honours = "".join(f'''<article class="row">
  <div class="yr">{e(a["year"])}</div>
  <div class="bd"><h3>{bi(a["title"])}</h3><p class="where">{bi(a["org"])}</p><p class="note">{bi(a["note"])}</p></div>
  <div class="rt">{'<span class="chip p"><span class="dot"></span><span class="en">HERO</span><span class="zh">代表</span></span>' if a.get("hero") else ''}</div>
</article>''' for a in sorted(C["awards"], key=lambda x: -int(x["year"])))

    field = "".join(f'''<a class="row" href="{href}">
  <div class="yr">{e(lr[k]["date"])}</div>
  <div class="bd"><h3>{e(lr[k]["place"])}</h3><p class="where"><span class="en">Field notes</span><span class="zh">現場筆記</span></p></div>
  <div class="rt"><span class="chip i"><span class="en">ESSAY</span><span class="zh">長文</span></span></div>
</a>''' for k, href in (("nsf", "field-nsf.html"), ("igem", "field-igem.html")))

    n_aw, n_pa, n_tr = len(C["awards"]), len(C["publications"]), 2

    return f'''{raster}
<div class="masthead">
  {cartouche("紀錄")}
  <div class="band err"><span class="en">SECTION 05 · THE RECORD</span><span class="zh">第 05 節 · 紀錄</span></div>
  <h1 class="err"><span class="en">RECORD</span><span class="zh">紀錄</span></h1>
  <p class="lede err"><span class="en">Every honour with its citation, the field work, and all of it on one axis. The papers are plotted here but written out on <a href="publications.html">papers</a> — nothing on this site is set out twice.</span><span class="zh">每一項獎項連同事由、現場工作，以及把這一切放上同一條軸。論文在這裡以刻度呈現，內容則寫在<a href="publications.html">論文</a>頁——這個網站不把同一件事寫兩次。</span></p>
</div>
{art("record", {"en": "Ink artwork", "zh": "墨圖"})}
{section("raster", "L4", {"en": "The whole record as a spike train", "zh": "把整份紀錄畫成尖峰序列"},
         '<div class="fig err" data-fig="career"><div class="fh">'
         '<span class="t"><span class="en">Papers above the axis, awards below, field on it</span>'
         '<span class="zh">論文在軸上方，獎項在下方，現場在軸上</span></span>'
         '<span class="out" data-out>—</span></div><canvas></canvas>'
         '<div class="fc"><span class="en">One tick per dated event. Nothing is interpolated and nothing is smoothed. '
         'Four years is a short axis, and it is drawn short rather than stretched.</span>'
         '<span class="zh">每個有日期的事件各一刻度。沒有內插、沒有平滑。四年是一條短軸，就照短的畫，不拉長。</span></div></div>',
         rail="RASTER")}
{section("honours", "L5a", {"en": "Honours", "zh": "獎項"},
         f'<div class="ledger err">{honours}</div>', rail="HONOURS")}
{section("field", "L5b", {"en": "Field work", "zh": "現場"},
         f'<div class="ledger err">{field}</div>'
         f'<p class="err" style="margin-top:var(--s5);font-family:var(--f-mono);font-size:var(--t-2xs);'
         f'letter-spacing:.13em;text-transform:uppercase;color:var(--muted)">'
         f'<span class="en">{n_aw + n_pa + n_tr:02d} DATED EVENTS · {n_aw:02d} AWARDS · {n_pa:02d} PAPERS · {n_tr:02d} FIELD</span>'
         f'<span class="zh">{n_aw + n_pa + n_tr:02d} 筆有日期的事件 · 獎項 {n_aw:02d} · 論文 {n_pa:02d} · 現場 {n_tr:02d}</span></p>',
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
  <div class="band err"><span class="en">SECTION 06 · WHO IS RECORDING</span><span class="zh">第 06 節 · 誰在記錄</span></div>
  <h1 class="err"><span class="en">ABOUT</span><span class="zh">關於</span></h1>
  <p class="lede err">{bi(C["about"]["lead"])}</p>
</div>
{section("bio", "L2/3", {"en": "In his own words", "zh": "他自己的說法"},
         f'''<div class="grid c2" style="background:transparent;border:0;gap:var(--s6)">
  <div class="reading err"><div class="prose"><div class="en">{bio_en}</div><div class="zh">{bio_zh}</div></div></div>
  <div class="err">{plate(port, cls="tall", sizes="(max-width:900px) 100vw, 420px", loading="eager")}</div>
</div>''', rail="BIO")}
{section("facts", "L4", {"en": "The short version", "zh": "簡短版本"}, f'<div class="ledger err">{facts}</div>', rail="FACTS")}
{section("awards", "L5a", {"en": "Honours", "zh": "獎項"},
         f'<p class="err" style="max-width:60ch;color:var(--ink-dim)">'
         f'<span class="en">Five, between 2023 and 2026, each with what it was actually for. '
         f'They are set out in full on the record, alongside the axis they sit on.</span>'
         f'<span class="zh">五項，介於 2023 至 2026 年之間，每一項都附上實際的事由。'
         f'完整內容寫在紀錄頁，與它們所在的那條軸放在一起。</span></p>'
         f'<div class="acts"><a class="act p" href="record.html#honours">'
         f'<span class="en">The honours in full</span><span class="zh">完整獎項</span></a></div>', rail="HONOURS")}
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
  {cartouche("迷途")}
  <div class="band err"><span class="en">ERROR · UNRESOLVED RESIDUAL</span><span class="zh">錯誤 · 未解殘差</span></div>
  <h1 class="err"><span class="en">SIGNAL LOST</span><span class="zh">訊號中斷</span></h1>
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
    "assets/instruments.js",
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
        page = page.replace("{{depth}}", depth_html())
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
