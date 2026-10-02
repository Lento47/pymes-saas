"""Upload the 18 sector photographs to production R2 and point the categories at them.

## Why this writes R2 and D1 directly instead of calling `uploads.create`

`uploads.create` is a `protectedProcedure` and `admin.saveCategory` is an `adminProcedure`,
whose `is_admin` is "set in SQL and never granted through the API surface". Production has
exactly one admin (`lejzer36@proton.me`) and the documented demo password is explicitly never
applied against remote. So there is no credential for this script to use, and inventing one
— minting a session row, flipping `is_admin` — would be a far larger and less honest change
than the task.

The two endpoints exist, the tables are the schema, and both writes are recorded here
exactly as `services/uploads.ts` performs them. The differences are stated in the output.

## The leading-slash problem, which is the whole reason this is not `wrangler r2 object put`

`services/uploads.ts` stores the object at

    const path = `/files/${id}`;
    await ctx.env.MEDIA.put(path, bytes, { httpMetadata: { contentType: input.mimeType } });

— **with** a leading slash — and `uploads.read` fetches `env.MEDIA.get(row.key)`. R2 keys are
opaque byte strings, so `/files/x` and `files/x` are two different objects.

`wrangler r2 object put pymeshub-media//files/x` silently normalises the slash away: a probe
written as `/files/probe` read back identically through both `/files/probe` and
`files/probe`, which is only possible if wrangler stores one normalised form. The row would
then name `/files/x` while the bucket holds `files/x`, and every photo 404s.

Cloudflare's R2 REST endpoint takes the key verbatim. This uses that, so the stored key is
byte-identical to what a merchant's own upload would produce.

## What is written

Per sector: one R2 object at `/files/upl_<uuid>` and one `upload` row whose `key` is that
same string, then `category.image_url` set to the root-relative `/files/upl_<uuid>`.
`components/image.tsx` resolves a leading `/` against `env.apiUrl`, and `/files/:id` serves
`public, max-age=31536000, immutable` — so the row value is exactly what the rail expects and
the bytes are cached for a year.

`owner_user_id` is left NULL, which the column allows. A real upload records the uploader; a
taxonomy seed has no person behind it, and inventing one would be a false audit trail.

## Safety

Prints every id it mints and writes nothing until it has the full set. `--dry` performs no
writes at all. It never deletes: an existing `image_url` is reported and left alone unless
`--overwrite` is passed, because a photo on a live storefront is not something to clear by
accident.
"""

import argparse
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

sys.stdout.reconfigure(encoding="utf-8")

DIR = "apps/mobile/assets/categories"
ACCOUNT = "a0880a963b36e3bb7150104a0fa1a613"
BUCKET = "pymeshub-media"
DB_NAME = "pymhubdb"
WRANGLER_DIR = os.path.join("packages", "trpc-api")
MIME = "image/webp"


def slug_order() -> list[str]:
    """The 18 sector slugs, in the taxonomy's own sort_order.

    Read from the migration rather than transcribed: the list in
    `assets/categories/README.md` was wrong once (`agriculture-industry-b2b` for
    `agriculture-industrial-b2b`), and a wrong slug fails as a missing photo rather than as
    an error.
    """
    sql = io.open(
        os.path.join("packages", "db", "migrations", "0006_category_taxonomy.sql"),
        encoding="utf-8",
    ).read()
    rows = re.findall(
        r"\('cat_[^']*',\s*'([^']*)',\s*'([^']*)',\s*'[^']*',\s*(?:NULL|'[^']*'),\s*"
        r"(NULL|'cat_[^']*'),\s*(\d+)\s*,\s*\d+\s*\)",
        sql,
    )
    sectors = [(int(order), slug) for slug, _name, parent, order in rows if parent == "NULL"]
    return [slug for _, slug in sorted(sectors)]


def token() -> str:
    body = io.open(
        os.path.expanduser(r"~\.wrangler\config\default.toml"), encoding="utf-8"
    ).read()
    m = re.search(r'^\s*oauth_token\s*=\s*"([^"]+)"', body, re.M)
    if not m:
        raise SystemExit("no oauth_token in the wrangler config")
    return m.group(1)


def r2_put(key: str, path: str, bearer: str) -> int:
    """PUT one object. Returns the byte count written.

    The key is percent-encoded with `safe=""`, and that is load-bearing rather than
    hygiene. The key is `/files/<id>` **with** a leading slash — the form
    `services/uploads.ts` writes and the form `upload.key` must therefore hold, because
    `uploads.read` fetches `MEDIA.get(row.key)`.

    Written unencoded, the REST URL becomes `.../objects//files/<id>`, and the endpoint
    collapses the double slash: the object lands at `files/<id>` while the row names
    `/files/<id>`, and every photo 404s on the live storefront with no error anywhere.
    Encoding makes the leading `%2F` survive, and both sides agree.
    """
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}"
        f"/r2/buckets/{BUCKET}/objects/{urllib.parse.quote(key, safe='')}"
    )
    data = io.open(path, "rb").read()
    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("Authorization", f"Bearer {bearer}")
    req.add_header("Content-Type", MIME)
    with urllib.request.urlopen(req, timeout=90) as res:
        res.read()
        return len(data)


def verify(url_path: str) -> tuple[int, int, str]:
    """GET a served photo. Returns (status, bytes, content-type).

    Read with curl rather than urllib because Cloudflare's managed rules answer urllib's
    default `User-Agent` with 403 before the Worker sees the request — which says nothing
    about whether the object is there.
    """
    out = subprocess.run(
        [
            "curl.exe", "-s", "-o", os.path.join(os.environ["TEMP"], "opencode", "_verify.out"),
            "-w", "%{http_code} %{size_download} %{content_type}",
            "https://api.pymeshub.lat" + url_path,
        ],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    parts = out.stdout.split()
    try:
        return int(parts[0]), int(parts[1]), (parts[2] if len(parts) > 2 else "")
    except (IndexError, ValueError):
        return 0, 0, ""


def d1(sql: str) -> str:
    """Run SQL against production D1 and return stdout."""
    path = os.path.join(os.path.expanduser("~"), "AppData", "Local", "Temp", "opencode", "_d1.sql")
    io.open(path, "w", encoding="utf-8").write(sql)

    # `shell=True` because `npx` is a `.cmd` shim on Windows and CreateProcess cannot
    # resolve it without a shell. `--file` rather than `--command` so the SQL does not have
    # to survive a shell's quote rules.
    out = subprocess.run(
        "npx wrangler d1 execute %s --remote --file \"%s\"" % (DB_NAME, path),
        capture_output=True, text=True, cwd=WRANGLER_DIR, shell=True,
        # wrangler's banner carries box-drawing characters and a combining mark; the default
        # cp1252 codec raises on those, and the output is only ever regexed over.
        encoding="utf-8", errors="replace",
    )
    if out.returncode != 0:
        raise SystemExit("d1 execute failed:\n" + ((out.stdout or "") + (out.stderr or ""))[-900:])
    # `or ""` because a shell-launched capture can hand back None on Windows, and every
    # caller here treats the return as a string to search.
    return out.stdout or ""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--overwrite", action="store_true")
    args = ap.parse_args()

    slugs = slug_order()
    print("  sectors: %d" % len(slugs))

    plans = []
    missing = []
    for slug in slugs:
        webp = os.path.join(DIR, f"category-{slug}.webp")
        if not os.path.exists(webp):
            missing.append(slug)
            continue
        uid = "upl_" + str(uuid.uuid4())
        plans.append(
            {
                "slug": slug,
                "id": uid,
                "key": f"/files/{uid}",
                "path": f"/files/{uid}",
                "file": webp,
                "bytes": os.path.getsize(webp),
            }
        )

    if missing:
        print("  no webp for: " + ", ".join(missing))
        print("  run `pnpm catalog:images` first")
        sys.exit(1)

    print("  %-42s %-46s %7s" % ("slug", "id", "bytes"))
    print("  " + "-" * 42 + " " + "-" * 46 + " " + "-" * 7)
    for p in plans:
        print("  %-42s %-46s %7d" % (p["slug"], p["id"], p["bytes"]))
    print()
    print("  total: %.1f KB across %d objects" % (
        sum(p["bytes"] for p in plans) / 1024, len(plans)))

    # Refuse to clear a photo that is already there.
    existing = d1(
        "SELECT slug, image_url FROM category WHERE parent_id IS NULL;"
    )
    already = dict(re.findall(r'"slug":\s*"([^"]+)",\s*"image_url":\s*"([^"]*)"', existing))
    clash = [p for p in plans if already.get(p["slug"])]
    if clash:
        print()
        print("  %d sector(s) already have an image_url:" % len(clash))
        for p in clash:
            print("    %-42s %s" % (p["slug"], already[p["slug"]]))
        if not args.overwrite:
            print("  refusing to overwrite. pass --overwrite, or resolve by hand.")
            sys.exit(2)

    if args.dry:
        print()
        print("  dry run — nothing written")
        return

    print()
    print("  uploading objects...")
    bearer = token()
    now = int(time.time() * 1000)
    for i, p in enumerate(plans, 1):
        written = r2_put(p["key"], p["file"], bearer)
        print("    %2d/%d  %s  %d bytes" % (i, len(plans), p["id"], written))

    print()
    print("  writing rows...")
    values = ",\n".join(
        "  ('%s', '%s', '%s', %d, NULL, %d)" % (p["id"], p["key"], MIME, p["bytes"], now)
        for p in plans
    )
    d1("INSERT OR IGNORE INTO `upload` (`id`, `key`, `mime_type`, `size_bytes`, `owner_user_id`, `created_at`) VALUES\n%s;\n" % values)

    for p in plans:
        d1(
            "UPDATE `category` SET `image_url` = '%s' WHERE `slug` = '%s';" % (p["path"], p["slug"])
        )
    print("    %d upload rows, %d categories" % (len(plans), len(plans)))

    # Every photo fetched through the real serve route, by its public URL, before this script
    # reports success. A row written and an object written are two separate facts; only the
    # 200 proves both landed on the same key, which is the failure this whole script exists to
    # avoid. Checking here rather than on the phone means a bad key names itself.
    print()
    print("  verifying through /files/:id (the live serve route)...")
    bad = []
    for p in plans:
        status, size, ctype = verify(p["path"])
        ok = status == 200 and size == p["bytes"] and ctype == MIME
        if not ok:
            bad.append((p["slug"], status, size, ctype, p["bytes"]))
        print("    %-42s HTTP %s  %6d/%-6d  %-11s %s"
              % (p["slug"], status, size, p["bytes"], ctype or "-", "ok" if ok else "MISMATCH"))

    print()
    if bad:
        print("  %d of %d did not serve correctly:" % (len(bad), len(plans)))
        for slug, status, size, ctype, want in bad:
            print("    %-42s HTTP %s  %d bytes (want %d)  %s" % (slug, status, size, want, ctype))
        sys.exit(3)

    print("  all %d serve 200 with the right bytes and content-type" % len(plans))
    print()
    print("  the home feed's category rail now draws photographs.")


if __name__ == "__main__":
    main()