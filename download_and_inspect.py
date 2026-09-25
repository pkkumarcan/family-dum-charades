import urllib.request
import re
import json

sheet_id = "1BMw72htVTxHI2JYDgkwFga0V2GSaESo6A6HZyJ8xiQM"
url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit?usp=sharing"

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8')

with open('downloaded_sheet.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Downloaded sheet html, searching for tabs...")

# In Google sheets, bootstrap data contains:
# [21350203,"[<index>,0,\"<GID>\",[{\"1\":[[0,0,\"<Tab Name>\"]
# Notice the backslash escaping!
matches = re.findall(r'\\\"([0-9]+)\\\",\[\{\\\"1\\\":\[\[0,0,\\\"([^\\\"]+)\\\"', html)
print(f"Escaped pattern matches: {len(matches)}")
for gid, name in matches:
    print(f"  GID: {gid} -> {name.encode('utf-8').decode('unicode_escape')}")

# If only some tabs matched, let's search for the whole bootstrap array
pos = html.find('bootstrapData')
if pos != -1:
    print("Found bootstrapData at:", pos)
    print(html[pos:pos+1000])

# Let's search for "200000" in html
pos2 = 0
found_gids = []
while True:
    pos2 = html.find('200000', pos2)
    if pos2 == -1:
        break
    snippet = html[max(0, pos2-80):min(len(html), pos2+150)]
    print(f"Found '200000' at {pos2}: {snippet}")
    pos2 += 6
