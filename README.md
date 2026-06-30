# HireRank

**Rubric-scored candidate shortlisting by GenLayer consensus.**

Post a role with a scoring rubric; candidates apply with a pitch. `screen` has every validator
independently score **all** candidates against the rubric and rank them; the result is accepted only
when validators agree on the **top candidate** (comparative equivalence on the top id — substance, not
field shape). The top of the ranking becomes the shortlist.

The verb is **"rank candidates against a rubric → shortlist"** — an ordinal, multi-criterion screen,
distinct from a single pass/fail or binary verdict.

- **Contract (Bradbury, chain 4221):** `0xAa7F6A0a052054afb32919ad22a03905637E4Ecd`
- **Deployed from:** `rivale` (`0xc388…51A44`)
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0xAa7F6A0a052054afb32919ad22a03905637E4Ecd

---

## Why GenLayer is essential

Screening candidates against a rubric is subjective, multi-criterion judgment — not something a
deterministic EVM can do. GenLayer has many validators score the same pool and agree on the ranking,
producing a reproducible, less-gameable shortlist than a single recruiter's call.

## Workflow

| Step | Method | What happens |
| --- | --- | --- |
| Post | `post_role(title, rubric)` | Opens a role with a scoring rubric. |
| Apply | `apply(role_id, candidate, pitch)` | A candidate enters with a pitch. |
| Screen | `screen(role_id)` | Consensus ranks all candidates; top `K` = shortlist. |
| Read | `get_role(id)` / `get_application(id, idx)` / `stats()` | Ranking, scores, shortlist. |

### Correctness check

`_rank` wraps the ranking in **`gl.eq_principle.prompt_comparative`** — principle: *"the top (best
candidate id) must be identical across validators."* `validate_ranking` requires `order` to be a **full
permutation** of the candidate ids with `top == order[0]`; `normalize_ranking` repairs partial output
and clamps 0–100 scores. The shortlist is the deterministic top `SHORTLIST_K` of the agreed order.
Unit-tested incl. the full post→apply→screen flow + a min-candidates guard.

## Architecture

```
HireRank/
├── contracts/hire_rank.py  ← GenLayer Intelligent Contract (consensus rubric ranking + shortlist)
├── tests/                  ← pytest: ranking guards, min-candidates, full screen flow
└── app/                    ← React + Vite + Tailwind v4 + Framer Motion (21st.dev style)
                              fuchsia hiring theme, role board + ranked candidates + shortlist medals
```

## Tests

```bash
cd HireRank
python3 -m venv .venv && .venv/bin/pip install pytest -q
.venv/bin/python -m pytest tests/ -q
```
Covers `normalize_ranking` / `validate_ranking` (full-permutation + top gate), a min-candidates guard,
and a full **post → apply ×4 → screen** run with shortlist flags (shim auto-inits `TreeMap`). **On-chain
smoke-tested:** `post_role` write + `get_role` read verified live on Bradbury.

## Deploy

```bash
genlayer deploy --contract contracts/hire_rank.py
```
