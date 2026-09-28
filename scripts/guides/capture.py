"""Capture real, release-APK interactions on a private Android emulator."""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import shlex
import subprocess
import time
import uuid
import xml.etree.ElementTree as ET

from scenarios import get_scenario

from common import CACHE, CONFIG, content, duration, guide_content, language_tag, run, write_json


def sdk_root():
    path = Path(os.environ.get("ANDROID_SDK_ROOT", os.environ.get("ANDROID_HOME", Path.home() / "android-sdk-linux")))
    if not (path / "platform-tools/adb").exists():
        raise ValueError("Set ANDROID_SDK_ROOT to an installed Android SDK")
    return path


def download(url, destination, checksum=None):
    import requests
    if destination.exists() and (not checksum or hashlib.sha256(destination.read_bytes()).hexdigest() == checksum):
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    if checksum and hashlib.sha256(response.content).hexdigest() != checksum:
        raise ValueError("APK checksum mismatch")
    temporary = destination.with_suffix(".pending")
    temporary.write_bytes(response.content)
    temporary.replace(destination)
    return destination


def resources(language, repo, tag):
    """Release string names remain stable; text follows Android locale fallback."""
    values = {}
    folders = ["values"]
    if language != "en":
        parts = language.split("-")
        folders.append(f"values-{parts[0]}")
        if len(parts) > 1:
            folders.extend([f"values-{parts[0]}-r{parts[1].upper()}", "values-b+" + "+".join(parts)])
    found_translation = language == "en"
    for folder in folders:
        path = f"app/src/main/res/{folder}/strings.xml"
        try:
            if repo and Path(repo).is_dir():
                source = run(["git", "-C", repo, "show", f"{tag}:{path}"])
            else:
                target = CACHE / "resources" / tag / folder / "strings.xml"
                download(f"https://raw.githubusercontent.com/connectbot/connectbot/{tag}/{path}", target)
                source = target.read_text()
        except Exception:
            if folder == "values":
                raise ValueError(f"Cannot load release resources for {tag}") from None
            continue
        if folder != "values":
            found_translation = True
        for node in ET.fromstring(source).findall("string"):
            value = "".join(node.itertext()).strip().strip('"')
            values[node.attrib["name"]] = value.replace("\\'", "'").replace('\\"', '"').replace("\\n", "\n")
    if not found_translation:
        raise ValueError(f"Release {tag} has no resources for {language}")
    return values


class Emulator:
    def __init__(self, api, profile):
        self.api = api
        self.profile = profile
        self.sdk = sdk_root()
        self.adb_path = self.sdk / "platform-tools/adb"
        self.port = int(os.environ.get("GUIDES_EMULATOR_PORT", "5580"))
        self.serial = f"emulator-{self.port}"
        self.process = None
        self.user = 0

    def adb(self, *args):
        return run([self.adb_path, "-s", self.serial, *args])

    def shell(self, *args):
        # adb shell joins arguments into a remote shell command. Preserve spaces
        # in user names and locale values, and never reinterpret their contents.
        return self.adb("shell", shlex.join(str(arg) for arg in args))

    def reset_app(self):
        if self.shell("am", "get-current-user") != str(self.user):
            raise ValueError("The capture Android user is no longer active; refusing to clear app data")
        package = CONFIG["release"]["package"]
        self.shell("pm", "clear", "--user", str(self.user), package)
        if self.api >= 33:
            self.shell("pm", "grant", "--user", str(self.user), package, "android.permission.POST_NOTIFICATIONS")

    def launch_app(self):
        package = CONFIG["release"]["package"]
        self.shell("am", "start", "-W", "--user", str(self.user), "-n", f"{package}/{package}.ui.MainActivity")

    def wait_boot(self):
        deadline = time.monotonic() + 600
        while time.monotonic() < deadline:
            if self.process and self.process.poll() is not None:
                raise ValueError("Capture emulator exited; inspect local/guide-build/emulator.log")
            try:
                if self.shell("getprop", "sys.boot_completed") == "1":
                    self.shell("input", "keyevent", "KEYCODE_WAKEUP")
                    self.shell("wm", "dismiss-keyguard")
                    return
            except subprocess.CalledProcessError:
                pass
            time.sleep(2)
        raise ValueError("Capture emulator did not boot within 600 seconds")

    def __enter__(self):
        name = f"connectbot-guides-api{self.api}"
        devices = run([self.adb_path, "devices"])
        if self.serial in devices:
            marker = CACHE / f"owned-emulator-{self.port}.json"
            if os.environ.get("GUIDES_REUSE_EMULATOR") == "1" and marker.exists() and self.shell("getprop", "ro.boot.qemu.avd_name") == name:
                self.wait_boot()
                return self
            raise ValueError(f"Port {self.port} is already occupied; choose GUIDES_EMULATOR_PORT. No existing device was changed.")
        image = self.sdk / self.profile["image"].replace(";", "/")
        if not image.exists():
            raise ValueError(f"Missing SDK image. Install with sdkmanager '{self.profile['image']}'")
        home = Path(os.environ.get("GUIDES_AVD_HOME", CACHE / "avd"))
        home.mkdir(parents=True, exist_ok=True)
        env = {**os.environ, "ANDROID_AVD_HOME": str(home)}
        manager = self.sdk / "cmdline-tools/latest/bin/avdmanager"
        config = home / f"{name}.avd/config.ini"
        if not config.exists():
            run([manager, "create", "avd", "--name", name, "--package", self.profile["image"], "--device", "pixel_6"], input="no\n", env=env)
        settings = dict(line.split("=", 1) for line in config.read_text().splitlines() if "=" in line)
        settings = {k.strip(): v.strip() for k, v in settings.items()}
        settings.update({"hw.keyboard": "no", "disk.dataPartition.size": "1536M", "hw.lcd.width": str(self.profile["width"]), "hw.lcd.height": str(self.profile["height"]), "hw.lcd.density": str(self.profile["density"])})
        config.write_text("".join(f"{key} = {value}\n" for key, value in settings.items()))
        self.log = (CACHE / "emulator.log").open("w")
        self.process = subprocess.Popen([str(self.sdk / "emulator/emulator"), "-avd", name, "-port", str(self.port), "-no-window", "-no-audio", "-no-snapshot", "-no-boot-anim", "-gpu", "swiftshader_indirect", "-memory", "3072"], env=env, stdout=self.log, stderr=subprocess.STDOUT)
        write_json(CACHE / f"owned-emulator-{self.port}.json", {"pid": self.process.pid, "name": name})
        try:
            self.wait_boot()
            return self
        except BaseException:
            self.__exit__(None, None, None)
            raise

    def __exit__(self, *_):
        if os.environ.get("GUIDES_KEEP_EMULATOR") == "1":
            if hasattr(self, "log"):
                self.log.close()
            return
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        elif self.process is None:
            self.adb("emu", "kill")
        if hasattr(self, "log"):
            self.log.close()

    def configure(self, language, theme):
        language = "en-US" if language == "en" else language
        self.adb("root")
        self.adb("wait-for-device")
        # System locale also localizes the IME and system dialogs, including pre-33 Android.
        current = self.shell("getprop", "persist.sys.locale") or self.shell("getprop", "ro.product.locale")
        if current != language and not ("-" not in language and current.startswith(language + "-")):
            self.shell("setprop", "persist.sys.locale", language)
            self.shell("setprop", "sys.boot_completed", "0")
            self.shell("stop")
            self.shell("start")
            self.wait_boot()
            if self.shell("getprop", "persist.sys.locale") != language:
                raise ValueError("System locale could not be set")
        self.shell("wm", "size", f"{self.profile['width']}x{self.profile['height']}")
        self.shell("wm", "density", str(self.profile["density"]))
        self.shell("settings", "put", "system", "accelerometer_rotation", "0")
        self.shell("settings", "put", "system", "user_rotation", "0")
        self.shell("cmd", "uimode", "night", "yes" if theme == "dark" else "no")
        self.shell("cmd", "overlay", "enable-exclusive", "--category", "com.android.internal.systemui.navbar.threebutton")
        self.shell("settings", "put", "system", "show_touches", "1")
        self.shell("settings", "put", "secure", "show_ime_with_hard_keyboard", "1")
        self.shell("settings", "put", "global", "sysui_demo_allowed", "1")
        self.shell("am", "broadcast", "--async", "--receiver-foreground", "-a", "com.android.systemui.demo", "-e", "command", "clock", "-e", "hhmm", "0941")
        self.shell("am", "broadcast", "--async", "--receiver-foreground", "-a", "com.android.systemui.demo", "-e", "command", "battery", "-e", "level", "100", "-e", "plugged", "false")
        self.shell("am", "broadcast", "--async", "--receiver-foreground", "-a", "com.android.systemui.demo", "-e", "command", "notifications", "-e", "visible", "false")


class Phone(Emulator):
    """Use the installed APK in an owned disposable Android user, never user 0."""
    def __init__(self, serial):
        self.sdk = sdk_root()
        self.adb_path = self.sdk / "platform-tools/adb"
        self.serial = serial
        self.api = int(self.shell("getprop", "ro.build.version.sdk"))
        if self.api < 33:
            raise ValueError("Physical-device locale capture requires Android API 33+")
        self.profile = {"device": self.shell("getprop", "ro.product.model"), "kind": "physical"}
        self.marker = CACHE / "phone-user.json"

    def __enter__(self):
        existing = json.loads(self.marker.read_text()) if self.marker.exists() else None
        users = self.shell("pm", "list", "users")
        if existing and existing["serial"] == self.serial and f"UserInfo{{{existing['user']}:" in users:
            if f"UserInfo{{{existing['user']}:{existing.get('name', 'ConnectBot guide captures')}:" not in users:
                raise ValueError("Saved phone capture user has changed identity; refusing to reuse it")
            self.user, self.original_user = existing["user"], existing["originalUser"]
        else:
            self.original_user = int(self.shell("am", "get-current-user"))
            result = self.shell("pm", "create-user", "--ephemeral", "ConnectBot guide captures")
            match = re.search(r"created user id (\d+)", result)
            if not match:
                raise ValueError("Phone does not permit a disposable Android user: " + result)
            self.user = int(match.group(1))
            write_json(self.marker, {"serial": self.serial, "user": self.user, "originalUser": self.original_user, "name": "ConnectBot guide captures"})
        if self.user == 0 or self.user == self.original_user:
            raise ValueError("Refusing to capture in the personal Android user")
        try:
            self.shell("cmd", "package", "install-existing", "--user", str(self.user), CONFIG["release"]["package"])
            self.shell("am", "start-user", "-w", str(self.user))
            self.shell("settings", "--user", str(self.user), "put", "secure", "user_setup_complete", "1")
            self.shell("am", "switch-user", str(self.user))
            self.shell("input", "keyevent", "KEYCODE_WAKEUP")
            self.shell("wm", "dismiss-keyguard")
            self.shell("cmd", "overlay", "enable-exclusive", "--user", str(self.user), "--category", "com.android.internal.systemui.navbar.threebutton")
            self.shell("settings", "--user", str(self.user), "put", "system", "show_touches", "1")
            # UIAutomator input need not reset Android's inactivity timer.
            # Keep only the disposable capture user awake throughout a scenario.
            self.shell("settings", "--user", str(self.user), "put", "system", "screen_off_timeout", "1800000")
            return self
        except BaseException:
            self.__exit__(None, None, None)
            raise

    def __exit__(self, *_):
        if os.environ.get("GUIDES_KEEP_PHONE_USER") == "1":
            return
        self.shell("am", "switch-user", str(self.original_user))
        # Android may remove an ephemeral user as soon as it is switched out.
        for command in (("am", "stop-user", "-w"), ("pm", "remove-user", "--wait")):
            if f"UserInfo{{{self.user}:" not in self.shell("pm", "list", "users"):
                break
            try:
                self.shell(*command, str(self.user))
            except subprocess.CalledProcessError:
                if f"UserInfo{{{self.user}:" in self.shell("pm", "list", "users"):
                    raise
        self.marker.unlink(missing_ok=True)

    def configure(self, language, theme):
        self.language = "en-US" if language == "en" else language

    def reset_app(self):
        super().reset_app()
        self.shell("cmd", "locale", "set-app-locales", CONFIG["release"]["package"], "--user", str(self.user), "--locales", self.language)


class Capture:
    def __init__(self, emulator, labels, directory):
        import uiautomator2 as u2
        self.emulator = emulator
        self.d = u2.connect(emulator.serial)
        self.labels = labels
        self.directory = directory
        self.width, self.height = self.d.window_size()
        self.steps = []
        self.events = []
        self.current = None
        self.started = None
        self.d.implicitly_wait(5)

    def label(self, key):
        if key not in self.labels:
            raise ValueError(f"Unknown release resource: {key}")
        return self.labels[key]

    def node(self, key=None, *, text=None, description=False, scroll=False):
        selector = {"description" if description else "text": text if text is not None else self.label(key)}
        attribute = "content-desc" if description else "text"
        value = next(iter(selector.values()))
        for attempt in range(18 if scroll else 20):
            # Search the full semantics hierarchy. Native UiSelector queries
            # can omit Compose terminal controls and secondary system windows.
            nodes = self.d.xpath('//*').all()
            matches = [node for node in nodes if node.attrib.get(attribute) == value]
            if len(matches) == 1:
                return matches[0]
            if matches:
                candidates = [node for node in nodes if node.attrib.get("clickable") == "true"
                              and any(child.get(attribute) == value for child in node.elem.iter())]
                if len(candidates) == 1:
                    return candidates[0]
                raise ValueError(f"Ambiguous UI selector: {selector}")
            if scroll:
                self.d.swipe(self.width * .5, self.height * .78, self.width * .5, self.height * .36, duration=.5)
            time.sleep(.4)
        raise ValueError(f"UI control not found: {selector}")

    def center_setting(self, key):
        """Find a Settings row quickly and leave it in the visual center."""
        label = self.label(key)
        for _ in range(12):
            matches = [n for n in self.d.xpath('//*').all() if n.attrib.get("text") == label]
            if matches:
                bounds = matches[0].info["bounds"]
                offset = (bounds["top"] + bounds["bottom"]) / 2 - self.height * .52
                if abs(offset) < self.height * .07:
                    return matches[0]
                start = self.height * (.72 if offset > 0 else .28)
                end = max(self.height * .16, min(self.height * .84, start - offset))
            else:
                start, end = self.height * .82, self.height * .22
            # Move quickly, then pause with the finger down before lifting.
            # This produces a fast drag without Android's inertial fling.
            x = self.width * .5
            self.d.touch.down(x, start)
            self.d.touch.move(x, (start + end) / 2)
            self.d.touch.move(x, end)
            time.sleep(.15)
            self.d.touch.up(x, end)
            time.sleep(.15)
        raise ValueError(f"Could not center Settings control: {key}")

    def timestamp(self):
        return time.monotonic() - self.started if self.started else 0

    def set_font_size(self, size):
        prefix = self.label("profile_editor_font_size_title").split("%d")[0]
        fraction = (size - 6) / 24
        for _ in range(5):
            sliders = self.d.xpath('//android.widget.SeekBar').all()
            if len(sliders) != 1:
                raise ValueError("Expected one font-size slider")
            self.tap(sliders[0], fraction=max(.05, min(.95, fraction)))
            labels = [n.attrib.get("text", "") for n in self.d.xpath('//*').all()]
            values = [int(match.group()) for label in labels if label.startswith(prefix)
                      if (match := re.search(r"\d+", label))]
            if len(values) != 1:
                raise ValueError("Could not read the selected font size")
            if values[0] == size:
                return
            fraction += (size - values[0]) / 24
        raise ValueError(f"Could not select font size {size}")

    def tap(self, node, fraction=.5):
        bounds = node.info["bounds"]
        x = bounds["left"] + (bounds["right"] - bounds["left"]) * fraction
        y = (bounds["top"] + bounds["bottom"]) / 2
        if self.current is not None and "hotspot" not in self.current:
            self.current["hotspot"] = {"x": bounds["left"] / self.width, "y": bounds["top"] / self.height, "width": (bounds["right"] - bounds["left"]) / self.width, "height": (bounds["bottom"] - bounds["top"]) / self.height}
        if self.started:
            self.events.append({"time": self.timestamp(), "x": x, "y": y, "step": self.current["id"] if self.current else None})
        self.d.click(x, y)
        time.sleep(.7)

    def click(self, key=None, **kwargs):
        self.tap(self.node(key, **kwargs))

    def click_action(self, key):
        # Releases may present toolbar actions as text or accessible icons.
        if any(n.attrib.get("content-desc") == self.label(key) for n in self.d.xpath('//*').all()):
            self.click(key, description=True)
        else:
            self.click(key)

    def fill(self, text):
        # Compose dropdowns also expose EditText; the fresh input is empty.
        node = self.d(className="android.widget.EditText", text="")
        if not node.wait(timeout=10) or node.count != 1:
            raise ValueError("Expected one editable field")
        # Dialog inputs can autofocus and move when the IME appears. Avoid a
        # redundant tap at the field's old position, outside the moved dialog.
        if not node.info.get("focused"):
            self.tap(node)
        node.set_text(text)
        if not self.d(className="android.widget.EditText", text=text).exists(timeout=10):
            raise ValueError("Entered text did not appear in the input")

    def hide_keyboard(self):
        package = self.emulator.shell("settings", "get", "secure", "default_input_method").split("/")[0]
        keyboard = self.d.xpath(f'//*[@package="{package}"]')
        if keyboard.wait(timeout=5):
            self.back(keyboard=True)

    def back(self, keyboard=False):
        # Tap Android's actual Back button so it is visible in video and the event trace.
        # UiSelector.count omits secondary system windows on newer Android.
        buttons = self.d.xpath('//*[@resource-id="com.android.systemui:id/back" or @resource-id="com.google.android.apps.nexuslauncher:id/back"]').all()
        if len(buttons) == 1:
            self.tap(buttons[0])
            return
        # A physical phone may retain gesture navigation. Use the visible
        # toolbar action when navigating, or Android Back to dismiss its IME.
        up = self.d.xpath('//*[@content-desc="Navigate up"]').all()
        if not keyboard and len(up) == 1:
            self.tap(up[0])
        else:
            self.d.press("back")
            time.sleep(.7)

    @contextmanager
    def step(self, step_id):
        print(f"  step {step_id}", flush=True)
        time.sleep(.4)
        image = f"{step_id}.png"
        self.d.screenshot(str(self.directory / image))
        step = {"id": step_id, "startSeconds": self.timestamp(), "image": image}
        if self.steps:
            self.steps[-1]["endSeconds"] = step["startSeconds"]
        self.current = step
        self.steps.append(step)
        time.sleep(.8)
        yield
        # Only this settled tail may be extended for narration. Verification waits happen above.
        time.sleep(.5)
        step["holdStartSeconds"] = self.timestamp()
        self.d.screenshot(str(self.directory / f"{step_id}-hold.png"))
        time.sleep(.6)
        self.current = None

    def start(self):
        self.video_log = (self.directory / "screenrecord.log").open("w")
        self.remote_video = f"/data/local/tmp/connectbot-guide-{uuid.uuid4().hex}.mp4"
        self.started = time.monotonic()
        command = "echo $$; exec " + shlex.join(["screenrecord", "--verbose", "--bit-rate", "16000000", "--time-limit", "180", self.remote_video])
        self.recorder = subprocess.Popen([str(self.emulator.adb_path), "-s", self.emulator.serial, "shell", command], stdout=self.video_log, stderr=subprocess.STDOUT)
        for _ in range(50):
            lines = (self.directory / "screenrecord.log").read_text().splitlines()
            if lines and lines[0].strip().isdigit():
                self.remote_recorder_pid = lines[0].strip()
                break
            time.sleep(.1)
        else:
            self.recorder.terminate()
            raise ValueError("Could not identify the capture screen recorder")
        time.sleep(1)
        if self.recorder.poll() is not None:
            raise ValueError("Android screenrecord failed; see capture diagnostics")

    def stop(self):
        if hasattr(self, "recorder"):
            ended = self.timestamp()
            if self.recorder.poll() is not None or ended >= 178:
                raise ValueError("Screen recording exited before the scenario completed")
            self.emulator.shell("kill", "-2", self.remote_recorder_pid)
            self.recorder.wait(timeout=15)
            self.video_log.close()
            self.emulator.adb("pull", self.remote_video, str(self.directory / "raw.mp4"))
            self.emulator.shell("rm", "-f", self.remote_video)
            total = duration(self.directory / "raw.mp4")
            if total <= 0:
                raise ValueError("Screen recording is empty")
            if self.steps:
                # Android encodes changed frames only. The last stable hold may
                # extend beyond the final MP4 timestamp; rendering pads it.
                self.steps[-1]["endSeconds"] = ended
            self.started = None
            del self.recorder

    def setup(self, theme):
        package = CONFIG["release"]["package"]
        self.emulator.reset_app()
        self.emulator.launch_app()
        # First boot can finish before System UI has settled. Recover only here,
        # before recording; a system dialog during a scenario must fail capture.
        menu = self.d(description=self.label("button_more_options"))
        for _ in range(3):
            if menu.exists(timeout=20):
                break
            waiting = self.d(resourceId="android:id/aerr_wait")
            if waiting.exists:
                waiting.click()
                time.sleep(5)
            self.emulator.launch_app()
        self.node("button_more_options", description=True)
        if isinstance(self.emulator, Phone):
            # Set only this user's app preference; do not change phone-wide mode.
            self.click("button_more_options", description=True)
            self.click("list_menu_settings")
            self.click("pref_theme_title", scroll=True)
            self.click(f"pref_theme_{theme}")
            self.back()
            self.node("button_more_options", description=True)
        # Fresh release preferences follow Android's theme, set by configure().
        # Check an empty Host List background patch before recording.
        from PIL import ImageStat
        x, y = self.width // 2, self.height // 3
        for _ in range(5):
            time.sleep(1)
            image = self.d.screenshot().convert("RGB")
            brightness = sum(ImageStat.Stat(image.crop((x - 10, y - 10, x + 10, y + 10))).mean) / 3
            if (brightness < 128) == (theme == "dark"):
                return
        raise ValueError("The fresh app did not follow the requested Android theme")

    def seed_local(self):
        self.click("hostpref_add_host", description=True)
        self.click("host_editor_show_advanced")
        fields = self.d(className="android.widget.EditText")
        self.tap(fields[0])
        fields[0].set_text("Demo terminal")
        self.hide_keyboard()
        self.click("protocol_spinner_label")
        self.click(text="local")
        self.click_action("hostpref_add_host")
        self.node("button_more_options", description=True)
        self.node(text="Demo terminal")

    def terminal_result(self, special=False):
        self.click(text="Demo terminal")
        self.node(text="Esc")
        time.sleep(6)
        if special:
            self.node(text="Esc")


def capture(languages, apis, themes, guide_id=None, apk=None, tag=None, repo=None, serial=None):
    release = CONFIG["release"]
    if apk and not tag:
        raise ValueError("APK overrides require --resource-tag matching that APK")
    if serial and (apk or not tag):
        raise ValueError("Phone capture reuses its installed APK; pass --resource-tag matching that build, without --apk")
    tag = tag or release["tag"]
    phone = Phone(serial) if serial else None
    if phone:
        apis = [phone.api]
        package_path = phone.shell("pm", "path", release["package"]).splitlines()[0].removeprefix("package:")
        apk_sha = phone.shell("sha256sum", package_path).split()[0]
    else:
        apk_path = Path(apk).resolve() if apk else download(release["url"], CACHE / "apk" / "connectbot.apk", release["sha256"])
        apk_sha = hashlib.sha256(apk_path.read_bytes()).hexdigest()
    guides = [g for g in content() if not guide_id or g["id"] == guide_id]
    for api in apis:
        if not phone and str(api) not in CONFIG["profiles"]:
            raise ValueError(f"Add an explicit emulator profile for API {api} to config.json")
        profile = phone.profile if phone else CONFIG["profiles"][str(api)]
        with phone if phone else Emulator(api, profile) as emulator:
            if not phone:
                installed_sha = None
                try:
                    installed = emulator.shell("pm", "path", release["package"]).splitlines()
                    if installed:
                        installed_sha = emulator.shell("sha256sum", installed[0].removeprefix("package:")).split()[0]
                except subprocess.CalledProcessError:
                    pass
                if installed_sha != apk_sha:
                    emulator.adb("install", "-r", str(apk_path))
            for language in languages:
                labels = resources(language_tag(language), repo, tag)
                for theme in themes:
                    emulator.configure(language, theme)
                    for guide in guides:
                        identifier = f"{guide['id']}/{language}/api-{api}/{theme}"
                        print(f"Capturing {identifier}", flush=True)
                        target = CACHE / "captures" / identifier
                        pending = target.with_name(theme + ".pending")
                        if pending.exists():
                            shutil.rmtree(pending)
                        pending.mkdir(parents=True)
                        c = Capture(emulator, labels, pending)
                        try:
                            scenario = get_scenario(guide["id"])
                            c.setup(theme)
                            if scenario.SEED_LOCAL:
                                c.seed_local()
                            c.start()
                            scenario.run(c)
                            c.stop()
                            if [s["id"] for s in c.steps] != [s["id"] for s in guide["steps"]]:
                                raise ValueError("Scenario steps differ from guide prose")
                            package_info = emulator.shell("dumpsys", "package", release["package"])
                            version = re.search(r"versionName=(\S+)", package_info).group(1)
                            write_json(pending / "capture.json", {"guide": guide["id"], "language": language, "apiLevel": api, "theme": theme, "width": c.width, "height": c.height, "appVersion": version, "steps": c.steps, "events": c.events, "provenance": {"apkSha256": apk_sha, "resourceTag": tag, "profile": profile, "systemImage": emulator.shell("getprop", "ro.build.fingerprint"), "ime": emulator.shell("settings", "get", "secure", "default_input_method"), "adb": run([emulator.adb_path, "version"])}})
                            if target.exists():
                                shutil.rmtree(target)
                            pending.rename(target)
                        except BaseException:
                            try:
                                c.d.screenshot(str(pending / "failure.png"))
                                (pending / "failure.xml").write_text(c.d.dump_hierarchy())
                                c.stop()
                            except Exception:
                                pass
                            raise
