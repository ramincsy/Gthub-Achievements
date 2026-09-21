# Collaboration checklist

Use this checklist for small, reviewable changes made with a second human contributor.

## Before opening a pull request

- Keep the change focused and explain the user-facing reason in the pull request.
- Run the repository's documented checks locally and include the results in the description.
- Use a short subject line and put each `Co-authored-by:` trailer in the commit footer, after a blank line.
- Use only verified human noreply addresses; do not add automation or bot trailers.

## Before merging

- Ask the second contributor to review the diff and the checks.
- Prefer **Create a merge commit** in the GitHub merge menu (avoid squash when you need trailers preserved on `main`).
- After merging, open the commit on `main` and confirm both contributor identities are visible.

## Example footer

```
Co-authored-by: Contributor One <12345+contributor-one@users.noreply.github.com>
Co-authored-by: Contributor Two <67890+contributor-two@users.noreply.github.com>
```
