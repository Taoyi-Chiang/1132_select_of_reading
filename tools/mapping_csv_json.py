import json
import re

with open("mapping.json", encoding="utf-8") as f:
    mapping = json.load(f)

def extract_id(url):
    m = re.search(r"id=([\w-]+)", url)
    return m.group(1) if m else url

fixed = {k: extract_id(v) for k, v in mapping.items()}

with open("mapping.json", "w", encoding="utf-8") as f:
    json.dump(fixed, f, ensure_ascii=False, indent=2)
update