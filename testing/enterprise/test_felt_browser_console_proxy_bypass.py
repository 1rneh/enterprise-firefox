#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

import os
import sys

sys.path.append(os.path.dirname(__file__))

from felt_tests import FeltTests
from marionette_driver.errors import UnknownException

# Loopback is proxy-exempt by default, so alias a non-localhost domain to the
# local test server with `network.dns.localDomains` so the proxy to attempts to resolve.
CONSOLE_TEST_HOST = "console.test"


class FeltBrowserConsoleProxyBypass(FeltTests):
    def test_console_reachable_through_broken_proxy(self):
        self.run_felt_base()
        self.connect_child_browser()

        console_base = f"http://{CONSOLE_TEST_HOST}:{self.console_port}/"
        self._configure_broken_proxy(console_base, "proxy.invalid", 9999)

        # Ensure the broken proxy config is applied and that it breaks normal requests
        with self.assertRaisesRegex(
            UnknownException,
            r"Reached error page: about:neterror\?e=proxyResolveFailure",
        ):
            self.open_tab_child("http://example.com/")

        self._load_child_page_ok(f"{console_base}ping", "Pong!")

    def _configure_broken_proxy(self, console_address, proxy_host, proxy_port):
        self._logger.info(
            f"Pointing console at {console_address}, "
            f"configuring broken proxy {proxy_host}:{proxy_port}"
        )
        self._child_driver.set_prefs({
            "network.dns.localDomains": CONSOLE_TEST_HOST,
            "enterprise.console.address": console_address,
            "network.proxy.type": 1,
            "network.proxy.http": proxy_host,
            "network.proxy.http_port": proxy_port,
        })

    def _load_child_page_ok(self, url, expected_title):
        self._logger.info(f"Loading {url}, expecting title {expected_title!r}")
        self.open_tab_child(url)
        self._child_longwait.until(lambda d: len(d.title) > 0)
        found_title = self._child_driver.title
        assert found_title == expected_title, (
            f"Expected '{expected_title}', found '{found_title}'"
        )
