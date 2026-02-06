# Archive Browser

Browser dedicated for archival purposes. It has the “auto-capture” feature
that allows to save resources from websites directly to local storage.
This feature captures all elements required to display a webpage, including
images and scripts.

Made with Electron.

Downloads:

- Download for Windows 32-bit: [113 MB](https://github.com/glennhenry/Archive-Browser/releases/download/1/Archive.Browser-win32.zip)
- Download for Windows 64-bit: [131 MB](https://github.com/glennhenry/Archive-Browser/releases/download/1/Archive.Browser-win32-x64.zip)
- Download for macOS ARM 64: [330 MB](https://github.com/glennhenry/Archive-Browser/releases/download/1/Archive.Browser-darwin-arm64.zip)
- Download for macOS 64-bit: [340 MB](https://github.com/glennhenry/Archive-Browser/releases/download/1/Archive.Browser-darwin-x64.zip)
- Download for Linux 64-bit: [111 MB](https://github.com/glennhenry/Archive-Browser/releases/download/1/Archive.Browser-linux-x64.zip.zip)

## Details

The auto-capture system only captures responses from GET requests and only
saves URLs that match the whitelist criteria. Previously downloaded files will
not be saved again unless permitted by your overwrite settings.

The capture is done by making double request to the site, where the first
is the browser's internal request, and the second is the system custom request
that save resources with a write file stream.

### Summary

- You need to provide `whitelist.txt` to control the auto-capture.
- `capture.cfg` for browser configuration (capture setting, overwrite mode, enable log).
- Logs are produced to the `logs` directory.
- `output` directory is the auto-capture output.

You can also run the browser from terminal (e.g., `.\"Archive Browser.exe"` in windows bat) to see the live log.

### Usage

The browser will start capturing after it is enabled via the capture menu bar.
You can modify its behavior: which URLs should be captured and the overwrite mode.
Create a file named “whitelist.txt” that defines which URLs should be captured.

Rules:

- One rule per line
- Lines starting with “#” are ignored
- A line with “\*” captures everything
- A line starting with “!” blocks URLs containing that word
- A normal word allows URLs containing that word
- Block rules (“!”) always override allow rules.

Example:

```
*
swf
!ads
game
```

This tells the auto-capture to download every resource, but any URL that contains
the word “ads” will be excluded.

Then, select from several overwrite options for handling files that the
browser loads multiple times:

- Never overwrite
- Always overwrite every 1 week
- Always overwrite every 1 month
- Always overwrite

You can set default capture system behavior by creating a
file named “capture.cfg.”

Each setting uses the format “key=value”. Lines starting
with “#” are ignored.

Available settings:

- “captureOnStart”:
  - 1 = start capturing automatically when the app opens.
  - 0 = don't start automatically.
  - Default: 0.
- “overwriteMode”:
  - 1-4, corresponds to the four overwrite options above.
  - Default: 1.
- “disableLogs”:
  - 1 = disable capture logging
  - 2 = enable capture logging (output in “logs” directory)
  - Default: 1.

Example:

```
captureOnStart=1
overwriteMode=0
```

### Result

Captured resources will maintain the original URL structure as a directory
hierarchy, omitting any invalid characters for the file system
(i.e., query symbols will be excluded). URLs without file extensions will
be saved as `index.html`.

It will also produce “capture-log-[timestamp].txt” for each capture session
(created whenever capturing is stopped or the browser is closed).
This log contains the list of resource the browser loaded, including the status
of whether it is captured or not.

Capture log can be seen directly from the log file, or from terminal by running
the app from terminal itself.

There are five kinds of capture status:

- Saved (new file)
- Ignored (already in disk)
- Ignored (not in whitelist)
- Error (request/write/capture) [with the error message]

## Limitation

The browser is made solely for the auto-capture. It shouldn't be used
for day-to-day tasks.

- UI is not polished.
- Doesn't have many basic browser features (such as address bar).
- Doesn't save cookie or cache pages.
- Doesn't support flash contents.
