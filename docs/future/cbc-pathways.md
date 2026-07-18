# CBC Pathways And Template Versioning

## Template Versioning

New assessment templates now carry a `version` and `supersedes_template_id`. Generated reports store:

- `template_version`
- `template_snapshot`

This prevents future template changes from mutating historical reports.

## Senior School Pathway Model

Future senior school support should model:

- Pathway: STEM, Social Sciences, Arts and Sports Science.
- Track.
- Core subjects.
- Optional subjects.
- Learner selections.
- School-offered subject catalog.

## Compatibility Rule

Do not remove existing `pathway` fields. Add richer senior-school structures beside the current fields and migrate gradually.
