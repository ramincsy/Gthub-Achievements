# Clean two-account pair workflow

This checklist keeps a small collaborative change attributable to two human GitHub accounts.

1. Start a short-lived branch from `main` and keep the change focused on one useful documentation or code improvement.
2. Make the change as `ramincsy`, then create one commit with a clear subject, a short rationale in the body, and both verified trailers:

   ```text
   Co-authored-by: ramincsy <34828058+ramincsy@users.noreply.github.com>
   Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>
   ```

3. Open a pull request targeting `main`. Have `backrebital-lgtm` review the actual diff and approve it from that account.
4. Merge without squashing when possible, so the original commit message and trailers remain intact. If a squash is required, copy both trailers into the squash message.
5. On `main`, open the resulting commit and verify the two trailer lines, the expected human authors, and the absence of unrelated automation identities.

Keeping authorship in the commit message and checking the landed commit—not only the pull request—makes the collaboration auditable and reproducible.
