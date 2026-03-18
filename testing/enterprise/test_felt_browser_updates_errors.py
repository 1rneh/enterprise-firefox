#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

import os
import sys

sys.path.append(os.path.dirname(__file__))

from felt_tests import FeltTests


class FeltUpdatesErrorHandling(FeltTests):
    def reload_chrome_window(self):
        self._driver.set_context("chrome")
        self._driver.execute_script(
            """
            window.location.reload();
            """
        )
        self._driver.set_context("content")

    def trigger_appUpdater_error(self, error):
        self._driver.set_context("chrome")
        self._driver.execute_script(
            """
            const { AppUpdater } = ChromeUtils.importESModule("resource://gre/modules/AppUpdater.sys.mjs");
            const { Updates } = ChromeUtils.importESModule("resource:///modules/enterprise/Updates.sys.mjs");
            Updates.appUpdaterCallback(AppUpdater.STATUS[arguments[0]]);
            """,
            [error],
        )
        self._driver.set_context("content")

    def get_error(self, error_name):
        self.reload_chrome_window()
        self._logger.info(f"Simulating AppUpdater error: {error_name}")
        self.trigger_appUpdater_error(error_name)

        self._driver.set_context("chrome")

        browser_error = self.get_elem(".felt-browser-error")
        assert browser_error, "Error dialog present"

        error_details = self.get_elem(
            ".felt-updates-error-messages .felt-browser-error-details"
        )
        error_msg = error_details.text

        self._driver.set_context("content")

        return error_msg

    def test_felt_updates_error_handling(self):
        # We are not going to start the browser so do not try to close it
        self._manually_closed_child = True
        # Make sure the iteration and callable() check below will not choke on
        # this missing attribute
        self._child_driver = None

        object_methods = [
            method_name
            for method_name in dir(self)
            if callable(getattr(self, method_name))
            and method_name.startswith("run_error")
        ]
        for m in object_methods:
            getattr(self, m)()

    def exec_error(self, name, error):
        err = self.get_error(name)
        assert err == error, f"Error details '{err}' is correct, expected '{error}'"

    def run_error_manual_update(self):
        self.exec_error("MANUAL_UPDATE", "Please contact your administrator.")

    def run_error_internal_error(self):
        self.exec_error("INTERNAL_ERROR", "Please contact your administrator.")

    def run_error_unsupported_system(self):
        self.exec_error(
            "UNSUPPORTED_SYSTEM",
            "Your current system does not support this new version. Please contact your administrator.",
        )

    def run_error_checking_failed(self):
        self.exec_error(
            "CHECKING_FAILED",
            "Unexpected failure while checking for an update. Please contact your administrator.",
        )
