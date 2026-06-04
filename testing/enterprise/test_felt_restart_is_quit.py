#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

import os
import sys
import time

sys.path.append(os.path.dirname(__file__))

import psutil
from felt_tests import FeltTests
from marionette_driver.errors import (
    NoSuchWindowException,
    UnknownException,
)


class AppRestartIsQuit(FeltTests):
    EXTRA_PREFS = {"enterprise.disable_restart": True}

    def test_app_signout(self):
        super().run_felt_base()
        self.app_name = self._driver.session_capabilities.get("browserName")
        self.run_felt_restart_is_quit()
        self.run_felt_restart_does_not_restart()

    def run_felt_restart_is_quit(self):
        self._logger.info("Connecting to browser")
        self.connect_child_browser()
        self._browser_pid = self._child_driver.session_capabilities["moz:processID"]
        self._logger.info(f"Connected to {self._browser_pid}")

        process = psutil.Process(pid=self._browser_pid)
        self._logger.info(f"PID {self._browser_pid}: {process.name()}")
        assert os.path.basename(process.name()).startswith(self.app_name), (
            f"Process is {self.app_name}"
        )

        try:
            self._logger.info("Issuing restartecting quit being done")
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
                "Firefox quit before execute_script returned, Marionette socket was closed"
            )
        finally:
            self._logger.info(
                f"Issued restartecting quit underway, checking PID {self._browser_pid}"
            )
            self._manually_closed_child = True

    def run_felt_restart_does_not_restart(self):
        self._logger.info("Waiting a few seconds ...")
        if sys.platform == "win32":
            time.sleep(8)
        else:
            time.sleep(3)
        self._logger.info(f"Checking PID {self._browser_pid}")

        if not psutil.pid_exists(self._browser_pid):
            self._logger.info(f"No more PID {self._browser_pid}")
        else:
            try:
                process = psutil.Process(pid=self._browser_pid)
                self._logger.info(
                    f"Found PID {self._browser_pid}: EXE:{process.exe()} :: NAME:{process.name()} :: CMDLINE:{process.cmdline()}"
                )
                assert os.path.basename(process.name()) != self.app_name, (
                    f"Process is not {self.app_name}"
                )
            except psutil.ZombieProcess:
                self._logger.info(f"Zombie found as {self._browser_pid}")
