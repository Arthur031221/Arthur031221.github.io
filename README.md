# Website

Source for my personal academic site, written as a single HTML file.

I'm Chi-Wei Lee (Arthur), a physics and EECS (AI track) undergraduate at National Tsing Hua University, working on computer vision and generative models. The site collects my research, publications, projects, awards and contact details in one page.

## Running it

There is no build step, no package manager and no dependencies to install. Open `index.html` in a browser, or serve the directory if you want correct relative paths:

```bash
python -m http.server 8080
```

Tailwind comes from `cdn.tailwindcss.com` and the fonts (Inter, Noto Sans TC) from Google Fonts, so the page needs a network connection to look right. Everything else, all custom CSS and all JavaScript, is inline in `index.html`.

## What's in the page

Sections in order: hero, about, research and experience, timeline, projects, publications, awards, contact.

The timeline is the substantial part. Each entry is a `<details>` element that expands into a longer write-up. Several entries carry a personal reflection written in Chinese followed by an English translation, and two of them (NSF HDR ML Challenge 2025, iGEM 2023) include photo galleries.

Light and dark themes are both defined as CSS custom properties on `html[data-theme]`. A toggle in the nav switches between them and the choice is stored in `localStorage`. The hero background is a photo from the Formosa Trail ultramarathon, dimmed differently in each theme.

Projects link out to three other repositories of mine: `MatrixQR`, `NSF-HDR` and `X-Ray`. CV PDFs are linked from Google Drive rather than committed here.

## Files

`index.html` is about 72 KB and contains the whole site. The rest of the repo is images.

- `S__16670722.jpg` is the hero background.
- `NSF0.jpg` through `NSF2.jpg` and `igem0.jpg` through `igem3.jpg` are the two galleries.
- `AA38EA04-7BA9-4A2D-BC84-63209EC85232.jpg` is the profile photo.

Seven further files with UUID names are byte-for-byte duplicates of the `NSF*` and `igem*` images, left over from the original upload. Nothing references them, and they add about 7 MB to a repo that is otherwise around 9 MB.
