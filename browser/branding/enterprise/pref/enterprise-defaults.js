/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Note: The only preferences that should be set here are the ones 
 * that don't have a default in non-enterprise builds, 
 * but have a default in enterprise builds. Otherwise they should be set 
 * conditionally where they are set for other channels. 
 * Other exception is sets of preference that make sense to keep together 
 * */

pref("enterprise.log_level", "Error");

// On Enterprise we want to enforce updates so we force it
// Bug 2020768: Should those value be set/locked at runtime by FELT only
//              or is it fine to apply it to any enterprise build?
pref("app.update.auto", true);
pref("app.update.checkOnlyInstance.enabled", false);
pref("app.update.background.enabled", true);
pref("app.update.staging.enabled", true);
