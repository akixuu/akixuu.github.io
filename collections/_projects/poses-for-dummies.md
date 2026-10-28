---
title: Poses for Dummies
thumbnail: poses.webp
description: >-
  A two-player party game where one person's body is the controller and the
  other draws the poses they have to match.
stack: "TypeScript · React · MediaPipe · WebSockets · Cloudflare"
gallery_dir: poses
gallery_title: Screens
supplemental_links:
  - text: Submission
    link: https://2026.quackhacks.org/projects/poses-for-dummies
    primary: true
  - text: Repo
    link: https://github.com/mileshs/quackhacks3
---

**Poses for Dummies** is a two-player game. One player, the athlete, stands in front of a webcam and fits their body through pose-shaped holes, Hole-in-the-Wall style. The other player, the saboteur, draws those poses by dragging a ragdoll, or rolls a random one. After a track of about thirty walls, they swap devices and roles. The higher score wins.

We built it at QuackHacks, where we placed **3rd** in the game development track, among **220+** hackers.

### How it works
MediaPipe reads the athlete's skeleton. The game throws away raw pixel distances and keeps the angles between joints, so every body is drawn as the same dummy, with no calibration step. The score is how closely those angles match the hole.

### What I worked on
Pose tracking on the client, and the socket path that sends that pose to the other player. Streaming and vision settings so a full round stays playable.

### Video
<div class="project-slides py-4">
  <div class="ratio ratio-16x9 overflow-hidden">
    <iframe
      src="https://www.youtube.com/embed/YFmhCacJdOo?rel=0&controls=1&modestbranding=1"
      title="Poses for Dummies demo"
      allowfullscreen
      loading="lazy"></iframe>
  </div>
</div>
