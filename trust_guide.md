# SmartLab Assist: Student Trust & Security Guide

Windows Smart App Control (SAC) and Defender may block custom tools like **SmartLab Assist** because they are not yet registered with major software vendors. Since this is a private lab tool, you must "trust" it on your machine.

Follow these 3 simple steps to ensure the app runs correctly:

### 1. Unblock the ZIP File (CRITICAL)
Before you extract the files, you must tell Windows the ZIP is safe:
1. **Right-click** on the downloaded `MINIPROCT.zip`.
2. Select **Properties**.
3. At the bottom, look for **Security** and check the box that says **"Unblock"**.
4. Click **Apply** and then **OK**.
5. NOW extract the folder.

### 2. Run Anyway (SmartScreen Bypass)
When you first open `SmartLab_Assist.exe`, you may see a blue "Windows protected your PC" window:
1. Click the **"More info"** link.
2. Click the **"Run anyway"** button that appears.

### 3. Folder Exclusion (Recommended)
To prevent the proctoring engine from being paused by background scans:
1. Search for **"Virus & threat protection"** in the Start Menu.
2. Click **"Manage settings"**.
3. Scroll down to **"Exclusions"** and click **"Add or remove exclusions"**.
4. Click **"Add an exclusion"** -> **"Folder"**.
5. Select the extracted `SmartLab-Release` folder.

---
**Note**: This tool only monitors window titles and process names during the live lab session. It does NOT track personal files or passwords.
