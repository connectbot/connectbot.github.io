"""Capture the add-host walkthrough."""

SEED_LOCAL = False


def run(c):
    with c.step("add-host"):
        c.click("hostpref_add_host", description=True)
    with c.step("enter-address"):
        c.fill("demo@example.com:22")
        c.hide_keyboard()
    with c.step("save-host"):
        c.click_action("hostpref_add_host")
    with c.step("show-result"):
        c.node("button_more_options", description=True)
        c.node(text="demo@example.com:22")
