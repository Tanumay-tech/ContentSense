"""End-to-end API tests (FastAPI TestClient)."""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        c.post("/api/data/reset")
        yield c


def test_no_data_state(client):
    r = client.get("/api/overview")
    assert r.status_code == 409
    assert r.json()["code"] == "no_data"


def test_load_demo_and_status(client):
    r = client.post("/api/data/load-demo")
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["analysis_ready"] and s["market_loaded"] and s["records_analyzed"] > 1000
    p = s["pipeline"]
    assert p["cleaning"]["duplicates_removed"] > 0
    assert p["features"]["features_extracted"] > 100
    assert p["clustering"]["clusters_generated"] == 5


def test_overview(client):
    o = client.get("/api/overview").json()
    k = o["kpis"]
    assert k["total_content"] > 1000 and k["topics_identified"] == 5
    assert k["avg_engagement"] > 0 and k["opportunities_detected"] >= 1
    assert len(o["insights"]) == 4 and len(o["topic_distribution"]) == 5
    assert o["top_opportunity"]["topic"] == "AI Agents"


def test_content_search_filter_sort_detail(client):
    r = client.get("/api/content", params={"q": "ai agents", "sort": "engagement", "order": "desc"}).json()
    assert r["total"] > 0
    engs = [i["engagement"] for i in r["items"] if i["engagement"] is not None]
    assert engs == sorted(engs, reverse=True)
    plat = client.get("/api/content", params={"platform": "LinkedIn", "page_size": 200}).json()
    assert plat["total"] > 0 and all(i["platform"] == "LinkedIn" for i in plat["items"])
    dated = client.get("/api/content", params={"start": "2026-01-01", "end": "2026-01-31", "page_size": 200}).json()
    assert all("2026-01-01" <= i["date"] <= "2026-01-31" for i in dated["items"])
    d = client.get(f"/api/content/{r['items'][0]['id']}").json()
    assert "ai agent" in (d["title"] + " " + d["content"]).lower()
    assert d["keywords"] and d["cluster"] >= 0 and d["content"]
    assert client.get("/api/content/NOPE").status_code == 404


def test_content_export(client):
    r = client.get("/api/content/export", params={"platform": "Blog"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert r.text.splitlines()[0].startswith("id,date,platform")


def test_topics_and_scatter(client):
    t = client.get("/api/topics").json()
    assert len(t["topics"]) == 5 and t["topics"][0]["representative"]
    s = client.get("/api/topics/scatter").json()
    assert len(s["points"]) > 100 and {"x", "y", "topic", "preview"} <= set(s["points"][0])
    assert client.get("/api/topics/export").status_code == 200


def test_rerun_with_different_k(client):
    r = client.post("/api/analysis/run", json={"n_clusters": 7})
    assert r.status_code == 200 and r.json()["n_clusters"] == 7
    assert len(client.get("/api/topics").json()["topics"]) == 7
    assert client.post("/api/analysis/run", json={"n_clusters": 1}).status_code == 422
    client.post("/api/analysis/run", json={"n_clusters": 5})


def test_keywords_with_filters(client):
    k = client.get("/api/keywords").json()
    assert k["frequent"] and k["important"] and k["bigrams"] and k["trigrams"]
    topic = client.get("/api/topics").json()["topics"][0]["name"]
    f = client.get("/api/keywords", params={"topic": topic}).json()
    assert 0 < f["records"] < k["records"]


def test_engagement(client):
    e = client.get("/api/engagement").json()
    assert e["meta"]["mode"] == "rate"
    assert e["by_topic"] and e["by_platform"] and e["distribution"] and e["top_content"]
    assert e["highlights"]["best_topic"] and e["insights"]


def test_content_trends(client):
    t = client.get("/api/trends/content", params={"granularity": "week"}).json()
    assert t["available"] and t["comparison_available"] and t["volume"]
    assert {r["direction"] for r in t["topic_trends"]} <= {"Increasing", "Stable", "Decreasing", "Insufficient data"}
    short = client.get("/api/trends/content", params={"start": "2026-09-10", "end": "2026-09-19"}).json()
    assert short["comparison_available"] is False


def test_market_and_forecast(client):
    m = client.get("/api/trends/market").json()
    assert len(m["topics"]) >= 10 and m["trending_now"]
    statuses = {t["status"] for t in m["topics"]}
    assert "Declining" in statuses and ("Growing" in statuses or "Emerging" in statuses)
    ok = client.get("/api/trends/market/AI Agents").json()
    assert ok["forecast"]["available"] and ok["forecast"]["points"]
    short = client.get("/api/trends/market/AI Search Optimization").json()
    assert short["forecast"]["available"] is False
    assert short["forecast"]["reason"] == "Insufficient history for reliable forecasting."
    assert client.get("/api/trends/market/Nope").status_code == 404


def test_opportunities(client):
    o = client.get("/api/opportunities").json()
    ops = o["opportunities"]
    assert ops[0]["topic"] == "AI Agents" and ops[0]["band"] == "Strong Opportunity"
    assert all(0 <= x["score"] <= 100 for x in ops)
    assert [x["score"] for x in ops] == sorted([x["score"] for x in ops], reverse=True)
    assert client.get("/api/opportunities/export").status_code == 200


def test_csv_upload_flow(client):
    rows = ["id,date,platform,content,likes,comments,shares,views"]
    words = ["ai marketing automation tools", "fitness workout recovery plan", "travel guide lisbon food",
             "budget savings money tips", "sustainable packaging carbon waste"]
    for i in range(60):
        rows.append(f"{i},2025-{1 + i % 12:02d}-10,X,{words[i % 5]} post number {i},{i},{i % 5},{i % 3},{100 + i}")
    r = client.post("/api/data/upload", files={"file": ("mine.csv", "\n".join(rows), "text/csv")})
    assert r.status_code == 200, r.text
    assert r.json()["validation"]["rows"] == 60
    assert client.get("/api/overview").status_code == 409  # uploaded but not analysed
    run = client.post("/api/analysis/run", json={"n_clusters": 5})
    assert run.status_code == 200 and run.json()["records_analyzed"] == 60


def test_invalid_uploads(client):
    bad = client.post("/api/data/upload", files={"file": ("x.csv", "id,likes\n1,2\n", "text/csv")})
    assert bad.status_code == 422 and "content" in bad.json()["detail"]
    empty = client.post("/api/data/upload", files={"file": ("x.csv", "", "text/csv")})
    assert empty.status_code == 422
    tiny = client.post("/api/data/upload", files={"file": ("t.csv", "content\nhello marketing world\nsecond ai post here\n", "text/csv")})
    assert tiny.status_code == 200
    run = client.post("/api/analysis/run", json={"n_clusters": 5})
    assert run.status_code == 422 and run.json()["code"] == "insufficient_data"
    badm = client.post("/api/market-data/upload", files={"file": ("m.csv", "topic,foo\nA,1\n", "text/csv")})
    assert badm.status_code == 422


def test_reset(client):
    s = client.post("/api/data/reset").json()
    assert not s["content_loaded"] and not s["analysis_ready"]
    client.post("/api/data/load-demo")
