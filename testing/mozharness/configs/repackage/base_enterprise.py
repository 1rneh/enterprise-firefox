# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


config = {
    "locales-file": "browser/locales/enterprise-l10n-changesets.json",
    # The AutoConfig file named by general.config.filename is customized in
    # place by administrators, so updates must not carry or touch it.
    "mar-exclude": ["{package-name}.cfg"],
}
