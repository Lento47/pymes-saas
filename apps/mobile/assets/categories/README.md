# Category photographs

The eighteen sector photographs the home feed's category rail draws, and the rule for
adding or changing one.

## What goes here

One file per sector, named after the **slug** that `packages/db/migrations/0006_category_taxonomy.sql`
assigns:

```
category-food-beverage.png                category-automotive.png
category-clothing-fashion.png             category-toys-hobbies-collectibles.png
category-electronics-technology.png       category-books-media-entertainment.png
category-home-furniture-decor.png         category-pet-supplies-services.png
category-beauty-health-personal-care.png  category-garden-diy-home-improvement.png
category-sports-outdoors-recreation.png   category-office-stationery-business-supplies.png
category-jewelry-watches-luxury.png       category-travel-hospitality-tourism.png
category-financial-insurance-services.png category-education-training.png
category-agriculture-industrial-b2b.png   category-miscellaneous-specialty.png
```

The slug is the filename, not a display name, and that is deliberate. It is the taxonomy's
identity: the seed migration joins on it, and renaming a category must not drop its
photograph. A Spanish display name in a filename would make the art depend on a translation.

**Transcribe the slugs from the migration; do not type them from memory.** This list was
wrong once already: `agriculture-industrial-b2b` was written as
`agriculture-industry-b2b` by hand, which left that sector with a file no slug matched —
and because the failure is "no photo for this one", it renders as an ordinary glyph rather
than as an error. `0006_category_taxonomy.sql:222` is the authority:

```sql
('cat_agriculture-industrial-b2b', 'agriculture-industrial-b2b', 'Agriculture, Industrial & B2B', ...)
```

## What each picture has to satisfy

Draw for a **64pt** tile, not for a poster. Everything below follows from that size:

- **Square.** `category-rail.tsx` draws the photo with `resizeMode="cover"` (the
  `./image` default) at `width: 100%, height: 100%` on a 64pt box, so a non-square master
  is cropped on both sides. Generate 1:1.
- **The subject fills roughly 75% of the frame**, with even margins. A subject touching an
  edge gets clipped by the crop, and the corner is rounded at `radius.sm`.
- **No text, no logos, no brand marks, no packaging text, no watermarks, no faces.** At
  64pt a brand mark is a smudge that implies an endorsement nobody agreed to, and the tile
  carries the category's own `accessibilityLabel` already.
- **Photoreal, not illustrated.** The reason the rail draws photographs at all is that a
  burger silhouette communicates appetite and a fork-and-knife glyph does not.
- **Warm off-white background** (`#EFEEE9`-ish, the `accent` it sits on), not pure white.
  A pure-white square on an off-white tile reads as a photo pasted onto the surface.

**One set, one light.** Generate the first image, look at it, and only then generate the
other seventeen. Independent generations drift — different key light, different white
balance, different camera height — and eighteen tiles that disagree read as eighteen
unrelated pictures rather than one commissioned series. Whatever the style block says for
image one is the style block for all of them.

## Sizes

The masters are 1254x1254 PNGs at roughly 1.1-2.2 MB. **They are the source, not the
shipped file.**

```
pnpm catalog:images           # writes <name>.webp beside each master
pnpm catalog:images -- --dry  # prints the table, writes nothing
```

`scripts/category-images.mjs` produces 512x512 WebP, which is what actually gets uploaded.
The reduction is not cosmetic:

| | PNG master | WebP derivative |
|---|---:|---:|
| Al food beverage | 2153 KB | 76 KB |
| Ropa y Moda | 2169 KB | 43 KB |
| Deportes | 2157 KB | 55 KB |

512 is 8x the tile at the emulator's 3.0x density, which covers a 2x device with headroom
for the 1.04 selected-state scale. The PNG masters are 1.1-2.2 MB against
`MAX_UPLOAD_BYTES` at 4 MiB, so one would *fit* — at forty times the bytes for no visible
gain on a 64pt tile, and eighteen of them on a home screen the reader opens constantly.

## How a photograph reaches a category

The files in this folder are the source of truth for the art, not the delivery. A
photograph reaches a row through `uploads.create`, which writes the bytes to the `MEDIA` R2
bucket **and** the `upload` row that `/files/:id` reads for the object's key and
`Content-Type`. An object in the bucket with no row is a 404, which is a customer seeing a
broken tile.

The column is `category.image_url`, and it is writable: `adminCategoryInput` carries
`imageUrl` with the absent-vs-`null` convention its sibling fields use, `saveCategory`
persists it in both the update and insert branches and records it in the audit trail, and
the web console's **Categorías** tab has a `Foto` field that previews what it will set.

That is the path for *changing* one photograph, by hand, one at a time. For the initial
eighteen, put the files here and say so — the seed that points them at `uploads.create` is
a separate piece of work and is not in the repository yet.

## Do not delete this folder

The assets in it are generated output that has to be fetched or re-generated to restore,
and they are not in git. Treat the folder as the master copy: add, replace, or rename
individual files, never remove the directory.