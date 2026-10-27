"""Check links, anchors, section cross-references and ID references across the Playlo docs."""
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[3]  # repository root
docs = sorted(p for p in root.rglob("*.md")
              if not {"_archive", ".git", "node_modules", "_verification"} & set(p.parts))


def slug(h: str) -> str:
    h = re.sub(r"`", "", h.strip().lower())
    h = re.sub(r"[^\w\- ]", "", h, flags=re.UNICODE)
    return re.sub(r"\s", "-", h)


def strip_fences(text: str) -> str:
    out, fence = [], False
    for line in text.split("\n"):
        if line.startswith("```"):
            fence = not fence
            continue
        if not fence:
            out.append(line)
    return "\n".join(out)


headings = {}   # path -> set(slugs)
sections = {}   # doc number -> set of section numbers like "2", "2.4"
for p in docs:
    txt = strip_fences(p.read_text(encoding="utf8"))
    hs = re.findall(r"^#{1,6}\s+(.*)$", txt, flags=re.M)
    headings[p] = {slug(h) for h in hs}
    m = re.match(r"(\d\d)-", p.name)
    if m:
        nums = set()
        for h in hs:
            n = re.match(r"(\d+(?:\.\d+)*)\.?\s", h)
            if n:
                nums.add(n.group(1))
        sections[m.group(1)] = nums

problems = []

# 1. markdown links
for p in docs:
    txt = strip_fences(p.read_text(encoding="utf8"))
    for m in re.finditer(r"\[[^\]]*\]\(([^)\s]+)\)", txt):
        href = m.group(1)
        if href.startswith(("http://", "https://", "mailto:")):
            continue
        target, _, anchor = href.partition("#")
        tp = (p.parent / target).resolve() if target else p
        if not tp.exists():
            problems.append(f"{p.name}: broken link {href}")
            continue
        if anchor and tp.suffix == ".md" and tp in headings and anchor not in headings[tp]:
            problems.append(f"{p.name}: missing anchor #{anchor} in {tp.name}")

# 2. 'NN §X.Y' section references (skip the audit report's Location column which uses v1 numbering)
for p in docs:
    raw = p.read_text(encoding="utf8")
    if p.name.startswith("11-"):
        # only check text after the 'Resolution' columns is hard; check just non-table lines
        lines = [ln for ln in raw.split("\n") if not ln.startswith("|")]
        raw = "\n".join(lines)
    for m in re.finditer(r"\b(0\d|1[0-2]) §(\d+(?:\.\d+)?)", raw):
        doc, sec = m.group(1), m.group(2)
        if doc in sections and sec not in sections[doc]:
            problems.append(f"{p.name}: reference '{doc} §{sec}' has no matching heading")

# 3. ID references
all_text = "\n".join(p.read_text(encoding="utf8") for p in docs)
defined = {
    "T": set(re.findall(r"\| \*{0,2}(T-\d\d)\*{0,2} \|", all_text)),
    "R": set(re.findall(r"\*\*(R\d) —", all_text)),
    "S": set(re.findall(r"\| (S\d) —", all_text)),
    "C": set(re.findall(r"\| (C\d{1,2}) \|", all_text)),
    "ADR": set(re.findall(r"## (ADR-\d{3})", all_text)),
    "OPEN": set(re.findall(r"\| \*{0,2}([PFLSBO]-\d\d)\b", all_text)),
}
used_T = set(re.findall(r"\bT-\d\d\b", all_text))
used_R = set(re.findall(r"\bR[1-8]\b", all_text))
used_S = set(re.findall(r"\bSpikes? (S\d)\b", all_text)) | set(re.findall(r"\bS[1-7]\b", all_text))
used_ADR = set(re.findall(r"\bADR-\d{3}\b", all_text))
used_open = set(re.findall(r"\b[PFLSBO]-\d\d\b", all_text))
used_open = {u for u in used_open if not re.match(r"T-", u)}
print("defined tests:", sorted(defined["T"]))
print("tests referenced but not defined:", sorted(used_T - defined["T"]))
print("runbooks defined:", sorted(defined["R"]), "referenced undefined:", sorted(used_R - defined["R"]))
print("ADRs defined:", len(defined["ADR"]), "referenced undefined:", sorted(used_ADR - defined["ADR"]))
print("open items defined:", len(defined["OPEN"]))
und = sorted(u for u in used_open if u not in defined["OPEN"] and not u.startswith(("C-", "H-", "M-", "L-0")))
print("open-item-like refs not defined (review manually):", und)
print("spikes referenced:", sorted(used_S))

print()
print("PROBLEMS:" if problems else "No link/anchor/section problems found.")
for pr in problems:
    print(" -", pr)
sys.exit(1 if problems else 0)
