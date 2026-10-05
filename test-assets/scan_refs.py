import re

with open(r'c:\Users\Makan\Desktop\translator\index.html', encoding='utf-8') as f:
    content = f.read()

refs = set(re.findall(r"\$\('([a-zA-Z0-9_-]+)'\)", content))
ids = set(re.findall(r'id="([a-zA-Z0-9_-]+)"', content))

missing = [r for r in sorted(refs) if r not in ids]
print('All missing elements referenced by $("..."):', missing)

for m in missing:
    lines = []
    for idx, l in enumerate(content.splitlines(), 1):
        if f"$('{m}')" in l:
            lines.append((idx, l.strip()[:90]))
    print(f"\n--- {m} (used {len(lines)} times) ---")
    for idx, l in lines:
        print(f"  Line {idx}: {l}")
