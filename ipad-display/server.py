"""
iPad Display - Windows 화면을 Wi-Fi로 iPad에 스트리밍하고, iPad 터치로 PC를 조작합니다.

사용법:
    python server.py                 # 보조 모니터(가상 디스플레이)를 자동 선택
    python server.py --list          # 모니터 목록 보기
    python server.py --monitor 2     # 특정 모니터 선택
    python server.py --port 8765 --password 1234

iPad Safari에서 화면에 표시되는 주소(http://PC-IP:8765)로 접속하세요.
"""
import argparse
import asyncio
import ctypes
import io
import json
import socket
import sys
import threading
import time
import zlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

try:
    import mss
    _MSS = getattr(mss, "MSS", None) or mss.mss
    from PIL import Image, ImageDraw
    from aiohttp import web, WSMsgType
except ImportError:
    print("필요한 패키지가 없습니다. 먼저 실행하세요:  pip install -r requirements.txt")
    sys.exit(1)

IS_WINDOWS = sys.platform == "win32"
STATIC_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).parent)) / "static"

# ---------------------------------------------------------------------------
# Windows API (DPI, 커서, 마우스 입력)
# ---------------------------------------------------------------------------
if IS_WINDOWS:
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    try:  # 실제 픽셀 좌표를 쓰도록 DPI 인식 설정 (배율 125%/150% 대응)
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            user32.SetProcessDPIAware()
        except Exception:
            pass

    MOUSEEVENTF_MOVE = 0x0001
    MOUSEEVENTF_LEFTDOWN = 0x0002
    MOUSEEVENTF_LEFTUP = 0x0004
    MOUSEEVENTF_RIGHTDOWN = 0x0008
    MOUSEEVENTF_RIGHTUP = 0x0010
    MOUSEEVENTF_WHEEL = 0x0800
    MOUSEEVENTF_HWHEEL = 0x1000
    MOUSEEVENTF_ABSOLUTE = 0x8000
    MOUSEEVENTF_VIRTUALDESK = 0x4000
    SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN = 76, 77
    SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN = 78, 79

    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG),
                    ("mouseData", wintypes.DWORD), ("dwFlags", wintypes.DWORD),
                    ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]

    class _INPUTUNION(ctypes.Union):
        _fields_ = [("mi", MOUSEINPUT), ("pad", ctypes.c_byte * 32)]

    class INPUT(ctypes.Structure):
        _fields_ = [("type", wintypes.DWORD), ("u", _INPUTUNION)]

    def _send_mouse(flags, dx=0, dy=0, data=0):
        inp = INPUT(type=0)
        inp.u.mi = MOUSEINPUT(dx, dy, ctypes.c_ulong(data & 0xFFFFFFFF).value, flags, 0, None)
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

    def move_to(x, y):
        """가상 데스크톱 전체 기준 절대좌표로 커서 이동 (여러 모니터 지원)."""
        vx = user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
        vy = user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
        vw = max(1, user32.GetSystemMetrics(SM_CXVIRTUALSCREEN) - 1)
        vh = max(1, user32.GetSystemMetrics(SM_CYVIRTUALSCREEN) - 1)
        nx = round((x - vx) * 65535 / vw)
        ny = round((y - vy) * 65535 / vh)
        _send_mouse(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK, nx, ny)

    def button(btn, down):
        if btn == "right":
            _send_mouse(MOUSEEVENTF_RIGHTDOWN if down else MOUSEEVENTF_RIGHTUP)
        else:
            _send_mouse(MOUSEEVENTF_LEFTDOWN if down else MOUSEEVENTF_LEFTUP)

    def wheel(dx, dy):
        if dy:
            _send_mouse(MOUSEEVENTF_WHEEL, data=int(dy))
        if dx:
            _send_mouse(MOUSEEVENTF_HWHEEL, data=int(dx))

    def cursor_pos():
        pt = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(pt))
        return pt.x, pt.y
else:  # 개발/테스트용 (Windows가 아니면 입력은 무시)
    def move_to(x, y): pass
    def button(btn, down): pass
    def wheel(dx, dy): pass
    def cursor_pos(): return (-10000, -10000)


# ---------------------------------------------------------------------------
# 화면 캡처
# ---------------------------------------------------------------------------
_tls = threading.local()


def _sct():
    if not hasattr(_tls, "sct"):
        _tls.sct = _MSS()
    return _tls.sct


def list_monitors():
    with _MSS() as s:
        return s.monitors[1:]  # [0]은 전체 데스크톱


def pick_default_monitor(mons):
    """주 모니터(0,0 위치)가 아닌 마지막 모니터 = 보통 새로 추가한 가상 디스플레이."""
    for i in range(len(mons) - 1, -1, -1):
        if not (mons[i]["left"] == 0 and mons[i]["top"] == 0):
            return i + 1
    return 1


CURSOR = [(0, 0), (0, 17), (4, 13), (7, 20), (10, 19), (7, 12), (12, 12)]


def capture_jpeg(mon_index, quality, max_width, last_crc):
    """모니터를 캡처해 JPEG로 인코딩. 화면이 그대로면 None 반환."""
    sct = _sct()
    mon = sct.monitors[mon_index]
    shot = sct.grab(mon)
    img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")

    # 마우스 커서 그리기 (캡처에는 커서가 포함되지 않음)
    cx, cy = cursor_pos()
    cx -= mon["left"]
    cy -= mon["top"]
    if 0 <= cx < mon["width"] and 0 <= cy < mon["height"]:
        s = max(1.0, mon["width"] / 1920)
        pts = [(cx + x * s, cy + y * s) for x, y in CURSOR]
        d = ImageDraw.Draw(img)
        d.polygon(pts, fill="white", outline="black")

    if max_width and img.width > max_width:
        h = round(img.height * max_width / img.width)
        img = img.resize((max_width, h), Image.BILINEAR)

    raw = img.tobytes()
    crc = zlib.crc32(raw[:: 97])  # 빠른 변경 감지(샘플링)
    if crc == last_crc:
        return None, crc
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality, optimize=False)
    return buf.getvalue(), crc


# ---------------------------------------------------------------------------
# 웹 서버
# ---------------------------------------------------------------------------
class Session:
    def __init__(self, ws, app):
        self.ws = ws
        self.app = app
        self.fps = 30
        self.quality = 70
        self.max_width = 0  # 0 = 원본 해상도
        self.mon_index = app["monitor"]
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.dragging = False
        self.force = True

    def to_screen(self, nx, ny):
        mon = self.app["monitors"][self.mon_index - 1]
        x = mon["left"] + min(max(nx, 0.0), 1.0) * (mon["width"] - 1)
        y = mon["top"] + min(max(ny, 0.0), 1.0) * (mon["height"] - 1)
        return int(x), int(y)

    async def stream(self):
        loop = asyncio.get_running_loop()
        crc = None
        last_full = 0.0
        while not self.ws.closed:
            t0 = time.perf_counter()
            if self.force or t0 - last_full > 2.0:  # 주기적으로 강제 전송
                crc, self.force, last_full = None, False, t0
            data, crc = await loop.run_in_executor(
                self.executor, capture_jpeg, self.mon_index, self.quality, self.max_width, crc)
            if data is not None:
                try:
                    await self.ws.send_bytes(data)
                except (ConnectionResetError, RuntimeError):
                    break
            wait = 1.0 / self.fps - (time.perf_counter() - t0)
            await asyncio.sleep(max(0.001, wait))

    def handle(self, msg):
        t = msg.get("t")
        if t == "cfg":
            self.fps = int(min(max(msg.get("fps", self.fps), 5), 60))
            self.quality = int(min(max(msg.get("q", self.quality), 20), 95))
            self.max_width = int(msg.get("w", self.max_width))
            self.force = True
            return
        if not self.app["input"]:
            return
        if t in ("move", "down", "up", "click", "rclick"):
            x, y = self.to_screen(msg["x"], msg["y"])
            move_to(x, y)
            if t == "down":
                button("left", True); self.dragging = True
            elif t == "up":
                button("left", False); self.dragging = False
            elif t == "click":
                button("left", True); button("left", False)
            elif t == "rclick":
                button("right", True); button("right", False)
        elif t == "wheel":
            wheel(msg.get("dx", 0), msg.get("dy", 0))

    def close(self):
        if self.dragging:
            button("left", False)
        self.executor.shutdown(wait=False)


async def ws_handler(request):
    app = request.app
    if app["password"] and request.query.get("key") != app["password"]:
        return web.Response(status=403, text="비밀번호가 틀렸습니다")
    ws = web.WebSocketResponse(heartbeat=10, max_msg_size=1 << 20)
    await ws.prepare(request)
    s = Session(ws, app)
    mon = app["monitors"][s.mon_index - 1]
    await ws.send_str(json.dumps({"t": "hello", "w": mon["width"], "h": mon["height"],
                                  "input": app["input"]}))
    print(f"[+] 연결됨: {request.remote}")
    task = asyncio.create_task(s.stream())
    try:
        async for m in ws:
            if m.type == WSMsgType.TEXT:
                try:
                    s.handle(json.loads(m.data))
                except Exception as e:
                    print("입력 처리 오류:", e)
            elif m.type == WSMsgType.ERROR:
                break
    finally:
        task.cancel()
        s.close()
        print(f"[-] 연결 끊김: {request.remote}")
    return ws


async def index(request):
    return web.FileResponse(STATIC_DIR / "index.html")


def local_ips():
    """iPad가 접속할 IP 목록. 기본 경로(Wi-Fi) IP와 모바일 핫스팟 IP를 앞에 둠."""
    primary = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        primary = s.getsockname()[0]
        s.close()
    except Exception:
        pass
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except Exception:
        pass
    # 루프백, 자동 사설 IP(169.254), VirtualBox 호스트 전용(192.168.56.x) 제외
    ips = {ip for ip in ips if not ip.startswith(("127.", "169.254.", "192.168.56."))}

    def rank(ip):
        if ip == "192.168.137.1":  # Windows 모바일 핫스팟
            return 0
        return 1 if ip == primary else 2
    ordered = sorted(ips | ({primary} if primary else set()), key=lambda ip: (rank(ip), ip))
    return ordered or ["127.0.0.1"]


def print_qr(url):
    try:
        import qrcode
        qr = qrcode.QRCode(border=1)
        qr.add_data(url)
        qr.print_ascii(invert=True)
    except Exception:
        pass


def main():
    p = argparse.ArgumentParser(description="iPad를 Windows의 무선 보조 모니터로 사용")
    p.add_argument("--monitor", type=int, help="스트리밍할 모니터 번호 (--list로 확인)")
    p.add_argument("--list", action="store_true", help="모니터 목록 출력")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--password", default="", help="접속 비밀번호 (선택)")
    p.add_argument("--no-input", action="store_true", help="iPad 터치 조작 끄기")
    a = p.parse_args()

    mons = list_monitors()
    print("\n=== 감지된 모니터 ===")
    for i, m in enumerate(mons, 1):
        tag = " (주 모니터)" if m["left"] == 0 and m["top"] == 0 else ""
        print(f"  {i}: {m['width']}x{m['height']}  위치({m['left']},{m['top']}){tag}")
    if a.list:
        return
    idx = a.monitor or pick_default_monitor(mons)
    if not 1 <= idx <= len(mons):
        print(f"잘못된 모니터 번호: {idx}")
        sys.exit(1)
    if len(mons) == 1:
        print("\n※ 모니터가 1개뿐이라 '화면 복제' 모드로 동작합니다.")
        print("  확장 모드를 쓰려면 README의 '가상 디스플레이 설치'를 따라 하세요.")
    print(f"\n▶ 스트리밍 모니터: {idx}")

    app = web.Application()
    app["monitors"], app["monitor"] = mons, idx
    app["password"], app["input"] = a.password, not a.no_input
    app.router.add_get("/", index)
    app.router.add_get("/ws", ws_handler)
    app.router.add_static("/static", STATIC_DIR)

    ips = local_ips()
    print("\niPad Safari에서 아래 주소로 접속하세요 (같은 Wi-Fi):")
    for ip in ips:
        print(f"   http://{ip}:{a.port}")
    print_qr(f"http://{ips[0]}:{a.port}")
    print("\n종료: Ctrl+C\n")
    web.run_app(app, host="0.0.0.0", port=a.port, print=None)


if __name__ == "__main__":
    main()
