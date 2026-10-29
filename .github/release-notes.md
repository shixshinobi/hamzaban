## دانلود

| سیستم‌عامل | فایل |
| --- | --- |
| ویندوز ۱۰ و ۱۱ (نصب) | `Hamzaban-Setup-…-x64.exe` |
| ویندوز روی پردازنده‌ی ARM (مثل Surface Pro X) | `Hamzaban-Setup-…-arm64.exe` |
| ویندوز (بدون نصب) | `Hamzaban-Portable-….exe` |
| مک با تراشه‌ی Apple (M1 به بعد) | `Hamzaban-…-mac-arm64.dmg` |
| مک اینتل | `Hamzaban-…-mac-x64.dmg` |
| لینوکس (همه‌ی توزیع‌ها) | `Hamzaban-…-linux-x86_64.AppImage` |
| اوبونتو و دبیان | `Hamzaban-…-linux-amd64.deb` |

فایل‌ها را از بخش **Assets** پایین همین صفحه بردارید.

### اولین اجرا

همزبان هنوز امضای دیجیتال پولی ندارد، برای همین سیستم‌عامل بار اول هشدار می‌دهد:

- **ویندوز**: اگر پیام «Windows protected your PC» آمد، روی **More info** و بعد **Run anyway** بزنید.
- **مک**: فایل dmg را باز کنید و همزبان را به Applications بکشید. بار اول روی برنامه راست‌کلیک کنید و **Open** را بزنید. اگر اجازه نداد، به System Settings ← Privacy & Security بروید و **Open Anyway** را بزنید.
- **لینوکس**: برای AppImage یک‌بار `chmod +x Hamzaban-*.AppImage` بزنید و اجرا کنید. برای deb: `sudo apt install ./Hamzaban-*.deb`

---

**English**: pick the file for your system from **Assets** below. Windows: *Setup-…-x64* installs (use *-arm64* on ARM PCs), *Portable* runs without installing. macOS: *arm64* for Apple Silicon, *x64* for Intel. The app is not code-signed yet, so confirm the first launch (Windows: More info → Run anyway; macOS: right-click → Open).
