# VoxArena — Getting Songs Without Copyright Issues

You need **backing tracks** (and ideally stems + reference pitch data) that players sing along to. Here are practical ways to get them without running into copyright trouble.

---

## 1. Original or Commissioned Music (safest, no third‑party rights)

**Idea:** You own or have full rights to the recording and composition.

| Approach | Pros | Cons |
|----------|------|------|
| **Commission a composer/artist** | Full buyout possible; you get stems + can generate reference pitch; no publisher/label clearance | Cost per track (often $200–500+ per minute for indie); need a brief and clear deliverables (full mix, stems, no vocals) |
| **Create your own** | No licensing cost; full control | Requires production skills and time |
| **Partner with indie artists** | Unique catalog; sometimes rev-share or one-off fee | Need a clear contract: sync, master, right to create instrumental/stems and use in an interactive singing game |

**Deliverables to specify:** Full backing track (no lead vocal), optional stems, and either reference MIDI/notes or permission to derive pitch data for scoring.

**Best for:** MVP and small catalog (e.g. Phase 1 “one song”). Scales if you sell song packs later (MONETIZATION.md).

---

## 2. Suno AI (generated music — paid plan required)

**Idea:** Use [Suno](https://suno.com) to generate backing tracks and derive reference pitch. With a **paid plan (Pro or Premier)** you get commercial rights, including sync for games.

| What you need | How Suno helps |
|---------------|-----------------|
| **Backing track (no lead vocal)** | Use Suno’s **AI instrumental generator** for backing-only tracks, or generate a full song and use **stem separation** (vocals + instrumental) and keep the instrumental. |
| **Reference pitch / notes** | Export **stems** and use **MIDI export** (Suno can export MIDI from stems). Use that MIDI as the reference melody for your scoring engine, or run your pitch pipeline (CREPE/PYIN) on a reference take to build note boundaries. |
| **Commercial / game use** | On **Pro or Premier**, you own the generated music and get a commercial license that includes **sync for games**. Free-tier output is not licensed for commercial use. |

**Important:**

- **Paid subscription required** — Commercial rights only for music created while on Pro or Premier. Music created on the free plan does not get upgraded retroactively.
- **Read current terms** — Check [Suno’s terms](https://suno.com/terms) and commercial terms for your region and use (games, interactive, redistribution).
- **Reference melody** — For scoring you need “what note at what time.” Either: (1) generate a full song in Suno, export the vocal stem, convert to MIDI/notes with your pitch pipeline or a tool, then use the instrumental as backing; or (2) create an instrumental in Suno and separately define reference notes (e.g. in your editor or from a MIDI you author).

**Best for:** MVP and quick iteration: cheap way to get original backing tracks + reference data without commissioning. Confirm current Suno terms before shipping.

---

## 3. Royalty‑Free / Production Music (check the license)

**Idea:** Use tracks from libraries that sell commercial licenses.

| Source | Typical use | Caveat for singing games |
|--------|-------------|---------------------------|
| **Epidemic Sound, Artlist, etc.** | Background music, trailers, games | License often covers “game use” but may **not** explicitly allow “user performs over this track” or “karaoke-style use”. You must read the terms and, if unsure, ask. |
| **Libraries that offer “instrumental” or “stems”** | Easier to get backing-only | Same: confirm “interactive singing / karaoke” is allowed. |
| **IndieGameMusic.com, Bensound, etc.** | Indie game soundtracks | Again: check if use includes “player sings along to this track” and derivation of pitch/lyrics. |

**Important:** “Royalty-free” does not automatically mean “any use.” For a singing game you are doing **derivative use** (instrumental, pitch reference, possibly lyrics). Get written confirmation or a license that explicitly allows this.

**Best for:** Filling a catalog once you’ve confirmed the license covers singing-game use.

---

## 4. Proper Karaoke / Sync Licensing (commercial hits)

**Idea:** License known songs for karaoke-style use (backing track + lyrics + scoring).

- You need **synchronization rights** (composition: melody, lyrics) and **master use rights** (specific recording), or a **re-recording** with only sync rights.
- In some territories, **KAR-type licenses** (e.g. PRS for Music) cover mechanical/sync and lyrics for karaoke products; **prior approval** from rights holders is often required.
- Many **publishers/writers have excluded** their catalog from standard karaoke schemes (e.g. certain Warner, Sony, EMI works). You must check exclusions.
- **Cost and process:** Non-trivial; usually per track, per territory, with reporting. Realistic for a funded product with a “songs people know” strategy.

**Best for:** Later, when you have budget and want recognizable hits. Not ideal for MVP.

---

## 5. Public Domain and Creative Commons (limited but free)

| Type | What you can use | Limitation |
|------|-------------------|------------|
| **Public domain compositions** | Old classical, some folk (e.g. “Auld Lang Syne”). Score is PD; **recordings** usually still under copyright. | You need a **PD recording** or your own recording of the PD composition. Few “backing track” style recordings. |
| **Creative Commons** | Tracks under CC that allow **commercial + derivative** use (e.g. CC BY, CC BY-SA). | Instrumental/stem versions and pitch data are rare; you must attribute and follow the license. |

**Best for:** A couple of PD/CC tracks for demos or free tiers; not a full catalog strategy.

---

## 6. Practical Recommendation for VoxArena

| Phase | Suggested approach |
|-------|----------------------|
| **Phase 1 (MVP, one song)** | **Suno (paid plan)** or **one original/commissioned track**. Suno: generate instrumental (or full song → instrumental stem) + export MIDI or derive reference pitch; fast and low-cost. |
| **Phase 2+ (more songs)** | Mix of: (a) more Suno or commissioned/original, (b) royalty-free tracks where the license **explicitly** allows singing-game/derivative use, (c) later: proper karaoke/sync licensing for known hits if you have budget. |
| **Monetization (song packs)** | Sell packs of tracks you have **clearly licensed** (Suno paid output, original, commissioned, or royalty-free with the right terms). No use of unlicensed commercial recordings. |

---

## 7. What to Document Per Track

- **Source:** Original / commissioned / royalty-free / licensed (KAR/sync).
- **Rights:** Who granted, what use (e.g. “interactive singing game, backing track + pitch reference, commercial”).
- **Restrictions:** Territory, platform, attribution, no-edit clauses.
- **Stems / reference:** Whether you have (or are allowed to create) instrumental and pitch data.

---

## 8. Disclaimer

This doc is **not legal advice**. Music licensing differs by country and use case. For commercial release and any licensing deal, consult a **music or game lawyer** or a **licensing specialist**.

---

**Summary:** For MVP, **Suno (paid plan)** is a strong option: generate instrumentals and get reference pitch via stem/MIDI export; commercial rights include game sync. Alternatively use one **original or commissioned** track. Add royalty-free or licensed catalog later once terms explicitly allow singing-game use.
