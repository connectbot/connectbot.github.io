"""Capture the terminal-appearance walkthrough."""

SEED_LOCAL = True


def run(c):
    with c.step("open-menu"):
        c.click("button_more_options", description=True)
    with c.step("open-profiles"):
        c.click("profile_list_title")
    with c.step("create-profile"):
        c.click("profile_list_create_profile", description=True)
        c.fill("Readable")
        c.click("profile_create_button")
        c.click(text="Readable")
        c.node("profile_editor_section_color_scheme")
    with c.step("choose-colors"):
        # Click the selected scheme field, then the release's built-in preset name.
        c.click(text="Default")
        c.click(text="Solarized Dark")
    with c.step("choose-font"):
        c.node("profile_editor_section_font", scroll=True)
        c.set_font_size(16)
    with c.step("save-profile"):
        c.click("profile_editor_save", description=True)
        c.back()
    with c.step("assign-profile"):
        # Host row menu is scoped by its vertical bounds, independent of LTR/RTL.
        row = c.node(text="Demo terminal").info["bounds"]
        buttons = c.d(description=c.label("button_host_options"))
        targets = [buttons[i] for i in range(buttons.count) if buttons[i].info["bounds"]["top"] >= row["top"] - 80]
        if len(targets) != 1:
            raise ValueError("Could not uniquely identify the host row menu")
        c.tap(targets[0])
        c.click("list_host_edit")
        profile = c.node("hostpref_profile_title", scroll=True).info["bounds"]
        # New hosts may already use the Default profile rather than None.
        # Locate the profile field below its label, regardless of its value.
        fields = sorted(
            (field for field in c.d.xpath('//android.widget.EditText').all()
             if field.info["bounds"]["top"] >= profile["bottom"]),
            key=lambda field: field.info["bounds"]["top"],
        )
        if not fields:
            raise ValueError("Could not find the host profile selector")
        c.tap(fields[0])
        c.click(text="Readable")
        c.click_action("hostpref_save_host")
    with c.step("show-result"):
        c.terminal_result()
