---
title: NoNotes
thumbnail: nonotes.webp
description: >-
  Record a class, and get a transcript plus a short set of notes back.
stack: "Python · Flask · BERT · SQLite · JavaScript"
supplemental_links:
  - text: Submission
    link: https://devpost.com/software/noname-pht40q
    primary: true
  - text: Repo
    link: https://github.com/Alex-Jando/HappyHack-Oct2023
---

**NoNotes** turns a recording into notes you can revise from. You upload a file or talk into the microphone. The app transcribes the audio, puts the punctuation back, and keeps the sentences worth rereading.

We built it at Happy Hacks II, where it took **1st place** among **80+** hackers.

### How it works
The browser records or accepts the audio and sends it to a Flask API. Python splits the clip into pieces speech recognition can take, stitches the transcript together, then runs a punctuation model so the text has real sentence boundaries. A BERT extractive summarizer ranks those sentences and returns the summary. The notes can be saved in SQLite under a URL-safe id.

### What I worked on
I co-developed the app: the audio transcription pipeline, the Flask API, and connecting it with the front end.

### Video
<div class="project-slides py-4">
  <div class="ratio ratio-16x9 overflow-hidden">
    <iframe
      src="https://www.youtube.com/embed/EBiBeUzb0xY?rel=0&controls=1&modestbranding=1"
      title="NoNotes demo"
      allowfullscreen
      loading="lazy"></iframe>
  </div>
</div>
