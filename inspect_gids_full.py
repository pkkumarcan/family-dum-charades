with open('full_sheet.html', encoding='utf-8') as f:
    text = f.read()

import re

# Look for all occurrences of gid-like patterns in full_sheet.html
# e.g. \"200000101\" or [num, 0, \"...\"
gids = re.findall(r'\"([0-9]{8,10})\"', text)
print(f"Found {len(gids)} long number strings:")
unique_gids = sorted(list(set(gids)))
for g in unique_gids:
    pos = text.find(g)
    snippet = text[max(0, pos-150):min(len(text), pos+300)]
    print(f"\n--- GID: {g} ---")
    print(snippet)
