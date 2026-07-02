# Scans and play counts

This guide explains how the site tracks game plays — both through QR sticker scans at events and
through plays logged by members.

---

## QR sticker scans

Physical game boxes in the club's collection have QR sticker labels on them. When someone at an
event scans one of these stickers with their phone, two things happen simultaneously:

1. The scan is recorded as a **public play** for that game.
2. The visitor is redirected to that game's page on the website.

The sticker URL takes the form `/p/<game-slug>` or `/lets-play/<game-slug>` — both do exactly the
same thing. Having two formats allows flexibility if different batches of stickers are printed at
different times.

> [!NOTE]
> A scan is only recorded if the game is present in at least one active collection or library. Scans
> for games not in the site will still redirect the visitor, but the play will not be counted.

---

## Member plays

Separately from QR scans, members can log their own plays through the website. These are tracked
independently and show up as **member plays** on the game's page.

The site uses member plays — not QR scans — to calculate each game's **SHM Rank**. A game ranked
#1 is the one members have collectively logged the most plays of.

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
> stop logging plays to the right place.** The sticker will still redirect visitors to the game
> page, but the scan will be counted against the old slug, which may no longer exist. Finalise a
> game's name in BoardGameGeek before printing QR stickers for it.

---

## Getting new stickers printed

To get a QR sticker for a game, you need its scan URL. The format is:

```
https://shiny-hoppy-meeple.pages.dev/p/<game-slug>
```

The game slug is the game's name in lowercase with spaces replaced by hyphens. You can confirm the
correct slug by visiting the game's page on the site and copying the last part of its URL.

Ask a maintainer if you are unsure of the correct slug, or if you need stickers reprinted after a
game is renamed.

---

## Play count resets and corrections

Play counts are stored permanently and cannot be edited through the Google Sheet or Google Calendar.
If a count needs to be corrected (for example, after a sticker is printed with a wrong slug), a
developer will need to update the count directly. Contact a maintainer to arrange this.
