# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
HireRank — rubric-scored candidate shortlisting by GenLayer consensus.

Post a role with a scoring rubric; candidates apply with a pitch. `screen` has
every validator independently score ALL candidates against the rubric and rank
them; the result is accepted only when validators agree on the TOP candidate
(comparative equivalence on the top id — substance, not field shape). The top of
the ranking becomes the shortlist.

The verb is "rank candidates against a rubric → shortlist" — an ordinal, multi-
criterion screen, distinct from a single pass/fail or a binary verdict.
"""
import json
from genlayer import *

SHORTLIST_K = 3


def normalize_ranking(raw, valid_ids) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    valid = [str(i) for i in valid_ids]
    order_in = raw.get("order")
    order = [str(x) for x in order_in if str(x) in valid] if isinstance(order_in, list) else []
    for i in valid:
        if i not in order:
            order.append(i)
    scores_in = raw.get("scores") if isinstance(raw.get("scores"), dict) else {}
    scores = {}
    for i in valid:
        s = scores_in.get(i)
        if not isinstance(s, int) or isinstance(s, bool):
            s = 0
        scores[i] = max(0, min(100, s))
    note = raw.get("note")
    note = note[:500] if isinstance(note, str) and note.strip() else "no note"
    top = order[0] if order else ""
    return {"order": order, "scores": scores, "top": top, "note": note}


def validate_ranking(data, valid_ids) -> bool:
    if not isinstance(data, dict):
        return False
    valid = sorted(str(i) for i in valid_ids)
    order = data.get("order")
    if not isinstance(order, list) or sorted(str(x) for x in order) != valid:
        return False
    if data.get("top") not in [str(x) for x in order]:
        return False
    return not order or data["top"] == str(order[0])


class HireRank(gl.Contract):
    roles: TreeMap[str, str]
    apps: TreeMap[str, str]       # "role:idx" -> application json
    role_count: u256
    screened_count: u256

    def __init__(self):
        self.role_count = u256(0)
        self.screened_count = u256(0)

    @gl.public.write
    def post_role(self, title: str, rubric: str) -> str:
        title = str(title).strip()
        rubric = str(rubric).strip()
        if not title or not rubric:
            raise Exception("title and rubric required")
        key = str(int(self.role_count))
        rec = {
            "poster": str(gl.message.sender_address),
            "title": title[:160],
            "rubric": rubric[:800],
            "state": "open",          # open -> screened
            "app_count": 0,
            "order": [],
            "scores": {},
            "shortlist": [],
            "note": "",
        }
        self.roles[key] = json.dumps(rec)
        self.role_count += u256(1)
        return key

    @gl.public.write
    def apply(self, role_id: str, candidate: str, pitch: str) -> str:
        role_id = str(role_id)
        if role_id not in self.roles:
            raise Exception("unknown role")
        r = json.loads(self.roles[role_id])
        if r["state"] != "open":
            raise Exception("role closed for applications")
        candidate = str(candidate).strip()
        pitch = str(pitch).strip()
        if not candidate or not pitch:
            raise Exception("candidate and pitch required")
        idx = int(r["app_count"])
        self.apps[f"{role_id}:{idx}"] = json.dumps({
            "applicant": str(gl.message.sender_address),
            "candidate": candidate[:120],
            "pitch": pitch[:1200],
            "score": 0,
            "shortlisted": False,
        })
        r["app_count"] = idx + 1
        self.roles[role_id] = json.dumps(r)
        return str(idx)

    @gl.public.write
    def screen(self, role_id: str) -> dict:
        role_id = str(role_id)
        if role_id not in self.roles:
            raise Exception("unknown role")
        r = json.loads(self.roles[role_id])
        n = int(r["app_count"])
        if n < 2:
            raise Exception("need at least 2 candidates to screen")

        cands = []
        for i in range(n):
            a = json.loads(self.apps[f"{role_id}:{i}"])
            cands.append({"id": str(i), "candidate": a["candidate"], "pitch": a["pitch"]})

        ranking = self._rank(r["title"], r["rubric"], cands)
        shortlist = ranking["order"][:SHORTLIST_K]
        r["order"] = ranking["order"]
        r["scores"] = ranking["scores"]
        r["shortlist"] = shortlist
        r["note"] = ranking["note"]
        r["state"] = "screened"
        self.roles[role_id] = json.dumps(r)

        for i in range(n):
            a = json.loads(self.apps[f"{role_id}:{i}"])
            a["score"] = ranking["scores"].get(str(i), 0)
            a["shortlisted"] = str(i) in shortlist
            self.apps[f"{role_id}:{i}"] = json.dumps(a)

        self.screened_count += u256(1)
        return {"role": role_id, "top": ranking["top"], "shortlist": shortlist}

    def _rank(self, title: str, rubric: str, cands) -> dict:
        ids = [c["id"] for c in cands]
        block = "\n".join(f"[{c['id']}] {c['candidate']}: {c['pitch'][:500]}" for c in cands)

        def do_rank() -> str:
            prompt = f"""You are a hiring screener. Score every candidate against the RUBRIC and rank them best-to-worst.

ROLE: {title}
RUBRIC: {rubric}

CANDIDATES (id in brackets):
{block}

Reply ONLY JSON: {{"order": [<ids best-to-worst>], "scores": {{"<id>": <int 0-100>}}, "top": "<best id>", "note": "<why the top pick>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                try:
                    raw = json.loads(str(raw))
                except Exception:
                    raw = {}
            return json.dumps(normalize_ranking(raw, ids))

        result = gl.eq_principle.prompt_comparative(
            do_rank,
            principle="The 'top' (best candidate id) must be identical across validators. Lower-rank order and exact scores may differ slightly.",
        )
        data = json.loads(result) if isinstance(result, str) else result
        if not validate_ranking(data, ids):
            data = normalize_ranking(data if isinstance(data, dict) else {}, ids)
        return data

    @gl.public.view
    def get_role(self, role_id: str) -> dict:
        role_id = str(role_id)
        if role_id not in self.roles:
            return {"exists": False}
        r = json.loads(self.roles[role_id])
        r["exists"] = True
        return r

    @gl.public.view
    def get_application(self, role_id: str, idx: str) -> dict:
        k = f"{str(role_id)}:{str(idx)}"
        if k not in self.apps:
            return {"exists": False}
        a = json.loads(self.apps[k])
        a["exists"] = True
        return a

    @gl.public.view
    def stats(self) -> dict:
        return {"total_roles": int(self.role_count), "screened": int(self.screened_count)}
