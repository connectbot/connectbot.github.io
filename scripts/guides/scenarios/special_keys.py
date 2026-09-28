"""Capture the special-keys walkthrough."""

import re
import xml.etree.ElementTree as ET

SEED_LOCAL = True


def run(c):
    with c.step("open-menu"):
        c.click("button_more_options", description=True)
    with c.step("open-settings"):
        c.click("list_menu_settings")
    with c.step("find-keyboard"):
        c.center_setting("pref_alwaysvisible_title")
    with c.step("enable-special-keys"):
        c.click("pref_alwaysvisible_title")
        # Switch semantics expose the state on a sibling/parent of the text.
        row = c.node("pref_alwaysvisible_title").info["bounds"]
        tree = ET.fromstring(c.d.dump_hierarchy())
        switches = []
        for node in tree.iter("node"):
            bounds = [int(n) for n in re.findall(r"\d+", node.attrib.get("bounds", ""))]
            if node.attrib.get("checkable") == "true" and len(bounds) == 4 and bounds[1] < row["bottom"] and bounds[3] > row["top"]:
                switches.append(node)
        if not switches or not all(n.attrib.get("checked") == "true" for n in switches):
            raise ValueError("Special-key switch did not turn on")
    with c.step("return-to-hosts"):
        c.back()
    with c.step("show-result"):
        c.terminal_result(special=True)
