# Archive Browser

![Image](resources/logo.png)

A browser dedicated for archival purposes. It has the “auto-capture” feature that allows you to save resources from websites directly to local storage. This feature captures all elements required to display a webpage, including images and scripts.

Made with Electron.

Downloads:

- Download for Windows 32-bit: [125 MB](https://github.com/glennhenry/Archive-Browser/releases/download/v1.0.1/Archive.Browser-windows-32bit.zip)
- Download for Windows 64-bit: [144 MB](https://github.com/glennhenry/Archive-Browser/releases/download/v1.0.1/Archive.Browser-windows-64bit.zip)
- Download for macOS ARM 64: [345 MB](https://github.com/glennhenry/Archive-Browser/releases/download/v1.0.1/Archive.Browser-macos-arm64.zip)
- Download for macOS 64-bit: [363 MB](https://github.com/glennhenry/Archive-Browser/releases/download/v1.0.1/Archive.Browser-macos-x64.zip)
- Download for Linux 64-bit: [121 MB](https://github.com/glennhenry/Archive-Browser/releases/download/v1.0.1/Archive.Browser-linux-64bit.zip)

## Details

The auto-capture system only captures responses from GET requests and only saves URLs that match the whitelist criteria. Previously downloaded files will not be saved again unless permitted by your overwrite settings.

The capture is done by making double request to the site, where the first is the browser's internal request, and the second is the system custom request that save resources with a write file stream.

### Summary

- Create or edit the `config.json`. If that file is missing, you can download `config.json` and place it next to your executable (not sure if this works on MacOS).
- Logs are produced to the `logs` directory.
- `output` directory is the auto-capture output.

You can also run the browser from terminal (e.g., `.\"Archive Browser.exe"` in windows bat) to see the live log.

### Configs

The default config:

```json
{
  "startUrl": "https://google.com",
  "warnBeforeClose": true,
  "whitelist": ["*"],
  "captureOnStart": false,
  "overwriteMode": "never",
  "disableLogs": false
}
```

- `startUrl`: Designate the starting URL of the browser.
- `warnBeforeClose`: Whether to give you a warning before closing the browser.
- `whitelist`: The list of URL to capture. See usage below for format.
- `captureOnStart`: Whether to start capture directly when browser is opened.
- `overwriteMode`: Whether to overwrite captured URL. See usage below for options.
- `disableLogs`: Whether to disable capture logs.

The `config.json` represent the initial config from browser. You can also change the config while the browser is running via the menu bar (but this won't modify the `config.json`).

### Usage

The browser will start capturing after it is enabled via the capture menu bar. You can modify its behavior: which URLs should be captured and the overwrite mode. Modify the whitelist that defines which URLs should be captured in `config.json`.

Rules:

- The literal “\*” tells the browser to capture every URLs
- A line starting with “!” blocks URLs containing that word
- A normal word allows URLs containing that word
- Block rules (“!”) always override allow rules.

Example:

```
*
!ads
```

This means:

- `*`: "I want to capture every URL"
- `!ads`: "But if that URL contains 'ads', don't capture it"

```
cdn123
```

This means:

- `cdn123`: "I want to capture every URL that has 'cdn123' in it"
- Since there are no more words, no other URL will be captured.

Then, select from several overwrite options for handling duplicate files:

- "never": Never overwrite: When encountering a duplicate file, never overwrite the already captured file.
- "always-week": Always overwrite every 1 week. When encountering a duplicate file, only overwrite if last capture was 1 week ago.
- "always-month": Always overwrite every 1 month. When encountering a duplicate file, only overwrite if last capture was 1 month ago.
- "always": Always overwrite. When encountering a duplicate file, always overwrite it.

### Result

Captured resources will maintain the original URL structure as a directory hierarchy, omitting any invalid characters for the file system (i.e., query symbols will be excluded). URLs without file extensions will be saved as `index.html`.

It will also produce “capture-log-[timestamp].txt” for each capture session (created whenever capturing is stopped or the browser is closed). This log contains the list of resource the browser loaded, including the status of whether it is captured or not.

Capture log can be seen directly from the log file, or from terminal by running the app from terminal itself.

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
