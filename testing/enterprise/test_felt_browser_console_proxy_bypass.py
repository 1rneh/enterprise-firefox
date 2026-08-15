#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

import os
import sys

sys.path.append(os.path.dirname(__file__))

from felt_tests import FeltTests
from marionette_driver.errors import UnknownException


class FeltBrowserConsoleProxyBypass(FeltTests):
    def test_console_reachable_through_broken_proxy(self):
        self.run_felt_base()
        self.connect_child_browser()

        self._configure_broken_proxy("proxy.invalid", 9999)

        with self.assertRaisesRegex(
            UnknownException,
            r"Reached error page: about:neterror\?e=proxyResolveFailure",
        ):
            self.open_tab_child("http://example.com/")

        # The console host is loopback in this harness; it loads only because the
        # bypass filter forces a direct connection despite the broken proxy.
        console_base = f"http://localhost:{self.console_port}/"
        self._load_child_page_ok(f"{console_base}ping", "Pong!")

    def _configure_broken_proxy(self, proxy_host, proxy_port):
        self._logger.info(f"Configuring broken proxy {proxy_host}:{proxy_port}")
        self._child_driver.set_prefs({
            # Loopback is proxy-exempt by default, which would hide the bypass;
            # route it through the proxy so the filter's effect is observable.
            "network.proxy.allow_hijacking_localhost": True,
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
