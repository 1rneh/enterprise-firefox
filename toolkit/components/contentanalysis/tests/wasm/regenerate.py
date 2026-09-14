#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""Rebuild the test DLP wasm module and refresh the checked-in copy.

Run this after changing anything under this directory:

    python3 toolkit/components/contentanalysis/tests/wasm/regenerate.py

Requires a Rust toolchain with the wasm32-unknown-unknown target:

    rustup target add wasm32-unknown-unknown

Pass --check to verify the checked-in binary matches a fresh build without
overwriting it (exits non-zero if it does not).
"""

import argparse
import hashlib
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TARGET = "wasm32-unknown-unknown"
CRATE_NAME = "content_analysis_test_wasm"
# Where the xpcshell tests load it from, as a support-file.
CHECKED_IN = HERE.parent / "xpcshell" / "content_analysis_wasm.wasm"


def build() -> Path:
    subprocess.run(
        ["cargo", "build", "--release", "--target", TARGET],
        cwd=HERE,
        check=True,
    )
    built = HERE / "target" / TARGET / "release" / f"{CRATE_NAME}.wasm"
    if not built.is_file():
        raise SystemExit(f"expected build output at {built}, but it is missing")
    return built


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify the checked-in binary is up to date instead of rewriting it",
    )
    args = parser.parse_args()

    built = build()
    built_digest = hashlib.sha256(built.read_bytes()).hexdigest()

    if args.check:
        if not CHECKED_IN.is_file():
            print(f"{CHECKED_IN} is missing; run this script without --check")
            return 1
        current = hashlib.sha256(CHECKED_IN.read_bytes()).hexdigest()
        if current != built_digest:
            print(
                f"{CHECKED_IN} is out of date.\n"
                f"  checked in: {current}\n"
                f"  rebuilt:    {built_digest}\n"
                "Run this script without --check to update it."
            )
            return 1
        print(f"{CHECKED_IN.name} is up to date ({built_digest[:12]}).")
        return 0

    shutil.copyfile(built, CHECKED_IN)
    size = CHECKED_IN.stat().st_size
    print(f"Wrote {CHECKED_IN} ({size} bytes, sha256 {built_digest[:12]}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
