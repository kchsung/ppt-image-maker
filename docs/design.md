# QLEARN Design Notes

Use calm, dense, work-focused UI for operational tools. Prefer tokenized colors from `src/theme.css` and Tailwind utility classes over raw hex values.

## Tokens

- `bg-background`: app canvas
- `bg-surface`: panels and cards
- `text-text-main`: primary copy
- `text-text-subtle`: secondary copy
- `bg-primary`: primary actions and emphasis
- `bg-accent`: warm highlights
- `border-border`: panel and control borders

## Patterns

- Keep pages scannable: compact headers, clear panels, predictable actions.
- Use cards only for individual items or framed tools.
- Use `lucide-react` icons in controls.
- Keep forms short and label every input.
