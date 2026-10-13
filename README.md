# Firefox Enterprise

<img src="./docs/readme/fxe-banner.png" alt="Firefox Enterprise browser" />

[Firefox Enterprise](https://www.firefox.com/en-US/enterprise/) is a browser for organizations with strict security, governance and compliance requirements.
It's built upon Firefox, powered by the Gecko engine, with a management console that runs on your own infrastructure, so you decide where your data, policies and management live.

This repository contains the source code for the Firefox Enterprise browser.

## Why Firefox Enterprise

- **More control:** the Admin Console runs on your infrastructure.
- **More transparency:** the browser is open source, so you can see how it handles data.
- **More choice:** it works with your existing identity provider, SIEM and MDM, with no ecosystem lock-in.
- **More resilience:** Gecko is the only major browser engine developed outside Google and Apple, which adds browser diversity and reduces shared failure risk.

## Features

- Company sign-in with your organization's SSO (any OpenID Connect provider)
- Built-in data loss prevention (DLP) agent to warn about or block sensitive data actions by domain
- Device posture checks to report the security posture of each device to your Admin Console
- Lockdown Mode for high-risk or restricted browsing
- Watermarking across sensitive pages, according to admin configuration
- Identity-based access to internal apps for employees, contractors and BYOD users

## Resources

- [Introducing Firefox Enterprise](https://blog.mozilla.org/en/firefox/introducing-firefox-enterprise/)
- [Release notes](https://www.firefox.com/en-US/firefox/enterprise/notes/)
- [Professional Support](https://www.firefox.com/en-US/enterprise/firefox-professional-support/)
- [Request a demo or contact sales](https://www.firefox.com/en-US/enterprise/contact/)

Firefox Enterprise is built to help organizations meet regulatory requirements such as DORA, GDPR, NIS2, ISO 27001 and SOC 2. See the [Trust Center](https://www.firefox.com/en-US/enterprise/trust-center/) for details.

## Developing

You should work from the `enterprise-main` branch, which is the repository default.
The `main` branch tracks upstream Firefox and will build without Enterprise features.

To get started, follow the [Firefox build setup instructions](https://firefox-source-docs.mozilla.org/setup/index.html) for your platform, and install the dependencies:

```bash
./mach bootstrap
```

### Build

Add the following line to your `.mozconfig` based on the platform you're developing for:

- macos (Apple Silicon): `. "$topsrcdir/build/macosx/mozconfig.enterprise"`
- macos (Intel): `. "$topsrcdir/build/mozconfig.common.enterprise"`
- unix: `. "$topsrcdir/build/unix/mozconfig.enterprise"`
- win64: `. "$topsrcdir/build/win64/mozconfig.enterprise"`

The platform files source `build/mozconfig.common.enterprise`, which enables `--enable-enterprise` and the reporting used for security logging.
Now you can run a build:

```bash
./mach build
```

### Run

Firefox Enterprise signs in through an Admin Console.
To run a local build without one, set `MOZ_BYPASS_FELT=1`, which starts the browser UI without console sign-in:

```bash
MOZ_BYPASS_FELT=1 ./mach run
```

The bypass only works on local development builds.
If you have access to an Admin Console, run `./mach run` and enter its address when prompted, or set it with `MOZ_ENTERPRISE_CONSOLE_URL`.
