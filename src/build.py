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
    "index":        "Chi-Wei Lee — NeuroAI and computer vision researcher working across neuroscience, predictive coding, Bayesian inference, and 3D reconstruction from neural data.",
    "research":     "Research across neuroscience and computer vision: predictive coding with memory, Langevin inference, 3D reconstruction from fMRI, and controllable diffusion.",
    "publications": "Five papers and preprints by Chi-Wei Lee across NeuroAI, generative modelling, and scientific machine learning.",
    "field":        "Field notes from the NSF HDR ML Challenge in Philadelphia and New York, and the iGEM Grand Jamboree in Paris.",
    "field-nsf":    "Twenty days, twenty iterations — leading a six-person team to second place in the NSF HDR ML Challenge Year 1 overall competition and presenting at AAAI-25 in Philadelphia.",
    "field-igem":   "Sixteen people, one gold medal — leading the Dry Lab team at the iGEM Grand Jamboree in Paris.",
    "record":       "A documented register of Chi-Wei Lee's academic work, research roles, grants, honours, papers and field milestones from 2022 to 2026.",
    "about":        "Chi-Wei Lee — NeuroAI and computer vision researcher working on neuroscience, generative modelling, and 3D reconstruction from fMRI; currently visiting UCLA.",
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


def plate(photo, cls="", sizes="100vw", loading="lazy", lightbox=False, group="page"):
    dim = webp_size(os.path.join(ROOT, photo["src"] + ".webp"))
    lb_dim = f' data-lb-width="{dim[0]}" data-lb-height="{dim[1]}"' if dim else ""
    lb = (f' data-lb="{e(photo["src"])}.webp" data-lb-group="{e(group)}"{lb_dim} {attr_bi("cap", photo["cap"])}'
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


def medium(key):
    """Resolve one centrally described photograph or documentary image."""
    return C["media"][key] if isinstance(key, str) else key


def memory_frame(key, cls="", sizes="100vw", loading="lazy", lightbox=False,
                 group="moments", href=None, index=""):
    """An event frame: photography carries the memory; metadata carries truth.

    Natural photographs remain natural. Only explicitly marked atmosphere frames
    receive the aizuri edge treatment, and documentary evidence is never cropped.
    """
    photo = medium(key)
    src = photo["src"]
    dim = webp_size(os.path.join(ROOT, src + ".webp"))
    wh = f' data-lb-width="{dim[0]}" data-lb-height="{dim[1]}"' if dim else ""
    ratio = f' style="--media-ratio:{dim[0]} / {dim[1]}"' if dim else ""
    lb = (f' data-lb="{e(src)}.webp" data-lb-group="{e(group)}"{wh} '
          f'{attr_bi("cap", photo["cap"])}' if lightbox else "")
    treatment = photo.get("treatment", "natural")
    event = photo.get("event", "")
    slug = f'<span class="memory-slug">{e(photo["slug"])}</span>' if photo.get("slug") else ""
    label = photo.get("label") or {
        "en": "Event photograph" if photo.get("kind") not in ("life", "portrait") else "Field frame",
        "zh": "現場影像" if photo.get("kind") not in ("life", "portrait") else "生活片段",
    }
    no = f'<span class="memory-no">{e(index)}</span>' if index else ""
    pos = f'{photo.get("fx", "50%")} {photo.get("fy", "50%")} '
    fig = (f'<figure class="memory-frame {e(cls)}" data-treatment="{e(treatment)}" '
           f'data-event="{e(event)}"{ratio}{lb}>'
           f'<div class="memory-media">'
           f'{img(src, photo["cap"], sizes=sizes, loading=loading, position=pos.strip())}'
           f'<span class="memory-ink" aria-hidden="true"></span>'
           f'<span class="memory-register" aria-hidden="true"></span>'
           f'</div>'
           f'<figcaption>{no}<span class="memory-type">{bi(label)}</span>'
           f'<span class="memory-caption">{bi(photo["cap"])}</span>{slug}</figcaption>'
           f'</figure>')
    target = href if href is not None else photo.get("href")
    link_event = f' data-event="{e(event)}"' if event else ""
    return f'<a class="memory-link {e(cls)}" href="{e(target)}"{link_event}>{fig}</a>' if target and not lightbox else fig


def memory_river(keys, variant, pattern=None, links=True, lightbox=False, group=None):
    pattern = pattern or ["wide", "standard", "inset", "standard", "portrait", "standard"]
    frames = []
    for i, key in enumerate(keys):
        role = pattern[i % len(pattern)]
        frames.append(memory_frame(
            key, cls=f"memory-frame--{role}",
            sizes="(max-width:760px) 100vw, 58vw" if role == "wide" else "(max-width:520px) 100vw, (max-width:760px) 50vw, 36vw",
            lightbox=lightbox, group=group or variant,
            href=None if links else "", index=f"{i + 1:02d}"
        ))
    return f'<div class="memory-river memory-river--{e(variant)} err">{"".join(frames)}</div>'


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

def art(name, alt, cls="chapter-art", sizes="(max-width:720px) 100vw, 1120px", loading="eager"):
    """Responsive chapter art with its native panoramic ratio preserved."""
    path = os.path.join(ART_DIR, name + ".webp")
    if not os.path.exists(path):
        return ""
    return (f'<figure class="artwork {e(cls)}" data-art="{e(name)}">'
            f'{img("img/art/" + name, alt, cls="art-img", sizes=sizes, loading=loading)}'
            f'<span class="art-registration" aria-hidden="true"></span>'
            f'</figure>')


def brush_flourish():
    """A code-native calligraphic gesture shared by the opening prints.

    The paths are decorative and deliberately stay outside the image files:
    they can inherit either pigment register, move by a few pixels with the
    page, and disappear cleanly in print without altering documentary media.
    """
    return '''<span class="chapter-tide" aria-hidden="true">
  <svg viewBox="0 0 1000 420" preserveAspectRatio="none" focusable="false">
    <path class="brush-stroke brush-stroke--body" pathLength="1" d="M-70 346 C92 236 232 370 402 258 S710 112 1070 226"/>
    <path class="brush-stroke brush-stroke--dry" pathLength="1" d="M-58 363 C112 268 246 390 421 278 S731 146 1052 244"/>
    <path class="brush-stroke brush-stroke--hair" pathLength="1" d="M-35 318 C116 212 256 338 420 232 S724 88 1028 204"/>
    <g class="brush-flecks">
      <circle cx="134" cy="286" r="5"/><circle cx="153" cy="276" r="2.4"/>
      <circle cx="684" cy="151" r="4"/><circle cx="703" cy="140" r="2"/>
      <circle cx="870" cy="188" r="3.4"/><circle cx="888" cy="184" r="1.7"/>
    </g>
  </svg>
</span>'''


def calligraphy(phrase, source, gloss):
    """A four-character colophon: historical line, modern page argument."""
    spoken = {
        "en": f'{phrase} — {source}. {gloss["en"]}',
        "zh": f'{phrase}——{source}。{gloss["zh"]}',
    }
    glyphs = "".join(f'<span>{e(char)}</span>' for char in phrase)
    return (f'<blockquote class="chapter-calligraphy" lang="zh-Hant" '
            f'aria-label="{e(spoken["en"])}" {attr_bi("aria", spoken)}>'
            f'<span class="calligraphy-mark" aria-hidden="true">{glyphs}</span>'
            f'<footer><cite>{e(source)}</cite><span class="calligraphy-gloss">{bi(gloss)}</span></footer>'
            f'</blockquote>')


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
      <a class="act" href="CV.pdf"><span class="en">CV (PDF)</span><span class="zh">履歷 PDF</span></a>
      <a class="act" href="{e(M["linkedin"])}" rel="me noopener">LinkedIn ↗</a>
      <button class="act" type="button" data-act="mail" data-mail="{e(M["email"])}"><span class="en">Copy email</span><span class="zh">複製信箱</span></button>
    </div>
  </div>
  {art("home-ink", {"en": "Indigo ink flowing into cortical contours", "zh": "靛藍墨流化為皮層般的線條"}, cls="hero-art", loading="eager")}
  {brush_flourish()}
  {calligraphy("乘物遊心", "《莊子》", {"en": "Let the mind roam with things.", "zh": "讓心隨萬物自在遊行。"})}
</div>''')

    # The visual biography: no gallery filler, only frames that resolve to a
    # named event elsewhere in the record.
    o.append(section(
        "frames", "L1b", {"en": "A life in frames", "zh": "大學四年，六個畫面"},
        memory_river(C["collections"]["home"], "home",
                     pattern=["wide", "standard", "standard", "inset", "inset", "portrait"]),
        rail="FRAMES", note={"en": "Six frames · 2023–2026", "zh": "六幀 · 2023–2026"}
    ))

    # threads
    units = []
    for i, t in enumerate(C["threads"]):
        units.append(f'''<article class="unit err">
  <div class="idx"><span class="n">{i+1:02d}</span>{bi(t["tag"])}</div>
  <h3>{bi(t["title"])}</h3>
  <p>{bi(opening(t["body"]))}</p>
  <a class="more" href="research.html#{e(t["id"])}" aria-label="{e('Open thread: ' + t['title']['en'])}" {attr_bi('aria', {'en': 'Open thread: ' + t['title']['en'], 'zh': '展開研究主題：' + t['title']['zh']})}><span class="en">Open thread</span><span class="zh">展開</span></a>
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
        proof = ""
        if a.get("media"):
            proof = memory_frame(a["media"][0], cls="honour-teaser-frame",
                                 sizes="(max-width:760px) 100vw, 50vw",
                                 href=f'record.html#{a["id"]}')
        cards.append(f'''<article class="card honour-teaser err">
  {proof}
  <div class="honour-teaser-copy">
  <div class="idx"><span class="n">{e(a["year"])}</span>{bi(a["org"])}</div>
  <h3>{bi(a["title"])}</h3>
  <p>{bi(a["note"])}</p>
</div>
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
<div class="chapter-stage chapter-stage--research" data-chapter="02">
<div class="masthead">
  {cartouche("研究")}
  <div class="band err"><span class="en">SECTION 02 · FOUR THREADS</span><span class="zh">第 02 節 · 四條線</span></div>
  <h1 class="err"><span class="en">RESEARCH</span><span class="zh">研究</span></h1>
  <p class="lede err"><span class="en">One programme across neuroscience and computer vision: memory as denoising, posterior sampling, 3D reconstruction from fMRI, and controllable generation.</span><span class="zh">一個橫跨腦神經與電腦視覺的研究計畫：記憶即去噪、後驗取樣、從 fMRI 進行 3D 重建，以及可控生成。</span></p>
</div>
{art("research", {"en": "Four indigo currents meeting around a clear centre", "zh": "四股靛藍墨流在留白中心交會"})}
{brush_flourish()}
{calligraphy("格物致知", "《大學》", {"en": "Investigate things; extend knowledge.", "zh": "窮究事理，推致其知。"})}
</div>''']

    o.append(section(
        "evidence", "L1b", {"en": "Where the work happens", "zh": "研究發生的地方"},
        memory_river(C["collections"]["research"], "research",
                     pattern=["wide", "standard", "standard"], links=False,
                     lightbox=True, group="research"),
        rail="EVIDENCE", note={"en": "NTHU · Academia Sinica · UCLA", "zh": "清華 · 中研院 · UCLA"}
    ))

    cards = []
    for i, t in enumerate(C["threads"]):
        cards.append(f'''<article class="unit thread-card err" id="{e(t["id"])}">
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
  <span class="en">The two co-first-author manuscripts are under review at NeurIPS 2026; author lists remain abbreviated here while review is active.</span>
  <span class="zh">兩篇共同第一作者手稿正投稿 NeurIPS 2026 審查中；審查期間作者名單於此採簡寫。</span>
</p>'''
    proof = memory_river(C["collections"]["papers"], "papers",
                         pattern=["wide", "standard"], links=False,
                         lightbox=True, group="papers")
    return f'''
<div class="chapter-stage chapter-stage--papers" data-chapter="03">
<div class="masthead">
  {cartouche("論文")}
  <div class="band err"><span class="en">SECTION 03 · RESEARCH OUTPUTS</span><span class="zh">第 03 節 · 研究成果</span></div>
  <h1 class="err"><span class="en">PAPERS</span><span class="zh">論文</span></h1>
  <p class="lede err"><span class="en">Five research outputs across predictive coding, Bayesian sampling, controllable generation, scientific imaging, and anomaly-detection benchmarks.</span><span class="zh">五項研究成果，涵蓋預測編碼、貝氏取樣、可控生成、科學影像與異常偵測基準。</span></p>
</div>
{art("papers", {"en": "Five quiet layers of indigo pigment settling on paper", "zh": "五層靛藍顏料沉積於紙上"})}
{brush_flourish()}
{calligraphy("文以載道", "周敦頤", {"en": "Writing carries the way.", "zh": "以文字承載思想與道路。"})}
</div>
{section("evidence", "L3", {"en": "Research in public", "zh": "研究，走到現場"}, proof,
         rail="EVIDENCE", note={"en": "Workshop · research cohort", "zh": "Workshop · 研究實習"})}
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
    proof_sections = []
    for order, (key, href) in enumerate((("nsf", "field-nsf.html"), ("igem", "field-igem.html"))):
        t = lr[key]
        keys = C["collections"][key]
        hero = medium(keys[0])
        cards.append(f'''<a class="unit trip-card err" href="{href}" data-event="{e(hero.get("event", ""))}">
  <div class="trip-card-media" data-treatment="{e(hero.get("treatment", "natural"))}">{img(hero["src"], hero["cap"], sizes="(max-width:900px) 100vw, 50vw", loading="lazy", position=f'{hero.get("fx", "50%")} {hero.get("fy", "50%")}')}<span class="memory-ink" aria-hidden="true"></span><span class="memory-register" aria-hidden="true"></span></div>
  <div class="trip-card-copy">
    <div class="idx"><span class="n">{e(t["date"])}</span>{e(t["place"])}</div>
    <h3>{bi(t["title"])}</h3>
    <p>{bi(trip_meta[key])}</p>
    <span class="more"><span class="en">Read it</span><span class="zh">讀下去</span></span>
  </div>
</a>''')
        title = ({"en": "Philadelphia & New York proof sheet", "zh": "費城與紐約印樣"} if key == "nsf" else
                 {"en": "Paris proof sheet", "zh": "巴黎印樣"})
        note = ({"en": "Team → talk → workshop → New York → Philadelphia", "zh": "團隊 → 發表 → workshop → 紐約 → 費城"} if key == "nsf" else
                {"en": "Work → stage → gold → city", "zh": "製作 → 舞台 → 金牌 → 城市"})
        river = memory_river(keys[1:], f"field-{key}",
                             pattern=["standard", "wide", "inset", "wide", "portrait"],
                             links=False, lightbox=True, group=key)
        proof_sections.append(section(f"{key}-frames", "L5b", title, river,
                                      rail=f"{key.upper()} FRAMES", note=note))
    return f'''
<div class="chapter-stage chapter-stage--field" data-chapter="04">
<div class="masthead">
  {cartouche("現場")}
  <div class="band err"><span class="en">SECTION 04 · AWAY FROM THE DESK</span><span class="zh">第 04 節 · 離開桌前</span></div>
  <h1 class="err"><span class="en">FIELD</span><span class="zh">現場</span></h1>
  <p class="lede err"><span class="en">Two teams, two international stages, and the work behind the result: the NSF HDR ML Challenge and iGEM.</span><span class="zh">兩個團隊、兩個國際舞台，以及成果背後的工作：NSF HDR ML Challenge 與 iGEM。</span></p>
</div>
{art("field", {"en": "Two indigo paths crossing an imagined coastline", "zh": "兩條靛藍旅路跨過想像的海岸"})}
{brush_flourish()}
{calligraphy("行遠自邇", "《禮記》", {"en": "To go far, begin near.", "zh": "欲行其遠，必自近處開始。"})}
</div>
{section("trips", "L5a", {"en": "Two journeys", "zh": "兩段現場"}, f'<div class="grid c2">{"".join(cards)}</div>', rail="TRIPS")}
{"".join(proof_sections)}'''


# ── pages: the two essays ───────────────────────────────────────────
def p_essay(key):
    t = C["longreads"][key]
    photos = [medium(k) for k in C["collections"][key]]
    hero, rest = photos[0], photos[1:]

    def frame_role(ph):
        dim = webp_size(os.path.join(ROOT, ph["src"] + ".webp"))
        if dim and dim[0] / max(1, dim[1]) < .86:
            return "portrait"
        if dim and dim[0] / max(1, dim[1]) > 1.42:
            return "wide"
        return "standard"

    def flow(lang):
        paras = t[lang]
        n = len(paras)
        # place the remaining photographs proportionally through the essay
        slots = {}
        for i, ph in enumerate(rest):
            at = max(1, min(n, int(round(n * (i + 1) / (len(rest) + 1)))))
            slots.setdefault(at, []).append(ph)
        out = []
        for i, para in enumerate(paras):
            cls = ' class="lead"' if i == 0 else ""
            out.append(f"<p{cls}>{e(para)}</p>")
            if i + 1 in slots:
                frames = "".join(memory_frame(
                    ph, cls=f"essay-memory memory-frame--{frame_role(ph)}",
                    sizes="(max-width:900px) 100vw, 720px", href=""
                ) for ph in slots[i + 1])
                out.append(f'<div class="essay-memory-pair">{frames}</div>')
        return "".join(out)

    other = "field-igem.html" if key == "nsf" else "field-nsf.html"
    other_t = C["longreads"]["igem" if key == "nsf" else "nsf"]

    return f'''
<div class="masthead essay-masthead">
  {cartouche(t["title"]["zh"][:6])}
  <div class="band err">{e(t["place"])} · {e(t["date"])}</div>
  <h1 class="err"><span class="en">{e(t["title"]["en"])}</span><span class="zh">{e(t["title"]["zh"])}</span></h1>
</div>
<div class="essay-hero">{memory_frame(hero, cls="memory-frame--hero", sizes="(max-width:760px) 100vw, 1174px", loading="eager", href="")}</div>
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

    def chron_event(kind, href, title, detail, media_key=None, event_id=""):
        title_html = (f'<span class="en" lang="en">{e(title)}</span>'
                      f'<span class="zh" lang="en">{e(title)}</span>') if isinstance(title, str) else bi(title)
        detail_html = (f'<span class="en" lang="en">{e(detail)}</span>'
                       f'<span class="zh" lang="en">{e(detail)}</span>') if isinstance(detail, str) else bi(detail)
        thumb = ""
        visual = " chron-event--visual" if media_key else ""
        if media_key:
            ph = medium(media_key)
            pos = f'{ph.get("fx", "50%")} {ph.get("fy", "50%")} '
            thumb = (f'<span class="chron-thumb" data-treatment="{e(ph.get("treatment", "natural"))}">'
                     f'{img(ph["src"], ph["cap"], sizes="(max-width:760px) calc(100vw - 64px), (max-width:1100px) 40vw, 36vw", position=pos.strip())}'
                     f'<span class="chron-ink" aria-hidden="true"></span></span>')
        thumb_line = f"    {thumb}\n" if thumb else ""
        return f'''<li>
  <a class="chron-event chron-event--{kind}{visual}" href="{e(href)}" data-kind="{kind}" data-event="{e(event_id)}">
{thumb_line}    <span class="chron-copy">
    <span class="chron-kind">{bi(kind_labels[kind])}</span>
    <h4 class="chron-title">{title_html}</h4>
    <p class="chron-detail">{detail_html}</p>
    </span>
  </a>
</li>'''

    chronology = {year: [] for year in range(2023, 2027)}
    paper_media = {
        "MatrixQR: Matrix-Guided Refinement for Decoupling Reliability Control from Creative Edits in QR Code Generation": "academia-sinica",
        "Building Machine Learning Challenges for Anomaly Detection in Science": "nsf-talk",
    }
    for pub in sorted(C["publications"], key=lambda p: (int(p["year"]), p["title"])):
        chronology[int(pub["year"])].append(
            chron_event("paper", "publications.html", pub["title"], pub["venue"],
                        paper_media.get(pub["title"]))
        )
    for key, href in (("nsf", "field-nsf.html"), ("igem", "field-igem.html")):
        t = lr[key]
        mk = C["collections"][key][0]
        chronology[int(t["date"][:4])].append(
            chron_event("field", href, t["title"],
                        {"en": f'{t["date"]} · {t["place"]}',
                         "zh": f'{t["date"]} · {t["place"]}'}, mk,
                        medium(mk).get("event", ""))
        )
    for award in sorted(C["awards"], key=lambda a: (int(a["year"]), a["title"]["en"])):
        mk = (award.get("media") or award.get("evidence") or [None])[0]
        chronology[int(award["year"])].append(
            chron_event("award", f'#{award["id"]}', award["title"], award["org"],
                        mk, award["id"])
        )

    chron_years = "".join(f'''<li class="chron-year" data-year="{year}" data-count="{len(chronology[year])}">
  <header class="chron-year-head">
    <h3 class="chron-year-title">{year}</h3>
    <span class="chron-count"><span class="en">{len(chronology[year])} {'entry' if len(chronology[year]) == 1 else 'entries'}</span><span class="zh">{len(chronology[year])} 筆</span></span>
  </header>
  <ol class="chron-events">{"".join(chronology[year])}</ol>
</li>''' for year in range(2023, 2027))
    chron = f'<ol class="chronology err">{chron_years}</ol>'

    # The complete application-table register. Public outcomes are allowed to
    # point into the visual chronology or an official record; quieter academic,
    # funding and service entries stay compact instead of pretending to be
    # award dossiers of equal weight.
    deed_categories = [
        ("academic", "A", {"en": "Academic foundation", "zh": "學業"}),
        ("funding", "S", {"en": "Scholarships & support", "zh": "獎學金與補助"}),
        ("role", "R", {"en": "Roles & service", "zh": "職務、社團與校隊"}),
        ("outcome", "O", {"en": "Research & competition outcomes", "zh": "研究與競賽成果"}),
    ]
    deed_groups = []
    for kind, mark, label in deed_categories:
        entries = [d for d in C["deeds"] if d["category"] == kind]
        rows = []
        for i, d in enumerate(entries):
            links = []
            if d.get("href"):
                links.append(f'<a href="{e(d["href"])}"><span class="en">DETAIL</span><span class="zh">詳情</span></a>')
            if d.get("url"):
                links.append(f'<a href="{e(d["url"])}" rel="noopener"><span class="en">SOURCE ↗</span><span class="zh">來源 ↗</span></a>')
            actions = f'<span class="deed-actions">{"".join(links)}</span>' if links else ""
            actions_line = f'  {actions}\n' if actions else ""
            rows.append(f'''<li class="deed-item" id="deed-{e(d["id"])}">
  <span class="deed-no">{mark}{i + 1:02d}</span>
  <time>{bi(d["date"])}</time>
  <span class="deed-copy"><strong>{bi(d["title"])}</strong><small>{bi(d["detail"])}</small></span>
{actions_line}</li>''')
        deed_groups.append(f'''<section class="deed-group" data-kind="{e(kind)}">
  <header><span class="deed-mark">{mark}</span><h3>{bi(label)}</h3><span class="deed-count">{len(entries):02d}</span></header>
  <ol>{"".join(rows)}</ol>
</section>''')
    deed_support_keys = ["academia-internship-certificate", "taai-matrixqr-acceptance", "jmp-paper-first-page"]
    deed_support = "".join(memory_frame(
        key, cls="proof-frame", sizes="(max-width:760px) 100vw, 33vw",
        lightbox=True, group="deed-documents", href="", index=f"{i + 1:02d}"
    ) for i, key in enumerate(deed_support_keys))
    deeds = (f'<div class="deed-register err">{"".join(deed_groups)}</div>'
             f'<div class="deed-support err"><div class="deed-support-head"><span>APPX.</span><h3><span class="en">Supporting facsimiles</span><span class="zh">補充文件</span></h3><p><span class="en">Research appointment · acceptance · publication</span><span class="zh">研究經歷 · 接受紀錄 · 出版成果</span></p></div><div class="deed-proof-grid">{deed_support}</div></div>'
             f'<p class="record-provenance err"><span class="en">All 22 entries are transcribed from the specific-achievements table supplied with the Mei Yi-Chi application and reconciled against the current CV. Public outcomes link to primary records where available; student IDs, application contact fields and home-address details are not reproduced on this page.</span><span class="zh">22 筆全部轉錄自梅貽琦獎章申請文件的具體事蹟表，並與最新 CV 交叉核對；公開成果盡量連至一手紀錄，申請表內的學號、聯絡欄位與住址資訊不轉載於本頁。</span></p>')

    press_cards = []
    for p in C["press"]:
        photo = medium(p["media"])
        position = f'{photo.get("fx", "50%")} {photo.get("fy", "50%")} '
        quote = f'<blockquote>{bi(p["quote"])}</blockquote>' if p.get("quote") else ""
        quote_line = f'    {quote}\n' if quote else ""
        press_cards.append(f'''<a class="press-card err" href="{e(p["url"])}" rel="noopener">
  <span class="press-image" data-treatment="{e(photo.get("treatment", "natural"))}">
    {img(photo["src"], photo["cap"], sizes="(max-width:760px) 100vw, 50vw", position=position.strip())}
    <span class="press-wave" aria-hidden="true"></span>
  </span>
  <span class="press-copy">
    <span class="press-meta"><time>{e(p["date"])}</time>{bi(p["source"])}</span>
    <strong>{bi(p["title"])}</strong>
    <span class="press-excerpt">{bi(p["excerpt"])}</span>
{quote_line}    <span class="press-read"><span class="en">PRIMARY SOURCE ↗</span><span class="zh">閱讀一手來源 ↗</span></span>
  </span>
</a>''')
    press = f'<div class="press-grid">{"".join(press_cards)}</div>'

    def honour_actions(a):
        actions = []
        if a.get("hero"):
            actions.append('<span class="chip p"><span class="dot"></span><span class="en">FEATURED</span><span class="zh">精選</span></span>')
        if a.get("url"):
            label = {"en": "Official record: " + a["title"]["en"],
                     "zh": "官方紀錄：" + a["title"]["zh"]}
            actions.append(f'<a class="chip s" href="{e(a["url"])}" rel="noopener" aria-label="{e(label["en"])}" {attr_bi("aria", label)}><span class="en">OFFICIAL ↗</span><span class="zh">官方紀錄 ↗</span></a>')
        return "".join(actions)

    honours = []
    for i, a in enumerate(sorted(C["awards"], key=lambda x: -int(x["year"]))):
        keys = (a.get("media") or []) + (a.get("evidence") or [])
        proofs = "".join(memory_frame(
            key, cls="proof-frame", sizes="(max-width:760px) 100vw, 42vw",
            lightbox=True, group=a["id"], href="", index=f"{j + 1:02d}"
        ) for j, key in enumerate(keys))
        honours.append(f'''<article class="honour-dossier err" id="{e(a["id"])}" data-event="{e(a["id"])}">
  <div class="honour-copy">
    <div class="idx"><span class="n">{i + 1:02d}</span><span>{e(a["year"])}</span></div>
    <h3>{bi(a["title"])}</h3>
    <p class="where">{bi(a["org"])}</p>
    <p class="honour-note">{bi(a["note"])}</p>
    <div class="honour-actions">{honour_actions(a)}</div>
  </div>
  <div class="honour-proof honour-proof--{len(keys)}">{proofs}</div>
</article>''')
    honours = "".join(honours)

    field = "".join(f'''<a class="row" href="{href}">
  <div class="yr">{e(lr[k]["date"])}</div>
  <div class="bd"><h3>{e(lr[k]["place"])}</h3><p class="where"><span class="en">Field notes</span><span class="zh">現場筆記</span></p></div>
  <div class="rt"><span class="chip i"><span class="en">ESSAY</span><span class="zh">長文</span></span></div>
</a>''' for k, href in (("nsf", "field-nsf.html"), ("igem", "field-igem.html")))

    n_aw, n_pa, n_tr = len(C["awards"]), len(C["publications"]), 2
    n_public, n_deeds, n_press = n_aw + n_pa + n_tr, len(C["deeds"]), len(C["press"])

    return f'''<div class="chapter-stage chapter-stage--record" data-chapter="05">
<div class="masthead">
  {cartouche("紀錄")}
  <div class="band err"><span class="en">SECTION 05 · THE RECORD</span><span class="zh">第 05 節 · 紀錄</span></div>
  <h1 class="err"><span class="en">RECORD</span><span class="zh">紀錄</span></h1>
  <p class="lede err"><span class="en">{n_deeds} documented deeds · {n_public} selected milestones · {n_aw} honours · {n_pa} papers.</span><span class="zh">{n_deeds} 筆具體事蹟 · {n_public} 個精選里程碑 · {n_aw} 項獎項與入選 · {n_pa} 篇論文。</span></p>
</div>
{art("record", {"en": "A four-terrace indigo river carrying a dense record", "zh": "承載完整紀錄的四段靛藍河階"})}
{brush_flourish()}
{calligraphy("上下求索", "《楚辭》", {"en": "Search above and below.", "zh": "向上向下，始終求索。"})}
</div>
{section("chronology", "L4", {"en": f"{n_public} selected milestones", "zh": f"{n_public} 個精選里程碑"}, chron,
         rail="CHRONOLOGY", note={"en": "Four honest year bands; density follows the events", "zh": "四個真實年份；事件多寡決定密度"})}
{section("deeds", "L4b", {"en": "The complete deed register", "zh": "完整具體事蹟冊"}, deeds,
         rail="DEEDS", note={"en": f"All {n_deeds} entries · nothing promoted into filler", "zh": f"全 {n_deeds} 筆 · 輕重分明，不以空話填版"})}
{section("honours", "L5a", {"en": "Honours", "zh": "獎項"},
         f'<div class="honour-dossiers">{honours}</div>', rail="HONOURS",
         note={"en": "Certificate when one exists; no stand-ins", "zh": "有證書才放證書，不以其他文件代替"})}
{section("press", "L5b", {"en": "In the public record", "zh": "公開報導"}, press,
         rail="PRESS", note={"en": f"{n_press} first-party reports · excerpted, not inflated", "zh": f"{n_press} 則一手報導 · 節錄而不誇飾"})}
{section("field", "L5c", {"en": "Field work", "zh": "現場"},
         f'<div class="ledger err">{field}</div>'
         f'<p class="err" style="margin-top:var(--s5);font-family:var(--f-mono);font-size:var(--t-2xs);'
         f'letter-spacing:.13em;text-transform:uppercase;color:var(--muted)">'
         f'<span class="en">{n_deeds:02d} DEEDS · {n_public:02d} SELECTED MILESTONES · {n_aw:02d} HONOURS · {n_pa:02d} PAPERS · {n_tr:02d} FIELD</span>'
         f'<span class="zh">{n_deeds:02d} 筆事蹟 · {n_public:02d} 個精選里程碑 · 獎項與入選 {n_aw:02d} · 論文 {n_pa:02d} · 現場 {n_tr:02d}</span></p>',
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
{section("four-years", "L3b", {"en": "Four years, beyond the CV", "zh": "履歷之外的四年"},
         memory_river(C["collections"]["about"], "about",
                      pattern=["portrait", "standard", "wide", "wide", "portrait"],
                      links=False, lightbox=True, group="about"),
         rail="FOUR YEARS", note={"en": "Paris · water · Hsinchu · varsity · graduation · UCLA", "zh": "巴黎 · 水下 · 新竹 · 校隊 · 畢業 · UCLA"})}
{section("facts", "L4", {"en": "Profile", "zh": "簡歷"},
         f'<div class="ledger err">{facts}</div>'
         f'<div class="acts"><a class="act" href="record.html#honours">'
         f'<span class="en">Honours and chronology</span><span class="zh">獎項與年表</span></a></div>', rail="FACTS")}
{section("contact", "L6", {"en": "Contact", "zh": "聯絡方式"},
         f'''<div class="grid contact-grid" style="background:transparent;border:0;gap:var(--s3)">
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
  <a class="card err" href="{e(M["linkedin"])}" rel="me noopener">
    <div class="idx"><span class="n">03</span>LINKEDIN</div>
    <h3 style="font-size:var(--t-sm)">Arthur Lee</h3>
    <span class="more"><span class="en">Connect</span><span class="zh">前往</span></span>
  </a>
  <a class="card err" href="{e(M["cv"])}">
    <div class="idx"><span class="n">04</span><span class="en">CURRICULUM VITAE</span><span class="zh">履歷</span></div>
    <h3 style="font-size:var(--t-sm)">CV.pdf</h3>
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
        "sameAs": [M["github"], M["linkedin"]],
        "affiliation": {"@type": "CollegeOrUniversity", "name": "National Tsing Hua University"},
        "knowsAbout": ["Predictive coding", "Associative memory", "Bayesian inference",
                       "Neuroscience", "Computer vision", "3D reconstruction",
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
    "assets/bubbles.js",
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
