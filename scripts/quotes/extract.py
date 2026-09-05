#!/usr/bin/env python3
"""Pull public-domain texts from Project Gutenberg and extract standalone,
quotable sentences as candidates for hand curation.

Only pre-1931 translations / originals are used so the translation itself is
public domain in the US, not just the underlying work.
"""
import json, re, sys, os, time, urllib.request, html

OUT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(OUT, "cache")
os.makedirs(CACHE, exist_ok=True)

# (gutenberg id, author, work, translator/edition, tags)
SOURCES = [
    (2680,  "Marcus Aurelius", "Meditations", "trans. George Long, 1862", ["stoic", "mind"]),
    (216,   "Lao Tzu", "Tao Te Ching", "trans. James Legge, 1891", ["tao", "stillness"]),
    (205,   "Henry David Thoreau", "Walden", "1854", ["nature", "simplicity"]),
    (1022,  "Henry David Thoreau", "Walking", "1862", ["nature", "simplicity"]),
    (2017,  "The Buddha", "Dhammapada", "trans. F. Max Muller, 1881", ["buddhist", "mind"]),
    (871,   "Epictetus", "The Golden Sayings", "trans. Hastings Crossley, 1903", ["stoic", "mind"]),
    (45109, "Epictetus", "The Enchiridion", "trans. Elizabeth Carter, 1758", ["stoic", "mind"]),
    (3600,  "Michel de Montaigne", "Essays", "trans. Charles Cotton, 1877 ed.", ["craft", "life"]),
    (2944,  "Ralph Waldo Emerson", "Essays: First Series", "1841", ["craft", "life"]),
    (2945,  "Ralph Waldo Emerson", "Essays: Second Series", "1844", ["craft", "life"]),
    (2388,  "Bhagavad Gita", "The Song Celestial", "trans. Edwin Arnold, 1885", ["stillness", "mind"]),
    (6519,  "Kabir", "Songs of Kabir", "trans. Rabindranath Tagore, 1915", ["stillness", "life"]),
    (18269, "Blaise Pascal", "Pensees", "trans. W. F. Trotter, 1904", ["mind", "life"]),
    (769,   "Kakuzo Okakura", "The Book of Tea", "1906", ["zen", "craft"]),
    (12096, "Inazo Nitobe", "Bushido: The Soul of Japan", "1900", ["craft", "life"]),
    (10661, "Epictetus", "The Discourses", "trans. George Long, 1877", ["stoic", "mind"]),
    (8438,  "Aristotle", "Nicomachean Ethics", "trans. W. D. Ross, 1908", ["craft", "life"]),
    (14328, "Boethius", "The Consolation of Philosophy", "trans. W. V. Cooper, 1902", ["stoic", "life"]),
    (1656,  "Plato", "Apology", "trans. Benjamin Jowett, 1871", ["mind", "life"]),
    (1322,  "Walt Whitman", "Leaves of Grass", "1892 ed.", ["nature", "life"]),
    (37124, "Seneca", "Moral Letters to Lucilius", "trans. Richard M. Gummere, 1917", ["stoic", "life"]),
    (3330,  "Confucius", "The Analects", "trans. James Legge, 1861", ["craft", "mind"]),
    (2096,  "Chuang Tzu", "Musings of a Chinese Mystic", "trans. Lionel Giles, 1906", ["tao", "stillness"]),
    (5305,  "Lao Tzu", "The Sayings of Lao Tzu", "trans. Lionel Giles, 1904", ["tao", "stillness"]),
    (2412,  "Ecclesiastes", "The Bible, King James Version", "1611", ["life", "stillness"]),
]

STARTS_BAD = {
    "and", "but", "for", "or", "nor", "so", "yet", "then", "thus", "hence", "therefore",
    "now", "moreover", "wherefore", "whereas", "he", "she", "they", "it", "this", "that",
    "these", "those", "his", "her", "their", "its", "such", "which", "who", "here",
    "again", "also", "besides", "however", "nevertheless", "still", "accordingly",
    "consequently", "likewise", "otherwise", "meanwhile", "indeed", "well", "yes", "no",
    "i", "we", "you", "my", "our", "your", "some", "many", "most", "one", "another",
    "first", "second", "third", "next", "lastly", "finally", "chapter", "book", "section",
    "if", "when", "as", "since", "because", "although", "though", "while", "whether",
    "what", "why", "how", "where", "after", "before", "till", "until", "by", "of", "in",
    "on", "at", "to", "from", "with", "without", "upon", "among", "between",
}
ALLOW_CAPS = {"God", "Nature", "Heaven", "Tao", "Reason", "Fortune", "Zen", "Buddha",
              "Truth", "Time", "Providence", "Universe", "Wisdom", "Virtue", "Death", "Life",
              "Love", "Beauty", "Art", "Man", "Earth", "Sage", "Master", "Way", "Spirit",
              "Soul", "Good", "Fate", "Happiness", "Philosophy", "Teaism", "Tea"}
ARCHAIC = re.compile(r"\b(thee|thou|thy|thine|hath|doth|dost|art|shalt|wilt|ye|hast|canst|wouldst|shouldst|unto)\b", re.I)
PRONOUN_REF = re.compile(r"\b(he|she|they|them|his|her|their|him)\b", re.I)


def fetch(gid):
    path = os.path.join(CACHE, f"{gid}.txt")
    if os.path.exists(path):
        return open(path, encoding="utf-8", errors="replace").read()
    for url in (f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.txt",
                f"https://www.gutenberg.org/files/{gid}/{gid}-0.txt",
                f"https://www.gutenberg.org/files/{gid}/{gid}.txt"):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "zen-typer-quote-curation/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            try:
                text = data.decode("utf-8")
            except UnicodeDecodeError:
                text = data.decode("latin-1")
            open(path, "w", encoding="utf-8").write(text)
            time.sleep(1.0)
            return text
        except Exception as e:  # noqa
            print(f"  fetch failed {url}: {e}", file=sys.stderr)
    return None


def strip_boilerplate(text):
    m = re.search(r"\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*", text, re.I | re.S)
    if m:
        text = text[m.end():]
    m = re.search(r"\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG EBOOK", text, re.I)
    if m:
        text = text[:m.start()]
    return text


def paragraphs(text):
    text = text.replace("\r", "")
    paras = re.split(r"\n\s*\n", text)
    out = []
    for p in paras:
        p = re.sub(r"\s+", " ", p).strip()
        p = p.replace("_", "")
        if len(p) < 40:
            continue
        out.append(p)
    return out


SENT_SPLIT = re.compile(r"(?<=[.!?])[\"'”’]?\s+(?=[\"'“‘]?[A-Z])")


def sentences(par):
    for s in SENT_SPLIT.split(par):
        s = s.strip().strip("\"'“”‘’")
        yield s


def ok(s):
    n = len(s)
    if n < 40 or n > 190:
        return False
    if not s[0].isalpha() or not s[0].isupper():
        return False
    if s[-1] not in ".!?":
        return False
    if re.search(r"[\[\]\(\){}<>*#@/\\|=+_~`^$%]", s):
        return False
    if re.search(r"\d", s):
        return False
    if s.count(";") > 1 or s.count(",") > 4:
        return False
    if '"' in s or "“" in s or "”" in s or "'" in s and s.count("'") > 2:
        return False
    if s.count(":") > 1:
        return False
    first = re.match(r"[A-Za-z]+", s).group(0).lower()
    if first in STARTS_BAD:
        return False
    if ARCHAIC.search(s):
        return False
    if PRONOUN_REF.search(s):
        return False
    if re.search(r"\b(said|says|replied|answered|asked|cried|exclaimed)\b", s, re.I):
        return False
    if re.search(r"\b(Mr|Mrs|Dr|St)\.", s):
        return False
    words = s.split()
    caps_mid = [w.strip(".,;:!?") for w in words[1:] if w[:1].isupper()]
    if any(w not in ALLOW_CAPS and w != "I" and not w.startswith("I'") for w in caps_mid):
        return False
    if sum(1 for w in words if w.isupper() and len(w) > 1) > 0:
        return False
    if len(words) < 6:
        return False
    return True


def score(s):
    n = len(s)
    sc = 0.0
    sc += max(0, 1.0 - abs(n - 95) / 95)            # sweet spot ~95 chars
    sc -= 0.15 * s.count(",")
    sc -= 0.3 * s.count(";")
    sc -= 0.2 * s.count(":")
    if re.search(r"\b(is|are|be|becomes|makes|brings|lies|comes)\b", s):
        sc += 0.2                                       # aphoristic present tense
    if re.search(r"\b(I|me|my|mine|myself)\b", s):
        sc -= 0.25
    if re.search(r"\b(not|never|nothing|no)\b", s):
        sc += 0.05
    if s.endswith("?"):
        sc -= 0.1
    return sc


def main():
    combined = []
    summary = []
    for gid, author, work, edition, tags in SOURCES:
        print(f"== {author}: {work} ({gid})")
        text = fetch(gid)
        if not text:
            summary.append((author, work, gid, "FETCH FAILED", 0))
            continue
        body = strip_boilerplate(text)
        seen = set()
        cands = []
        for p in paragraphs(body):
            for s in sentences(p):
                if ok(s):
                    key = s.lower()
                    if key in seen:
                        continue
                    seen.add(key)
                    cands.append((score(s), s))
        cands.sort(key=lambda x: -x[0])
        top = cands[:70]
        summary.append((author, work, gid, "ok", len(cands)))
        with open(os.path.join(OUT, f"cand_{gid}.json"), "w") as f:
            json.dump({"author": author, "work": work, "edition": edition, "tags": tags,
                       "candidates": [s for _, s in top]}, f, ensure_ascii=False, indent=1)
        combined.append(f"\n\n##### {author} | {work} | {edition} | gid {gid} | {len(cands)} candidates\n")
        for i, (_, s) in enumerate(top):
            combined.append(f"{gid}-{i:02d}: {s}")
    with open(os.path.join(OUT, "ALL_CANDIDATES.txt"), "w") as f:
        f.write("\n".join(combined))
    print("\nSUMMARY")
    for row in summary:
        print(row)


if __name__ == "__main__":
    main()
