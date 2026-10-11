import http.server
import socketserver
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == '__main__':
    os.chdir(DIRECTORY)
    requested_ports = [int(sys.argv[1])] if len(sys.argv) > 1 else [8080, 8888, 3000, 8000]
    httpd = None
    active_port = None
    for p in requested_ports:
        try:
            httpd = socketserver.TCPServer(('127.0.0.1', p), Handler)
            active_port = p
            break
        except (PermissionError, OSError) as err:
            if len(requested_ports) == 1:
                print(f"Error: port {p} is unavailable ({err}). Try another port like: python test-server.py 8888")
                sys.exit(1)
            continue

    if httpd:
        with httpd:
            print(f"Serving at http://127.0.0.1:{active_port} and http://localhost:{active_port}")
            sys.stdout.flush()
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nServer stopped.")
