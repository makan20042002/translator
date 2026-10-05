import re, json

with open(r'C:\Users\Makan\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb\000048.ldb', 'rb') as fp:
    buf = fp.read()

idx = buf.find(b'127.0.0.1:50505')
while idx != -1:
    sub = buf[idx:idx+3000]
    m = re.search(rb'\{[^{}]*"eng"[^{}]*\}', sub)
    if m:
        try:
            cfg = json.loads(m.group(0).decode('utf-8', errors='ignore'))
            engs = cfg.get('eng', {})
            print('Found configured keys:', {k: (len(v.get('key','')) > 0) for k, v in engs.items()})
            # Also save keys to a local file for the test server if found, WITHOUT printing
            keys_to_sync = {k: v.get('key','') for k, v in engs.items() if v.get('key')}
            if keys_to_sync:
                with open('test-assets/recovered_keys.json', 'w', encoding='utf-8') as kf:
                    json.dump(keys_to_sync, kf)
                print('Saved recovered keys to test-assets/recovered_keys.json')
        except Exception as e:
            print('err:', e)
    idx = buf.find(b'127.0.0.1:50505', idx+1)
