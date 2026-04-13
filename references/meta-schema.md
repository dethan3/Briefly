# Metadata Sidecar

When `raw/<basename>.meta.json` exists, use it to stabilize naming, title selection, and speaker attribution.

## Suggested schema

```json
{
  "title": "All-In Podcast E221",
  "source": "YouTube",
  "date": "2026-04-09",
  "language": "en",
  "hosts": ["Jason Calacanis"],
  "guests": ["Josh Shapiro"],
  "primary_guest": "Josh Shapiro",
  "speakers": ["Chamath", "Sacks", "Friedberg", "Jason"],
  "aliases": {
    "David Sacks": "Sacks",
    "Chamath Palihapitiya": "Chamath"
  },
  "topic_hint": "tariffs, AI infrastructure, macro"
}
```

## Field notes

- `title`: Preferred title for the final Markdown heading.
- `source`: Optional origin such as YouTube, Spotify, transcript export, or manual notes.
- `date`: ISO date if known.
- `language`: Main spoken language.
- `hosts`: Optional host or interviewer list. If more than one host is present, the normalizer may collapse unlabeled question/interjection turns to `Host/Panel?`.
- `guests`: Optional guest list.
- `primary_guest`: Preferred single guest label when a long-form interview has one main respondent.
- `speakers`: Canonical speaker names to prefer in summaries.
- `aliases`: Map transcript variants or full legal names to the canonical short label.
- `topic_hint`: Optional short hint to orient the summary, not a hard instruction.

## Usage rules

- Treat the sidecar as metadata, not source truth over the transcript.
- Use aliases to normalize speaker names in the final briefing.
- If `hosts`, `guests`, or `primary_guest` are present, the normalizer may attach them as `speaker_guess` labels to unlabeled `question_candidate` or `respondent_candidate` turns.
- If metadata conflicts with the transcript, prefer the transcript and call out the mismatch only if it affects the summary.
