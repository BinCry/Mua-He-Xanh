# UI synchronization report

- Journey cards use a balanced two-column laptop layout and one column on mobile; no intentional 3+1 four-card layout remains.
- Mood choices are direct state transitions: deselecting `Sống Chậm` removes its selected class before another card is selected. The behavior has Chromium E2E coverage.
- Public Shop and Workshop are separate routes and navigation targets. Shop exposes direct contact rather than checkout; Workshop exposes session booking and its own customer/staff screens.
- Public Shop/Workshop/Festival pages passed overflow and page-error checks at 320, 390, 768, 1366 and 1440 px in Chromium, Firefox and WebKit.
- Review content is inserted through DOM text nodes; stored public descriptions, check-in messages, staff booking rows and Studio slot attributes are escaped.

Remaining acceptance work: keyboard/modal walkthroughs beyond the covered flows, cross-tab synchronization, PWA offline/reconnect and full manager/admin responsive workflows.

Final regression evidence: 24/24 responsive and 54/54 functional browser cases passed serially across Chromium, Firefox and WebKit without retry. Default Vietnamese pages no longer auto-load translation or remote icon fonts.
