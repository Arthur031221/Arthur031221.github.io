# CODEX_ART_BRIEF — 圖像生成完整需求 · Image generation brief

> **給 Codex：** 這個網站已經為你留好了圖像插槽。你要做的事是：依照下面每一項
> 的規格生成圖像，存到指定的檔名，然後執行 `python3 src/build.py --live`。
> 建置器會偵測 `img/art/*.webp` 是否存在——檔案在，版面就會自動騰出空間；
> 檔案不在，頁面就維持純文字。**不需要改任何 HTML/CSS/JS。**

---

## 一、視覺世界觀（每張圖都必須遵守）

網站的主題是「墨滴入水」× 藍摺繪（aizuri-e，北齋的全藍浮世繪）。
生成的圖必須讀起來像**同一位藝術家的同一個系列**。

### 風格關鍵詞（英文 prompt 用）

```
a single drop of sumi ink dispersing in still clear water,
buoyant vortex ring destabilising into lobes and fine tendrils,
razor-sharp filaments over soft billowing haze,
Prussian blue pigment (aizuri-e palette), high-speed macro photography,
Alberto Seveso style underwater ink, pale warm paper-white background,
majestic slow motion feel, enormous negative space, minimalist composition
```

### 嚴格色票（不得偏離）

| 用途 | HEX | 名稱 |
|---|---|---|
| 背景（亮） | `#F4F0E5` | 紙白（暖象牙，不是純白） |
| 背景（暗系列用） | `#060B16` | 夜水（深靛黑） |
| 墨主體 | `#152A42` | 紺青壓黑 |
| 墨中間調 | `#2E567E` | 瑠璃 |
| 墨霧 / 邊緣 | `#57748F` | 淺蔥灰藍 |
| 點綴（極少量，可省略） | `#C73E3A` | 朱砂（一個印章大小的紅點以內） |

### 構圖鐵則

1. **留白 ≥ 60%**。墨只佔畫面一側或一角，另一側幾乎全空。
2. 墨的方向感：**由上往下沉**（重力向下），捲鬚向下拖尾。
3. 不要文字、不要浪花圖案、不要富嶽三十六景引用、不要毛筆字。
4. 邊緣乾淨：圖會被放進細線框，四邊不能有雜訊或浮水印。
5. 亮色系列在紙白底上；每張圖同時要能在深色頁面旁不突兀
   （建置器只用亮底版本，深色模式下 CSS 會做 `--img-filter` 調整）。

---

## 二、圖像清單（檔名 · 尺寸 · 構圖指示）

全部存成 **WebP，品質 82**，放進 `img/art/`。
尺寸是最小值；等比更大可以，別小於。

### 1. `img/art/home-ink.webp` — 首頁主視覺 · 2000×900（21:9 橫幅）

一滴墨從畫面上緣約 1/4 處落下，主渦環剛剛開始裂成三到四瓣，
細絲向下拖到畫面中部。墨體集中在**左 1/3**，右 2/3 幾乎全空的紙白。
這是整個網站最重要的一張圖——安靜、莊嚴、像一幀高速攝影。

### 2. `img/art/research.webp` — 研究頁橫幅 · 2000×700

兩滴墨在不同高度、互不接觸，各自處於擴散的不同階段
（一滴剛入水呈環狀、一滴已拖出長鬚）——隱喻平行的研究線。
墨體佔左右兩側邊緣，中央 1/2 留空。

### 3. `img/art/papers.webp` — 論文頁橫幅 · 2000×560

一滴墨已幾乎完全沉降：畫面下緣一層薄薄的、將定未定的墨霧層，
上方 3/4 全空。安定、收尾、歸檔的感覺。

### 4. `img/art/field.webp` — 現場頁橫幅 · 2000×700

墨滴入水的瞬間：入水點的冠狀飛濺剛形成，還沒開始擴散。
充滿動能、旅程開始的感覺。墨體置於**右 1/3**。

### 5. `img/art/record.webp` — 紀錄頁橫幅 · 2000×560

多滴墨（4–6 滴）在一條水平線上等距落下，處於由左到右
漸次擴散的不同階段——時間軸的隱喻。墨體總量仍要克制，
每滴之間留大量空白。

### 6. 選配 · 四條研究線的小圖（若時間允許）

`img/art/thread-pc.webp` `thread-langevin.webp` `thread-fmri.webp` `thread-diffusion.webp`
各 1200×900（4:3）。同一世界觀下的四種墨形態：
- `pc`：兩股墨流交會、相互抵消處留白（預測編碼）
- `langevin`：一團墨霧均勻覆蓋八個隱約的凹點（取樣）
- `fmri`：細墨絲組成的疏鬆網格，一處較密（解碼）
- `diffusion`：墨從清晰到瀰散的單向漸變（擴散模型）
> 這四張目前**沒有**對應插槽，生成後告訴維護者，或自行在
> `src/build.py` 的 `p_research()` 各 thread 區塊加 `art("thread-pc", …)`。

---

## 三、生成後的流程

```bash
# 1. 把生成的 webp 放進 img/art/（檔名務必完全一致）
# 2. 產生響應式衍生檔（可選但建議）：
python3 - <<'EOF'
from PIL import Image
import glob, os
for f in glob.glob('img/art/*.webp'):
    if any(f.endswith(f'-{w}.webp') for w in (400,800,1200)): continue
    im = Image.open(f); W,H = im.size
    for w in (800, 1200):
        if w >= W: continue
        out = f[:-5] + f'-{w}.webp'
        if os.path.exists(out): continue
        im.resize((w, round(H*w/W)), Image.LANCZOS).save(out,'WEBP',quality=82,method=6)
EOF
# 3. 重建網站：
python3 src/build.py --live
# 4. 本機確認：
python3 -m http.server 8080   # 開 http://localhost:8080
```

## 四、驗收標準

- [ ] 每張圖單獨看：留白佔六成以上，墨是普魯士藍系，背景是暖紙白
- [ ] 五張橫幅並排看：像同一個系列，濃淡有節奏（首頁最重、論文頁最輕）
- [ ] 沒有任何一張出現文字、標誌、浪花紋樣或明顯的 AI 瑕疵
- [ ] `python3 src/build.py --live` 之後，`index.html` 內出現 `img/art/home-ink.webp`
- [ ] 深色模式下圖片經 CSS 濾鏡後不刺眼（開網站按 `T` 檢查）
