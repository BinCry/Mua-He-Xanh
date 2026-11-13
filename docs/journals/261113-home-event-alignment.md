---
date: 2026-11-13
topic: home-event-alignment
---

# Homepage event alignment

- Desktop labels now share a width and height; featured cards fill their column like the upcoming panel.
- A ResizeObserver matches the upcoming panel to the featured card, excluding native scrollbar space. The measurement is cleared below the existing 992px breakpoint.
- Verified 27 local browser fixture cases across 9 viewport widths and empty/single/multiple upcoming events. Mobile/tablet geometry matched the baseline; desktop alignment, breakpoint resizing, and horizontal scrolling passed. All 159 existing tests passed.
- No active plan or API changes. Production deployment remains outstanding.
