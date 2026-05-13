import sys
import time
import json
import ctypes
import psutil

EnumWindows = ctypes.windll.user32.EnumWindows
EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int))
GetWindowText = ctypes.windll.user32.GetWindowTextW
GetWindowTextLength = ctypes.windll.user32.GetWindowTextLengthW
IsWindowVisible = ctypes.windll.user32.IsWindowVisible

def get_visible_windows():
    titles = []
    def foreach_window(hwnd, lParam):
        if IsWindowVisible(hwnd):
            length = GetWindowTextLength(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                GetWindowText(hwnd, buff, length + 1)
                title = buff.value
                # Filter out base windows OS blank or useless titles
                if title and title != "Program Manager" and title != "Settings":
                    titles.append(title)
        return True
    EnumWindows(EnumWindowsProc(foreach_window), 0)
    return titles

def get_processes():
    processes = []
    for proc in psutil.process_iter(['name']):
        try:
            name = proc.info.get('name')
            if name:
                processes.append(name.lower())
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return list(set(processes))

def main():
    while True:
        try:
            windows = get_visible_windows()
            processes = get_processes()
            data = {
                "windows": windows,
                "processes": processes
            }
            # Print as a single JSON line to be read by Node.js
            print(json.dumps(data), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)
        time.sleep(2)

if __name__ == "__main__":
    main()
