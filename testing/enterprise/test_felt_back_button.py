#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys

sys.path.append(os.path.dirname(__file__))

from felt_tests import FeltTests

ERROR_BAR_SELECTORS = (
    ".felt-browser-error-connection",
    ".felt-browser-error-no-network",
)


class FeltBackButton(FeltTests):
    """
    Test the FELT login "Back to login" button: it stays hidden until the user
    reaches the SSO pane, clicking it returns to the email pane (hiding itself
    and the SSO pane), and it is never shown when the sign-in attempt fails to
    move past the email pane.
    """

    def teardown(self):
        # Neither test completes authentication, so no child browser is ever
        # launched and there is nothing for the base teardown to close.
        self._manually_closed_child = True
        super().teardown()

    def _back_button_hidden(self):
        return not self.find_elem("#felt-back-button").is_displayed()

    def _error_bar_shown(self):
        return any(self.find_elem(sel).is_displayed() for sel in ERROR_BAR_SELECTORS)

    def test_felt_back_button(self):
        self._driver.set_context("chrome")
        assert self._back_button_hidden(), (
            "Back button is hidden before the user starts signing in"
        )
        self._driver.set_context("content")

        self.run_felt_chrome_on_email_submit()
        self.run_wait_until_sso_loaded()

        self._driver.set_context("chrome")
        self._wait.until(
            lambda _: not self._back_button_hidden(),
            message="Back button is revealed once the SSO pane is shown",
        )

        self.get_elem("#felt-back-button").click()

        def reset_done(_):
            return (
                self._back_button_hidden()
                and not self.find_elem(".felt-login__sso").is_displayed()
                and self.find_elem(".felt-login__email-pane").is_displayed()
            )

        self._wait.until(
            reset_done,
            message="Back returns to the email pane and re-hides the button",
        )
        self._driver.set_context("content")
