#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

import os
import sys

sys.path.append(os.path.dirname(__file__))

from felt_tests import FeltTests
from marionette_driver.errors import (
    NoSuchWindowException,
    UnknownException,
)


class AppRestartPersistsSession(FeltTests):
    """A FELT restart must preserve the open tabs.

    Seeds tabs, restarts, and reconnects to the relaunched browser
    to confirm it resumed the session with those tabs open.
    """

    def test_restart_persists_session(self):
        super().run_felt_base()

        session_tabs = [
            "about:support",
            "about:policies",
            f"http://localhost:{self.console_port}/ping",
        ]

        self.connect_child_browser()
        self._browser_pid = self._child_driver.session_capabilities["moz:processID"]

        self._open_child_tabs(session_tabs)
        opened = self._child_tab_urls()
        assert set(session_tabs).issubset(opened), (
            f"Tabs were not open before the restart: {opened}"
        )

        self._child_longwait.until(
            lambda _: set(session_tabs).issubset(self._child_session_urls()),
            message="SessionStore did not record the tabs before restart",
        )

        self.issue_child_restart()
        self.wait_process_exit(self._browser_pid)

        self._logger.info("Connecting to new browser")
        self.connect_child_browser()
        new_browser_pid = self._child_driver.session_capabilities["moz:processID"]
        assert new_browser_pid != self._browser_pid, (
            f"Expected a new process, still {new_browser_pid}"
        )

        self._child_longwait.until(
            lambda _: set(session_tabs).issubset(set(self._child_tab_urls())),
            message="Relaunched browser did not restore the session tabs",
        )

    def issue_child_restart(self):
        try:
            self._logger.info("Issuing restart being done by felt")
            self._child_driver.set_context("chrome")
            self._child_driver.execute_script(
                "Services.startup.quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit);"
            )
        except UnknownException:
            self._logger.info("Received expected UnknownException")
        except NoSuchWindowException:
            self._logger.info("Received expected NoSuchWindowException")
        except OSError:
            self._logger.info(
                "Firefox quit before execute_script returned, no data received over Marionette socket"
            )

    def _open_child_tabs(self, urls):
        for url in urls:
            self.open_tab_child(url)

    def _child_tab_urls(self):
        self._child_driver.set_context("chrome")
        return self._child_driver.execute_script(
            "return Array.from(gBrowser.tabs).map(t => t.linkedBrowser.currentURI.spec);"
        )

    def _child_session_urls(self):
        self._child_driver.set_context("chrome")
        return self._child_driver.execute_script(
            """
            const { SessionStore } = ChromeUtils.importESModule(
              "resource:///modules/sessionstore/SessionStore.sys.mjs"
            );
            const state = JSON.parse(SessionStore.getBrowserState());
            return state.windows.flatMap(w =>
              w.tabs.flatMap(t => (t.entries || []).map(e => e.url))
            );
            """
        )
