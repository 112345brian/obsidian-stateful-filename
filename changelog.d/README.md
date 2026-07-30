# Changelog fragments

One file per change, added in the same commit/PR as the change itself,
compiled into `CHANGELOG.md` at release time by `towncrier build`.

**Filename**: `+<short-slug>.<type>.md` — the leading `+` marks it as an
orphan fragment (no issue number required). `<type>` is one of:

- `feature` — new capability
- `change` — a change to existing, user-visible behavior
- `fix` — bug fix
- `misc` — everything else worth mentioning (rename, refactor, config,
  internal tooling)

**Content**: one or two sentences, same voice as existing CHANGELOG.md
entries — lead with what changed, not why (the "why" belongs in the commit
message).

Example: `changelog.d/+add-retry-logic.fix.md`
```
API calls now retry with exponential backoff on 5xx responses instead of
failing the whole batch on the first transient error.
```

**Release recipe**:
```
towncrier build --version X.Y.Z --yes   # compiles fragments into CHANGELOG.md, deletes them
git add CHANGELOG.md changelog.d/
git commit -m "Update changelog for vX.Y.Z"
# bump manifest.json / package.json / versions.json to X.Y.Z
git commit -am "Release vX.Y.Z"
git push origin main --tags
```

The changelog build and the version bump stay in separate commits on
purpose: the changelog commit lands first and cleanly, then the version-bump
commit is its own atomic step.
