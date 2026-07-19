# Scans and play counts

This guide explains how the site tracks game plays — both through QR sticker scans at events and
through plays logged by members.

---

## QR sticker scans

Physical game boxes in the club's collection have QR sticker labels on them. When someone at an
event scans one of these stickers with their phone, two things happen simultaneously:

1. The scan is recorded as a **public play** for that game.
2. The visitor is redirected to that game's page on the website.

The sticker URL takes the form `/p/<game-slug>`, `/lets-play/<game-slug>`, or
`/learn-to-play/<game-slug>` — all three do exactly the same thing. Having several formats allows
flexibility if different batches of stickers are printed at different times; the club's
auto-generated sticker sheet uses `/learn-to-play/`.

> [!NOTE]
> A scan is only recorded if the game is present in at least one active collection or library. Scans
> for games not in the site will still redirect the visitor, but the play will not be counted.

---

## Member plays

Separately from QR scans, members can log their own plays using the **+1** button next to each
game on the [stats page](https://shiny-hoppy-meeple.pages.dev/stats/). These are tracked
independently and show up as **member plays** on the game's page.

The site uses member plays — not QR scans — to calculate each game's **SHM Rank**. A game ranked
\#1 is the one members have collectively logged the most plays of.

---

## What appears on game pages

Each game's detail page shows three play-related figures:

| Field | What it counts |
| --- | --- |
| **SHM Rank** | The game's position in the overall member-play rankings |
| **Members** | Total plays logged by members |
| **Public** | Total QR sticker scans at events and venues |

Member pages also show a small rank badge on each game card, indicating how that game ranks among
all members.

Play counts load a moment after the page opens — it is normal for them to briefly appear blank
before filling in.

---

## Game names and QR stickers

Each game's URL is derived from its name. For example, a game called **Cosmic Encounter** gets the
URL slug `cosmic-encounter`, and its QR stickers encode a URL containing that slug.

> [!WARNING]
> **If a game's name changes, its URL slug changes too — and any printed QR stickers for that game
> stop working.** The old slug is no longer on the site's list of valid games, so scans of the old
> sticker are not counted at all, and the visitor is redirected to a page that no longer exists
> (a "page not found" error). Finalise a game's name in BoardGameGeek before printing QR stickers
> for it, and reprint stickers if a name has to change.

---

## Getting new stickers printed

A print-ready A4 sticker sheet covering **every game in the main library** is generated
automatically and downloadable at
[shiny-hoppy-meeple.pages.dev/qr-codes.pdf](https://shiny-hoppy-meeple.pages.dev/qr-codes.pdf).
It is regenerated whenever the main library changes, so it always matches the current collection —
print it, cut along the guides, and stick the codes on the boxes. For most needs this is all you
want.

To hand-make a sticker for a single game instead, you need its scan URL:

```text
https://shiny-hoppy-meeple.pages.dev/p/<game-slug>
```

The game slug is roughly the game's name in lowercase with spaces replaced by hyphens (punctuation
is dropped). Confirm the exact slug by visiting the game's page on the site and copying the last
part of its URL.

Ask a maintainer if you are unsure of the correct slug, or if you need stickers reprinted after a
game is renamed.

---

## Play count resets and corrections

Play counts are stored permanently and cannot be edited through the Google Sheet or Google Calendar.
If a count needs to be corrected (for example, after a sticker is printed with a wrong slug), a
developer will need to update the count directly. Contact a maintainer to arrange this.
