import glob, re, json

paths = glob.glob('C:/Users/Makan/AppData/Local/Google/Chrome/User Data/*/Local Storage/leveldb/*.ldb') + \
        glob.glob('C:/Users/Makan/AppData/Local/Microsoft/Edge/User Data/*/Local Storage/leveldb/*.ldb')

for db in paths:
    try:
        with open(db, 'rb') as f:
            data = f.read()
            for m in re.finditer(rb'\{"order":\[[^}]*\}', data):
                try:
                    s = m.group(0).decode('utf-8', errors='ignore')
                    obj = json.loads(s)
                    engs = obj.get('eng', {})
                    valid = {k: bool(v.get('key')) for k, v in engs.items()}
                    if any(valid.values()):
                        print(db, valid)
                except Exception:
                    pass
    except Exception:
        pass
