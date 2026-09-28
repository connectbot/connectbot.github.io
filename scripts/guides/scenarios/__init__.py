"""Guide scenarios and their pre-recording setup requirements."""
from . import add_host, special_keys, terminal_appearance

SCENARIOS = {
    "add-host": add_host,
    "special-keys": special_keys,
    "terminal-appearance": terminal_appearance,
}


def get_scenario(guide_id):
    try:
        return SCENARIOS[guide_id]
    except KeyError:
        raise ValueError(f"No capture scenario: {guide_id}") from None
