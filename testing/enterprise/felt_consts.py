#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.


config_prefs = [
    ["enterprise.configs.learn_more_url", ""],
    ["enterprise.configs.company_logo_url", ""],
    ["browser.policies.live_polling.frequency", 500],
    ["identity.sync.tokenserver.uri", ""],
    ["dom.push.serverURL", ""],
    # Not checking remote settings url (services.settings.server),
    # it's pre-populated in marionette test environemtns:
    #  https://searchfox.org/firefox-main/rev/9a3317a65545e83f4e32b94fdf1f6860342423ef/remote/shared/RecommendedPreferences.sys.mjs#381-382
]
