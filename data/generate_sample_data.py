"""
Generate the ContentSense demo datasets.

    python data/generate_sample_data.py

Produces:
  data/sample_content.csv        ~1,900 synthetic social/web content records (brand's own content)
  data/sample_market_trends.csv  weekly synthetic market-interest index for 12 marketing topics

Everything here is SYNTHETIC demo data generated with a fixed random seed.
It is designed to be realistic rather than perfect:
  * topics overlap (AI posts mention marketing, promo posts span categories)
  * categories are noisy (not a 1:1 mapping to latent themes)
  * engagement is noisy, platform dependent and drifts over time
  * a small amount of dirty data is injected (duplicates, blank content,
    invalid numbers, bad dates, missing views/categories) so the cleaning
    stage has real work to do
  * market trends rise, fall, plateau and include one topic with too
    little history to forecast
"""
from __future__ import annotations

import csv
import math
import random
from datetime import date, timedelta
from pathlib import Path

SEED = 42
rng = random.Random(SEED)
OUT = Path(__file__).resolve().parent

START = date(2024, 10, 1)
END = date(2026, 9, 20)
TOTAL_DAYS = (END - START).days

PLATFORMS = {
    # name: (weight, median views, base engagement rate %)
    "LinkedIn": (0.22, 3200, 3.0),
    "Instagram": (0.20, 6500, 4.0),
    "X": (0.15, 4200, 1.8),
    "Facebook": (0.10, 3600, 2.0),
    "TikTok": (0.10, 15000, 5.2),
    "YouTube": (0.08, 11000, 3.4),
    "Blog": (0.15, 1900, 1.6),
}

AUTHORS = ["Content Team", "A. Rivera", "J. Chen", "M. Okafor", "S. Patel", "L. Novak", "R. Das"]

# ---------------------------------------------------------------------------
# Latent themes. Each has sentence templates, title templates, slot fillers,
# a category distribution and an engagement multiplier.
# ---------------------------------------------------------------------------
THEMES: dict[str, dict] = {
    "ai_tech": {
        "cats": {"Artificial Intelligence": 0.58, "Technology": 0.34, "Business": 0.08},
        "eng": 1.2,
        "slots": {
            "tool": ["machine learning models", "large language models", "AI copilots", "computer vision", "predictive analytics", "AI assistants", "recommendation engines", "chatbots"],
            "task": ["reporting", "customer support", "content planning", "forecasting", "data cleanup", "ad targeting", "lead scoring", "research"],
            "team": ["marketing teams", "small businesses", "product teams", "analysts", "creators", "agencies"],
        },
        "sentences": [
            "How {team} are using {tool} to speed up {task} without losing the human touch.",
            "We tested three {tool} for {task} and the results surprised us.",
            "Generative AI is changing how {team} approach {task}, but data quality still matters most.",
            "A practical look at where {tool} actually save time and where they create extra work.",
            "Our engineers explain the difference between automation and true machine learning.",
            "Responsible AI starts with clear guardrails, transparent data use and human review.",
            "The biggest AI mistake we see: buying tools before defining the problem.",
            "Cloud costs, model accuracy and privacy are the three questions to ask before any AI rollout.",
            "Why {team} should treat {tool} as a teammate, not a replacement.",
            "New benchmark: {tool} reduced time spent on {task} by nearly a third in our pilot.",
            "Data pipelines, APIs and good documentation make every AI project easier to scale.",
            "What we learned integrating {tool} into our {task} workflow this quarter.",
        ],
        "titles": ["AI for {task}: what works", "Inside our {tool} pilot", "The state of AI for {team}", "Generative AI, explained simply", "Before you roll out {tool}"],
    },
    "marketing_strategy": {
        "cats": {"Marketing": 0.78, "Business": 0.22},
        "eng": 0.95,
        "slots": {
            "channel": ["email", "paid social", "organic search", "LinkedIn", "YouTube", "podcasts", "newsletters", "webinars"],
            "metric": ["conversion rate", "customer acquisition cost", "brand awareness", "retention", "click-through rate", "pipeline"],
            "aud": ["B2B buyers", "first-time customers", "Gen Z audiences", "returning customers", "decision makers"],
        },
        "sentences": [
            "A simple framework for choosing between {channel} and {channel} when budgets are tight.",
            "Your {metric} tells a story; here is how to read it before changing strategy.",
            "Brand positioning matters more than ever when {aud} compare five options in a minute.",
            "We rebuilt our content calendar around {aud} and saw {metric} improve steadily.",
            "SEO still drives compounding traffic, but keyword research needs to follow search intent.",
            "Marketing automation works best when the messaging is still written for real people.",
            "Influencer marketing can build trust quickly if the partnership feels genuine.",
            "Attribution is messy, so we track {metric} alongside qualitative feedback.",
            "Three campaign planning mistakes that quietly hurt {metric}.",
            "Funnel stages are useful, but {aud} rarely move through them in a straight line.",
            "How we plan quarterly campaigns across {channel}, {channel} and events.",
            "Search engine optimization checklist: technical health, content depth, internal links.",
            "Email automation sequences that nurture {aud} without feeling spammy.",
        ],
        "titles": ["Marketing strategy for {aud}", "Improving {metric} with {channel}", "Campaign planning playbook", "SEO in practice", "Rethinking the funnel"],
    },
    "promotion": {
        "cats": {"Marketing": 0.28, "Business": 0.18, "Technology": 0.12, "Fitness": 0.1, "Travel": 0.1, "Entertainment": 0.1, "Finance": 0.06, "Education": 0.06},
        "eng": 0.72,
        "slots": {
            "product": ["starter plan", "analytics dashboard", "mobile app", "workshop series", "premium membership", "summer collection", "online course", "gift bundle"],
            "pct": ["10%", "15%", "20%", "25%", "30%"],
            "when": ["this weekend", "until Friday", "for 48 hours", "this month", "while stocks last"],
        },
        "sentences": [
            "Our new {product} is live. Get {pct} off {when}.",
            "Limited offer: save {pct} on the {product} {when}. Link in bio.",
            "Launch day! Meet the {product}, built with feedback from our community.",
            "Flash sale on the {product}. Use code SAVE at checkout.",
            "Upgrade to the {product} and unlock every feature. Free trial available.",
            "Pre-orders for the {product} are open now with free shipping.",
            "Customers love the {product}; see why and grab yours {when}.",
            "Shop the {product} directly from this post with shoppable links.",
            "Don't miss our biggest discount of the season on the {product}.",
            "Book a free demo of the {product} and see it in action.",
        ],
        "titles": ["Introducing the {product}", "{pct} off the {product}", "Launch: {product}", "Sale ends {when}", "Now available: {product}"],
    },
    "community": {
        "cats": {"Marketing": 0.38, "Entertainment": 0.27, "Business": 0.25, "Education": 0.1},
        "eng": 1.15,
        "slots": {
            "who": ["our community", "customers", "followers", "members", "readers", "our team"],
            "q": ["favorite productivity hack", "biggest win this week", "go-to morning routine", "best advice from a mentor", "hot take on remote work"],
        },
        "sentences": [
            "We asked {who} for their {q} and the replies were brilliant.",
            "Tell us your {q} in the comments; we will feature the best answers.",
            "Behind the scenes with {who}: the people who make this brand what it is.",
            "Thank you to {who} for 50,000 conversations this year.",
            "Customer story: how one small studio grew by listening to feedback.",
            "Poll time! Vote on what we should build next.",
            "Your reviews shape our roadmap. Here is what changed because of {who}.",
            "Join our live Q&A on Thursday and bring your questions.",
            "User-generated content from {who} that made us smile this month.",
            "Creators in our community are sharing tutorials; here are this week's favorites.",
        ],
        "titles": ["Community spotlight", "You asked, we listened", "Behind the scenes", "Customer story", "This week in the community"],
    },
    "fitness": {
        "cats": {"Fitness": 0.9, "Education": 0.1},
        "eng": 1.1,
        "slots": {
            "ex": ["strength training", "running", "yoga", "HIIT workouts", "mobility drills", "cycling", "pilates"],
            "goal": ["better sleep", "more energy", "injury prevention", "building muscle", "heart health", "stress relief"],
        },
        "sentences": [
            "A 20-minute {ex} routine you can do at home for {goal}.",
            "Why recovery days matter as much as {ex} for {goal}.",
            "Nutrition basics: protein, hydration and consistency beat any fad diet.",
            "Beginner guide to {ex}: form first, intensity later.",
            "We tracked our team's step counts for a month; here is what happened to energy levels.",
            "Wearables are great, but listen to your body before chasing numbers.",
            "Five mobility drills that help desk workers with posture and {goal}.",
            "Mental health and movement are connected; small walks add up.",
            "Training plan: three days of {ex} and two days of active rest.",
        ],
        "titles": ["Home workout: {ex}", "Fitness for {goal}", "Recovery matters", "Beginner guide to {ex}", "Wellness at work"],
    },
    "travel": {
        "cats": {"Travel": 0.9, "Entertainment": 0.1},
        "eng": 1.05,
        "slots": {
            "place": ["Lisbon", "Kyoto", "the Scottish Highlands", "Bali", "Mexico City", "Iceland", "the Amalfi Coast", "Cape Town", "Seoul"],
            "style": ["budget travel", "slow travel", "solo trips", "family holidays", "weekend getaways", "remote work trips"],
        },
        "sentences": [
            "Three days in {place}: where to eat, stay and wander.",
            "A packing list for {style} that fits in one carry-on.",
            "How to plan {style} without burning out.",
            "Hidden gems in {place} that locals actually recommend.",
            "Travel insurance, visas and local SIM cards: the boring stuff that saves trips.",
            "Sustainable tourism tips for visiting {place} responsibly.",
            "Our team's favorite cafes for remote work in {place}.",
            "Shoulder season is the secret to cheaper flights and quieter streets.",
            "Photo diary from {place}, shot entirely on a phone.",
        ],
        "titles": ["Travel guide: {place}", "Tips for {style}", "Hidden gems in {place}", "Packing for {style}", "Postcards from {place}"],
    },
    "finance": {
        "cats": {"Finance": 0.9, "Business": 0.1},
        "eng": 0.95,
        "slots": {
            "fin": ["emergency funds", "index funds", "budgeting apps", "retirement accounts", "credit scores", "side income", "inflation"],
            "aud": ["freelancers", "new graduates", "small business owners", "young families", "creators"],
        },
        "sentences": [
            "A plain-language guide to {fin} for {aud}.",
            "How {aud} can build {fin} one small habit at a time.",
            "Budgeting does not have to be boring; try the 50/30/20 method.",
            "What rising interest rates mean for {aud} this year.",
            "Invoicing, taxes and cash flow: money basics every freelancer should know.",
            "We compared five {fin} tools so you don't have to.",
            "Fintech apps make saving easier, but read the fees carefully.",
            "Myths about {fin} that stop {aud} from getting started.",
        ],
        "titles": ["Money basics: {fin}", "Finance for {aud}", "Budgeting made simple", "Understanding {fin}", "Cash flow tips"],
    },
    "sustainability": {
        "cats": {"Sustainability": 0.85, "Business": 0.15},
        "eng": 1.0,
        "slots": {
            "act": ["packaging", "supply chain", "office energy use", "shipping", "product materials", "event planning"],
            "res": ["carbon emissions", "plastic waste", "water use", "landfill waste"],
        },
        "sentences": [
            "We redesigned our {act} and cut {res} significantly.",
            "Our annual sustainability report: progress, misses and next steps.",
            "Circular design means thinking about the end of a product's life from day one.",
            "How small brands can reduce {res} without big budgets.",
            "Greenwashing is real; here is how we verify every sustainability claim.",
            "Renewable energy now powers most of our operations.",
            "A sustainable brand is built on transparency about {act}.",
            "Partnering with local suppliers helped us reduce {res} in our {act}.",
        ],
        "titles": ["Sustainability update", "Reducing {res}", "Rethinking {act}", "Our climate commitments", "Circular design basics"],
    },
    "education": {
        "cats": {"Education": 0.68, "Technology": 0.14, "Marketing": 0.18},
        "eng": 1.25,
        "slots": {
            "skill": ["data analysis", "copywriting", "public speaking", "spreadsheet modeling", "video editing", "SQL", "design thinking", "project management"],
            "fmt": ["step-by-step guide", "free template", "cheat sheet", "mini course", "checklist", "tutorial"],
        },
        "sentences": [
            "New {fmt}: learn the basics of {skill} in under an hour.",
            "The {skill} {fmt} we wish we had when starting out.",
            "How to practice {skill} every day in fifteen minutes.",
            "Common beginner mistakes in {skill} and how to avoid them.",
            "Save this {fmt} for your next project.",
            "Learning in public: share your {skill} progress and get feedback.",
            "We turned our internal training on {skill} into a free {fmt}.",
            "Explained: the core concepts behind {skill}, with real examples.",
            "Lifelong learning is a career advantage; start with {skill}.",
        ],
        "titles": ["Learn {skill}", "Free {fmt}: {skill}", "{skill} for beginners", "How to get better at {skill}", "Skill up: {skill}"],
    },
    "entertainment": {
        "cats": {"Entertainment": 0.9, "Marketing": 0.1},
        "eng": 1.1,
        "slots": {
            "media": ["podcast episode", "music playlist", "short film", "gaming stream", "comedy sketch", "movie review", "live stream"],
            "mood": ["Friday", "rainy day", "long weekend", "late night", "road trip"],
        },
        "sentences": [
            "Our {mood} {media} is out now; tell us what you think.",
            "The team reacts to this week's biggest pop culture moments.",
            "Blooper reel from our latest shoot. We laughed a lot.",
            "Five things to watch this {mood}, picked by our staff.",
            "Behind the scenes of our {media} and the chaos that went into it.",
            "Guess the song from three notes. Answers in the comments.",
            "New {media} with a special guest you will recognize.",
            "Trend alert: our take on the viral challenge everyone is doing.",
        ],
        "titles": ["New {media}", "{mood} picks", "Behind the scenes", "Staff favorites", "This week in pop culture"],
    },
}

# Market-topic phrases injected into content. (phrase list, base probability,
# time profile, engagement multiplier). Coverage is intentionally uneven so
# that the Market module has real gaps to find.
MARKET_MENTIONS = [
    # topic key, phrases, base prob, time profile, eligible themes, engagement mult
    ("seo", ["SEO", "search engine optimization", "keyword research"], 0.16, "flat_down", {"marketing_strategy", "education", "ai_tech"}, 0.85),
    ("automation", ["marketing automation", "email automation"], 0.11, "flat", {"marketing_strategy", "ai_tech", "education"}, 0.95),
    ("genai", ["generative AI", "GenAI", "AI content creation"], 0.12, "rising", {"ai_tech", "marketing_strategy", "education"}, 1.25),
    ("shortvideo", ["short-form video", "Reels", "TikTok marketing"], 0.10, "rising", {"marketing_strategy", "entertainment", "community", "promotion"}, 1.2),
    ("influencer", ["influencer marketing", "brand ambassadors"], 0.08, "flat", {"marketing_strategy", "community", "promotion"}, 1.0),
    ("personal", ["personalization", "personalized marketing"], 0.05, "flat", {"marketing_strategy", "ai_tech"}, 1.1),
    ("metaverse", ["metaverse", "virtual events"], 0.06, "falling", {"ai_tech", "entertainment", "marketing_strategy"}, 0.8),
    ("sustainable", ["sustainable brand", "green marketing"], 0.10, "flat", {"sustainability"}, 1.0),
    ("agents", ["AI agents", "agentic AI", "autonomous agents"], 0.07, "late", {"ai_tech"}, 1.65),
    ("socialcommerce", ["social commerce", "shoppable posts", "live shopping"], 0.04, "rising", {"promotion", "marketing_strategy"}, 1.35),
    ("creator", ["creator economy", "UGC", "creator partnerships"], 0.025, "flat", {"community", "marketing_strategy", "entertainment"}, 1.3),
]

MENTION_SENTENCES = [
    "We are paying close attention to {p} this year.",
    "Quick thought on {p}: start small and measure what matters.",
    "Our take on {p} and what it means for brands like ours.",
    "{P} came up in almost every client conversation this month.",
    "Here is how {p} fits into our plan.",
    "Three lessons from experimenting with {p}.",
    "Is {p} worth the hype? Our honest view.",
    "Customers keep asking us about {p}.",
    "A beginner-friendly primer on {p}.",
    "We piloted {p} with two partners and shared the results.",
    "{P} is changing how audiences discover brands.",
    "What we got wrong about {p} last quarter.",
]

HASHTAGS = {
    "ai_tech": ["#AI", "#MachineLearning", "#Tech", "#Innovation"],
    "marketing_strategy": ["#Marketing", "#ContentStrategy", "#DigitalMarketing", "#Growth"],
    "promotion": ["#Sale", "#NewLaunch", "#Deal", "#ShopNow"],
    "community": ["#Community", "#ThankYou", "#CustomerLove"],
    "fitness": ["#Fitness", "#Wellness", "#Workout"],
    "travel": ["#Travel", "#Wanderlust", "#TravelTips"],
    "finance": ["#PersonalFinance", "#Money", "#Budgeting"],
    "sustainability": ["#Sustainability", "#ClimateAction", "#GreenBusiness"],
    "education": ["#Learning", "#Tutorial", "#Skills"],
    "entertainment": ["#Entertainment", "#Podcast", "#Weekend"],
}


def weighted_choice(d: dict[str, float]) -> str:
    keys = list(d)
    return rng.choices(keys, weights=[d[k] for k in keys], k=1)[0]


def theme_weights(frac: float) -> dict[str, float]:
    """Theme mix drifts over time: AI grows, promotion shrinks."""
    return {
        "ai_tech": 0.09 + 0.14 * frac,
        "marketing_strategy": 0.16,
        "promotion": 0.16 - 0.07 * frac,
        "community": 0.10,
        "fitness": 0.08 - 0.02 * frac,
        "travel": 0.08,
        "finance": 0.07,
        "sustainability": 0.07 + 0.02 * frac,
        "education": 0.11,
        "entertainment": 0.08 - 0.01 * frac,
    }


def fill(template: str, slots: dict[str, list[str]]) -> str:
    out = template
    # fill each placeholder occurrence independently
    while "{" in out:
        start = out.index("{")
        end = out.index("}", start)
        key = out[start + 1:end]
        val = rng.choice(slots.get(key, [key]))
        out = out[:start] + val + out[end + 1:]
    return out


def time_profile(kind: str, frac: float) -> float:
    if kind == "rising":
        return 0.4 + 1.2 * frac
    if kind == "falling":
        return 1.6 - 1.4 * frac
    if kind == "flat_down":
        return 1.15 - 0.3 * frac
    if kind == "late":
        return 0.0 if frac < 0.55 else 0.3 + 2.4 * (frac - 0.55) / 0.45
    return 1.0


def random_date() -> date:
    # volume grows ~35% over the period: sample with increasing density
    frac = rng.random() ** 0.87
    return START + timedelta(days=int(frac * TOTAL_DAYS))


def make_post(idx: int) -> dict:
    d = random_date()
    frac = (d - START).days / TOTAL_DAYS
    theme = weighted_choice(theme_weights(frac))
    t = THEMES[theme]

    # secondary theme sentence for realistic overlap
    n_sent = rng.choices([1, 2, 3, 4, 5], weights=[0.18, 0.32, 0.28, 0.15, 0.07])[0]
    sentences = [fill(s, t["slots"]) for s in rng.sample(t["sentences"], k=min(n_sent, len(t["sentences"])))]
    if rng.random() < 0.22:
        other = rng.choice([k for k in THEMES if k != theme])
        sentences.insert(rng.randint(0, len(sentences)), fill(rng.choice(THEMES[other]["sentences"]), THEMES[other]["slots"]))

    eng_mult = t["eng"]
    for key, phrases, base_p, prof, eligible, mult in MARKET_MENTIONS:
        p = base_p * time_profile(prof, frac) * (1.0 if theme in eligible else 0.12)
        if rng.random() < p:
            phrase = rng.choice(phrases)
            tpl = rng.choice(MENTION_SENTENCES)
            sent = tpl.replace("{P}", phrase[0].upper() + phrase[1:]).replace("{p}", phrase)
            sentences.insert(rng.randint(0, len(sentences)), sent)
            eng_mult *= mult

    text = " ".join(sentences)
    if rng.random() < 0.55:
        text += " " + " ".join(rng.sample(HASHTAGS[theme], k=rng.randint(1, 3)))

    platform = weighted_choice({k: v[0] for k, v in PLATFORMS.items()})
    _, med_views, base_rate = PLATFORMS[platform]

    # blog posts are longer
    if platform == "Blog":
        extra = [fill(s, t["slots"]) for s in rng.sample(t["sentences"], k=min(3, len(t["sentences"])))]
        text = text + " " + " ".join(extra)

    views = int(max(80, rng.lognormvariate(math.log(med_views * (0.8 + 0.4 * frac)), 0.75)))
    time_eng = 1.06 - 0.16 * frac  # engagement softens as volume grows
    rate = base_rate * eng_mult * time_eng * rng.lognormvariate(0, 0.42) / 100
    interactions = max(0, int(views * rate))
    comments_share = rng.uniform(0.06, 0.16)
    shares_share = rng.uniform(0.03, 0.12)
    comments = int(interactions * comments_share)
    shares = int(interactions * shares_share)
    likes = max(0, interactions - comments - shares)

    title = fill(rng.choice(t["titles"]), t["slots"])
    title = title[0].upper() + title[1:]
    pid = f"C{idx:05d}"
    url = f"https://blog.example.com/posts/{pid.lower()}" if platform == "Blog" else f"https://social.example.com/{platform.lower()}/{pid.lower()}"

    return {
        "id": pid,
        "date": d.isoformat(),
        "platform": platform,
        "title": title,
        "content": text,
        "category": weighted_choice(t["cats"]),
        "author": rng.choice(AUTHORS),
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "views": views,
        "url": url,
    }


def generate_content(n: int = 1850) -> list[dict]:
    rows = [make_post(i + 1) for i in range(n)]
    rows.sort(key=lambda r: r["date"])

    # --- inject realistic dirty data ------------------------------------
    dirty = list(rows)
    next_id = n + 1
    # exact duplicate posts (cross-posted / exported twice)
    for r in rng.sample(rows, 28):
        dup = dict(r)
        dup["id"] = f"C{next_id:05d}"
        next_id += 1
        dirty.append(dup)
    # blank / whitespace-only content
    for r in rng.sample(rows, 11):
        r["content"] = rng.choice(["", "   ", ""])
    # invalid numeric values
    for r in rng.sample(rows, 9):
        r[rng.choice(["likes", "comments", "shares"])] = rng.choice(["n/a", "--", "unknown"])
    # missing views (e.g. blog analytics not connected)
    for r in rng.sample([x for x in rows if x["platform"] == "Blog"], 25):
        r["views"] = ""
    # missing category
    for r in rng.sample(rows, 30):
        r["category"] = ""
    # unparseable dates
    for r in rng.sample(rows, 4):
        r["date"] = rng.choice(["not a date", "2025-13-45"])

    rng.shuffle(dirty)
    return dirty


# ---------------------------------------------------------------------------
# Market trend data (synthetic weekly interest index, 0-100)
# ---------------------------------------------------------------------------
def logistic(x: float, mid: float, k: float) -> float:
    return 1 / (1 + math.exp(-k * (x - mid)))


MARKET_TOPICS = [
    # topic, category, keywords(with factor), shape function(t in 0..1) -> score, weeks of history
    ("AI Agents", "Artificial Intelligence", [("ai agents", 1.0), ("agentic ai", 0.8), ("autonomous agents", 0.55)],
     lambda f: 8 + 80 * logistic(f, 0.72, 11), None),
    ("Generative AI", "Artificial Intelligence", [("generative ai", 1.0), ("genai", 0.75), ("ai content creation", 0.6)],
     lambda f: 52 + 34 * logistic(f, 0.35, 9) - 9 * max(0, f - 0.7) / 0.3, None),
    ("Social Commerce", "Commerce", [("social commerce", 1.0), ("shoppable posts", 0.7), ("live shopping", 0.65)],
     lambda f: 28 + 22 * f + 20 * max(0, f - 0.65) / 0.35, None),
    ("Short-Form Video", "Content Formats", [("short-form video", 1.0), ("reels", 0.9), ("tiktok marketing", 0.8)],
     lambda f: 76 + 4 * math.sin(f * 9), None),
    ("Personalized Marketing", "Customer Experience", [("personalized marketing", 1.0), ("personalization", 0.9)],
     lambda f: 40 + 14 * f, None),
    ("Influencer Marketing", "Partnerships", [("influencer marketing", 1.0), ("brand ambassadors", 0.6)],
     lambda f: 61 - 5 * f, None),
    ("SEO", "Search", [("seo", 1.0), ("search engine optimization", 0.7), ("keyword research", 0.6)],
     lambda f: 74 - 17 * f, None),
    ("Marketing Automation", "MarTech", [("marketing automation", 1.0), ("email automation", 0.8)],
     lambda f: 50 + 2 * math.sin(f * 6), None),
    ("Creator Economy", "Partnerships", [("creator economy", 1.0), ("ugc", 0.85), ("creator partnerships", 0.6)],
     lambda f: 33 + 26 * f, None),
    ("Metaverse Marketing", "Emerging Tech", [("metaverse", 1.0), ("virtual events", 0.7)],
     lambda f: 48 - 34 * f, None),
    ("Sustainable Branding", "Brand", [("sustainable brand", 1.0), ("green marketing", 0.75)],
     lambda f: 38 + 4 * f, None),
    # newly tracked topic: only 6 weeks of history -> forecasting must refuse
    ("AI Search Optimization", "Search", [("ai search", 1.0), ("generative engine optimization", 0.6)],
     lambda f: 16 + 38 * max(0.0, f - 0.94) / 0.06, 6),
]


def generate_market(weeks: int = 104) -> list[dict]:
    mrng = random.Random(SEED + 7)
    end_week = date(2026, 9, 27)  # a Sunday
    dates = [end_week - timedelta(weeks=weeks - 1 - i) for i in range(weeks)]
    rows = []
    for topic, cat, kws, shape, history in MARKET_TOPICS:
        start_i = 0 if history is None else weeks - history
        for kw, factor in kws:
            source = "Demo Search Interest Index (synthetic)" if factor >= 0.8 else "Demo Social Listening Panel (synthetic)"
            prev_scores: list[float] = []
            noise_state = 0.0
            for i in range(start_i, weeks):
                f = i / (weeks - 1)
                noise_state = 0.6 * noise_state + mrng.gauss(0, 2.2)  # autocorrelated noise
                seasonal = 1.8 * math.sin(2 * math.pi * i / 52 + sum(map(ord, topic)) % 7)
                score = shape(f) * (0.85 + 0.15 * factor) + noise_state + seasonal
                score = max(1.0, min(100.0, score))
                volume = int(score * 950 * factor * mrng.uniform(0.85, 1.15))
                growth = ""
                if len(prev_scores) >= 4:
                    base = prev_scores[-4]
                    growth = round((score - base) / base * 100, 2) if base else ""
                prev_scores.append(score)
                rows.append({
                    "topic": topic,
                    "keyword": kw,
                    "date": dates[i].isoformat(),
                    "trend_score": round(score, 2),
                    "volume": volume,
                    "growth_rate": growth,
                    "source": source,
                    "category": cat,
                })
    return rows


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    content = generate_content()
    market = generate_market()
    write_csv(OUT / "sample_content.csv", content)
    write_csv(OUT / "sample_market_trends.csv", market)
    print(f"wrote {len(content)} content rows and {len(market)} market rows to {OUT}")
