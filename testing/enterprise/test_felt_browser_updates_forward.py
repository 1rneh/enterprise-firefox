#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

import os
import sys

sys.path.append(os.path.dirname(__file__))

from felt_tests import FeltTests


class FeltUpdatesForward(FeltTests):
    EXTRA_PREFS = {
        "enterprise.felt_tests.should_not_close_window": True,
    }

    def test_felt_updates_forward(self):
        self.run_felt_base()
        self.run_felt_browser_started()
        self.run_felt_trigger_update()
        self.run_felt_check_browser_notification()

    def run_felt_browser_started(self):
        self.connect_child_browser()
        self.open_tab_child("about:support")

    def run_felt_trigger_update(self):
        self._driver.set_context("chrome")
        self._driver.execute_script(
            """
            Services.obs.notifyObservers(null, "update-downloaded", "applied-service");
            """
        )
        self._driver.set_context("content")

    def run_felt_check_browser_notification(self):
        self._child_driver.set_context("chrome")
        notifications = self._child_driver.execute_script(
            """
            const { AppMenuNotifications } = ChromeUtils.importESModule("resource://gre/modules/AppMenuNotifications.sys.mjs");
            return AppMenuNotifications.notifications;
            """
        )
        self._child_driver.set_context("content")

        found_update_ready = False
        for notification in notifications:
            if notification["id"] == "update-restart":
                found_update_ready = True
                break

        assert found_update_ready, "Found an update-restart notification"
