import subprocess
import time

cmd = r'web-ext run --source-dir dist/firefox --firefox "C:\Program Files\Mozilla Firefox\firefox.exe" --no-input --start-url about:blank'
print("Launching web-ext...")
p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
time.sleep(5)
p.terminate()
try:
    p.wait(timeout=2)
except:
    p.kill()
stdout, stderr = p.communicate()
print("STDOUT:")
print(stdout[:500])
if stderr:
    print("STDERR:")
    print(stderr[:500])
