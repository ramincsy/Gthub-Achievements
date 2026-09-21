# Pair review flow

A lightweight handoff keeps a small change auditable:

1. The opener explains the intent and scope in the pull request.
2. The reviewer checks the diff and the relevant local command.
3. The merger uses **Create a merge commit** (not squash) so co-author trailers stay on `main`.
4. After merge, open the landed commit and confirm both contributor identities are shown.
