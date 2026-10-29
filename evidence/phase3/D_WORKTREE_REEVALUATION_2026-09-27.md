# D-worktree reevaluation

No worktree was deleted, cleaned, reset, pruned or modified.

| Worktree | HEAD | Phase 2 relationship | Dirty/untracked preservation | Verdict |
|---|---|---|---|---|
| `candidate7` | `d563aefd33fda8390b54649cc79ef736cbc180bc` | committed history is an ancestor of Phase 2 | seven language-dropdown evidence files match the evidence manifest | functional code superseded; evidence preserved; KEEP until separate cleanup authority |
| `quick-contacts-v150` | `489074a06fe01af32299d8fc048418fe8841d278` | committed history is an ancestor of Phase 2 | manifested AI/quick-contact/TURN evidence is preserved; non-manifest paths are present in Phase 2, with only newer canonical content or line-ending-only differences | superseded/equivalent; KEEP in this phase |
| `android_action_layer_20260913` | `b89045d198df5064e781c1ec92a74c73489f1ef9` | committed history is an ancestor of Phase 2 | all 13 dirty source files match remote archive `a23baa8a97d39a583bf7bab32fc2e9664336de4a` byte-for-byte | source fully preserved; KEEP in this phase |
| `premium_assistant_compat_20260913` | `4c0b1f0b8ae894da23ecd03ffa4978fe5f099970` | committed history is an ancestor of Phase 2 | manifested Gmail/source-separation/speech evidence matches; `evidence/speech-semantics/android-production/2026-09-13T08-12-44Z/agm-audio.log` SHA-256 `D65EF8071B5EE4C0B52C3C850DE729EE999E957854263FDA139F92F425F4FC37` is not in the Git evidence manifest | functional code superseded, but unique raw evidence remains local; **KEEP** |

The fourth worktree cannot be called fully superseded for cleanup while its raw audio chronology is not tied to the validated remote manifest/bundle. This is preservation conservatism, not a functional regression.

Verdict: **NO D-WORKTREE DELETE AUTHORIZED; all four remain intact**.
