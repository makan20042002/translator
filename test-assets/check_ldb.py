import glob, re

target = None
for f in glob.glob(r'C:\Users\Makan\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb\*.ldb'):
    with open(f, 'rb') as fp:
        buf = fp.read()
        if b'localhost:8080' in buf:
            print('Found localhost:8080 in:', f)
            # Find cfg
            idx = 0
            while True:
                idx = buf.find(b'cfg', idx)
                if idx == -1: break
                sub = buf[max(0, idx-50):min(len(buf), idx+400)]
                print('snippet around cfg:', sub[:150])
                idx += 3
