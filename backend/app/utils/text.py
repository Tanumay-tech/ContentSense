"""Text preprocessing helpers used by the cleaning and feature stages.

No external NLP downloads are needed: stop words come from scikit-learn plus a
small domain list, and a conservative rule-based lemmatizer handles plurals.
"""
from __future__ import annotations

import re

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

DOMAIN_STOP_WORDS = {
    "just", "like", "get", "got", "make", "makes", "really", "today", "week", "weeks", "year",
    "one", "us", "also", "new", "use", "using", "way", "ways", "thing", "things", "know",
    "link", "bio", "post", "posts", "check", "want", "need", "let", "lets", "going", "time",
    "day", "days", "people", "look", "good", "great", "best", "quick", "here", "don", "ll",
    "ve", "re", "isn", "doesn", "didn", "won", "can", "will", "still", "every", "actually",
    "thought", "start", "small", "tell", "come", "came", "say", "says",
}
STOP_WORDS = set(ENGLISH_STOP_WORDS) | DOMAIN_STOP_WORDS
SHORT_WHITELIST = {"ai", "seo", "ugc", "sql", "ux", "ui", "vr", "ar", "api", "roi", "b2b", "hiit"}

# words the plural rule must not touch
LEMMA_EXCEPTIONS = {
    "analytics", "news", "series", "business", "ethics", "economics", "physics", "always",
    "various", "previous", "perhaps", "sales", "status", "bonus", "campus", "focus", "less",
    "process", "success", "access", "address", "across", "canvas", "atlas", "virus", "plus",
    "genai", "this", "has", "was", "its", "yes", "lens", "basics", "logistics", "metrics",
    "insights", "chaos", "wellness", "fitness", "mindfulness", "awareness", "happiness", "tips",
}
IRREGULAR = {"people": "people", "children": "child", "men": "man", "women": "woman", "data": "data", "media": "media"}

_URL = re.compile(r"(https?://\S+|www\.\S+)")
_EMAIL = re.compile(r"\S+@\S+\.\S+")
_MENTION = re.compile(r"@\w+")
_HTML = re.compile(r"<[^>]+>")
_HASHTAG = re.compile(r"#(\w+)")
_CAMEL = re.compile(r"(?<=[a-z])(?=[A-Z])")
_NON_ALPHA = re.compile(r"[^a-z\s]")
_SPACES = re.compile(r"\s+")


def _split_hashtag(m: re.Match) -> str:
    return " " + _CAMEL.sub(" ", m.group(1)) + " "


def lemmatize(token: str) -> str:
    """Conservative plural -> singular normalization."""
    if token in IRREGULAR:
        return IRREGULAR[token]
    if token in LEMMA_EXCEPTIONS or len(token) <= 4:
        return token
    if token.endswith("ies") and len(token) > 5:
        return token[:-3] + "y"          # strategies -> strategy
    if token.endswith(("sses", "ss", "us", "is")):
        return token
    if token.endswith("es") and token[:-2].endswith(("ch", "sh", "x")):
        return token[:-2]                 # coaches -> coach
    if token.endswith("s"):
        return token[:-1]                 # brands -> brand
    return token


def normalize_raw(text: str) -> str:
    """Strip markup/links and expand hashtags, keep casing-insensitive words."""
    if not isinstance(text, str):
        return ""
    t = _HTML.sub(" ", text)
    t = _URL.sub(" ", t)
    t = _EMAIL.sub(" ", t)
    t = _MENTION.sub(" ", t)
    t = _HASHTAG.sub(_split_hashtag, t)
    return t


def tokenize(text: str) -> list[str]:
    """Full preprocessing: normalize -> lowercase -> remove punctuation/numbers
    -> stop-word removal -> lemmatize."""
    t = normalize_raw(text).lower()
    t = t.replace("-", " ").replace("'", "")
    t = _NON_ALPHA.sub(" ", t)
    tokens = []
    for tok in t.split():
        if tok in STOP_WORDS:
            continue
        if len(tok) < 3 and tok not in SHORT_WHITELIST:
            continue
        lem = lemmatize(tok)
        if lem in STOP_WORDS:
            continue
        tokens.append(lem)
    return tokens


def preprocess(text: str) -> str:
    return " ".join(tokenize(text))


def normalize_for_match(text: str) -> str:
    """Lowercase, punctuation -> space. Used for transparent phrase matching of
    market topics against content (no stemming, so matches are literal)."""
    if not isinstance(text, str):
        return ""
    t = normalize_raw(text).lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return " " + _SPACES.sub(" ", t).strip() + " "


def dedupe_key(text: str) -> str:
    return _SPACES.sub(" ", str(text).strip().lower())
