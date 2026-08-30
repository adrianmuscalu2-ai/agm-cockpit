# Basic Librarian impact

## AS-IS

Basic Librarian is a linguistic/reusable-content authority in the application:

- agent ID: `agent-linguistic-librarian`;
- scope: Basic/PRE-005 language, reusable messages and professional terminology;
- human confirmation remains mandatory;
- it does not apply changes automatically;
- its baseline is protected by three recorded file hashes;
- it is explicitly distinct from `agm-central-librarian`.

It is not a legal, Tacho, routing, toll, evidence-custody or canonical-source authority.

## Options assessed

| Basic option | Benefit | Risk | Verdict |
|---|---|---|---|
| Remain fully separate | Preserves validated scope and avoids authority confusion | Terminology updates remain a separate publication workflow | **RECOMMENDED NOW** |
| Read Central Registry views directly | Potential access to domain terminology | Couples Basic UI/runtime to documentary schemas and may expose unreviewed/legal material | NO-GO |
| Consume a published subset | Controlled future reuse of approved public terminology/messages | Requires a new export contract, content classification and explicit Basic mandate | CONDITIONAL FUTURE OPTION |
| Merge with AGM Central Librarian | Fewer named components | Conflates linguistic authority with evidence/governance; breaks baseline | REJECTED |

## Recommended boundary

Basic remains unchanged and does not query the Central Registry or specialized views directly.

If a demonstrated product need later exists, Central governance may publish a **linguistic export package** containing only approved, non-sensitive terminology/message material. The package would be:

- generated from explicit source IDs and approved derived terminology;
- versioned and hashed;
- non-authoritative for legal/operational decisions;
- imported through the existing Basic human-confirmation workflow;
- optional and backward compatible;
- unable to modify Basic automatically.

This is not part of the recommended migration now.

## Impact by specialized domain

| Domain | Direct Basic impact now | Potential future interaction |
|---|---|---|
| Tacho | NONE | Approved glossary only, never live applicability rules |
| Legislation / Safety | NONE | Plain-language terminology subset after legal/linguistic review |
| Routing / Toll | NONE | Reusable user-facing labels, not rates/restrictions authority |
| Car Mover | NONE | Approved messages/templates through existing Basic workflow |
| Documents / OCR / Evidence | NONE | User-facing extraction labels; never raw evidence by default |

## Risk conclusion

Changing Basic provides no concrete benefit required by this study and creates a high authority-boundary risk. The correct current decision is:

**BASIC LIBRARIAN = COMPLETELY SEPARATE / UNCHANGED**

Any future subset publication requires a separate impact study and mandate.
