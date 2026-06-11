#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

import os
import sys

sys.path.append(os.path.dirname(__file__))

from base_test import Environment
from felt_tests import FeltTests


class FeltConsoleErrorBase(FeltTests):
    def check_error_bar_message(
        self,
        console_addr,
        selector,
        expected_heading,
        error_msg=None,
        error_msg_contains=None,
        screenshot_name=None,
    ):
        with self._driver.using_prefs(
            {
                "enterprise.console.address": console_addr
                or f"http://localhost:{self.console_port}"
            },
            default_branch=True,
        ):
            if console_addr:
                self.submit_email()

            self.assert_error_bar_message(
                selector=selector,
                expected_heading=expected_heading,
                error_msg=error_msg,
                error_msg_contains=error_msg_contains,
                screenshot_name=screenshot_name,
            )

    def assert_error_bar_message(
        self,
        selector,
        expected_heading,
        error_msg=None,
        error_msg_contains=None,
        screenshot_name=None,
        source=None,
    ):
        if not screenshot_name:
            screenshot_name = self._testMethodName

        self._driver.set_context("chrome")

        self._logger.info(f"Checking selector: {selector}")
        error = self.get_elem(selector)
        message = self._wait.until(
            lambda d: (
                h.strip()
                if (h := error.get_attribute("heading"))
                and expected_heading in h.strip()
                else False
            )
        )
        assert expected_heading in message, f"Unexpected error message: {message}"

        if source:
            source_attribute = self._wait.until(
                lambda d: (
                    h.strip()
                    if (h := error.get_attribute("source")) and source in h.strip()
                    else False
                )
            )
            assert source in source_attribute, (
                f"Error element is missing the {source} attribute. Found: {source_attribute}"
            )

        if error_msg is not None:
            details = self.get_elem(f"{selector} .felt-browser-error-details")
            details_text = details.get_property("textContent").strip()
            assert details_text == error_msg, (
                f"Unexpected error message: '{details_text}' expected: '{error_msg}'"
            )

        if error_msg_contains is not None:
            details = self.get_elem(f"{selector} .felt-browser-error-details")
            details_text = details.get_property("textContent").strip()
            assert error_msg_contains in details_text, (
                f"Expected '{error_msg_contains}' in error details: '{details_text}'"
            )

        self.maybe_save_screenshot(Environment.FELT, screenshot_name)

        self._driver.set_context("content")

    def get_brand_name(self):
        app_name = self._driver.session_capabilities.get("browserName")
        brand = None
        if app_name == "firefox":
            brand = "Firefox Enterprise"
        elif app_name == "thunderbird":
            brand = "Thunderbird Enterprise"
        else:
            assert False, f"Unsupported app {app_name}"
        return brand
