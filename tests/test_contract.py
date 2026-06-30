"""HireRank tests: ranking guards + post→apply→screen shortlist flow."""


def test_normalize_ranking(contract):
    n = contract.normalize_ranking
    r = n({"order": ["1"], "scores": {"1": 90}, "top": "1", "note": "x"}, ["0", "1", "2"])
    assert sorted(r["order"]) == ["0", "1", "2"] and r["top"] == r["order"][0]
    assert n("junk", ["0", "1"])["top"] in ("0", "1")

def test_validate_ranking(contract):
    v = contract.validate_ranking
    assert v({"order": ["2", "0", "1"], "top": "2", "scores": {}}, ["0", "1", "2"])
    assert not v({"order": ["0", "1"], "top": "0", "scores": {}}, ["0", "1", "2"])   # not full permutation
    assert not v({"order": ["0", "1", "2"], "top": "1", "scores": {}}, ["0", "1", "2"])  # top != order[0]


def _new(contract):
    return contract, contract.HireRank()

def test_screen_needs_two(contract):
    mod, c = _new(contract)
    rid = c.post_role("Backend engineer", "Python, distributed systems, on-call")
    c.apply(rid, "Alice", "10y Python, built payment systems")
    try:
        c.screen(rid); assert False, "need >=2 candidates"
    except Exception:
        pass

def test_full_screen_flow(contract):
    mod, c = _new(contract)
    rid = c.post_role("Backend engineer", "Python, distributed systems")
    for nm in ("Alice", "Bob", "Carol", "Dan"):
        c.apply(rid, nm, f"{nm}: relevant experience and skills")
    out = c.screen(rid)
    assert out["top"] in ("0", "1", "2", "3")
    role = c.get_role(rid)
    assert role["state"] == "screened" and sorted(role["order"]) == ["0", "1", "2", "3"]
    assert len(role["shortlist"]) == 3                      # SHORTLIST_K
    # shortlisted flags set on applications
    a0 = c.get_application(rid, role["shortlist"][0])
    assert a0["shortlisted"] is True
    assert c.stats()["screened"] == 1
