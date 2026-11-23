# Key Mapper

Chrome extension for the **agent** side of the paired call test. The customer side is [Call Test Agent](https://github.com/antor1686/Call-Test-Agent).

## What it does
- **Auto-accept:** clicks `Accept`, `Connect` and `Run <tool>` buttons as they appear. It highlights them first, then clicks after 0.7 s. **Alt+Shift+A** turns auto-click on and off. **Enter** (or **Ctrl+Enter** while typing) clicks the highlighted button by hand.
- **Follow the caller's company:** when you're idle (no call, upload or button for *Idle minutes*, default 1), it checks the company your caller is working on. If you're already in that company, your current assigned agent item stays selected. Otherwise it opens an available assigned agent item for that same company and sets **AgentInCall**. Exact task matching remains an optional mode.

The two extensions talk through a private [ntfy.sh](https://ntfy.sh) topic. The caller's extension posts its current item name there, and Key Mapper reads it. Nothing else is sent. Use a random topic: anyone who knows it can read the item names.

## Install (first time, Windows)
1. Press **Win + R**, paste this line and press Enter:
   ```
   powershell -ExecutionPolicy Bypass -c "iwr -useb https://raw.githubusercontent.com/emransm877/Key-Mapper/main/setup.ps1 | iex"
   ```
2. Chrome's extensions page opens. Turn on **Developer mode**, click **Load unpacked**, paste the folder path (already copied) and press Enter.
3. The window finishes by itself. Updates are now one click.

If Key Mapper is already loaded, the same command finds it and only turns on one-click updates.

## Set up the caller link
1. Key Mapper popup: click **Generate topic** (it's copied to your clipboard).
2. Your caller pastes the same topic in their Call Test Agent popup, in **Key Mapper topic**.
3. Select **Switch when → the company is different**. Test it while the caller is on an item by clicking **Switch to caller's company now**.

If the item or status dropdown isn't found, click **Item dropdown** or **Status dropdown** under **Teach**, then click the real dropdown on the page once.

## For the maintainer
Ship an update: change the code, **raise `version` in `manifest.json`**, and push to `main`. Users see **NEW** on the icon and click **Update now**.

## Follow-caller freshness and checks

Version 2.0.6 opens the live project's selector through its dedicated container, even when an older taught mapping points at the search input, and supports its textarea search control. Version 2.0.5 reads the site's dedicated selected-item and option-name fields. Placeholder, status-icon and tooltip text are not treated as part of the item name. Company following remains the default described below.

Version 2.0.4 follows **the company**, not the customer's numbered task. A company is the full key before the role/task suffix (for example, `demo_industry__company_a`); sharing the broad `demo_industry` prefix does not mean two tasks belong to the same company. In company mode, any available assigned agent task for that company is suitable, and an agent already in that company stays on their current item even when the customer changes task numbers. Fresh settings default to company mode; existing explicit mode settings are preserved, so select **the company is different** if needed.

The optional **exact task** mode still requires matching role/task IDs: `_customer_pc05` matches `_agent_pc05`, not another numbered variant. The extension cannot grant access to or assign an unavailable company/task. Switch completion requires the actual editor selection to change. Embedded call headings cannot overwrite a fresh selected editor item, and call activity cancels an item/status switch that is still waiting for a dropdown.

After updating or reloading the extension, refresh the work page to replace old content scripts. If the popup asks you to refresh the work page, its selected-item heartbeat has not reached the extension yet. The caller's existing 1.4.1 broadcast remains compatible; no new caller update is required for this role-matching fix.

Key Mapper expects the caller's current-item heartbeat at least once a minute. It only follows ntfy messages received by the relay within the last two minutes, using the relay timestamp so different caller computer clocks do not matter. If the caller closes the page or stops broadcasting, an old item is not used indefinitely. The caller integration was merged in [Call Test Agent PR #1](https://github.com/antor1686/Call-Test-Agent/pull/1) and is available in upstream version 1.4.1.

Keep one active caller work tab per topic. Multiple caller tabs publishing different items to the same topic can replace each other's current item.

Run `node --test tests/regressions.test.cjs tests/native-host.test.cjs tests/item-follow.test.cjs` for local regressions. These use synthetic page and relay data; the native messaging frame test runs on Windows. They do not prove the real site's dropdown selectors or a complete paired call. Test item selection and `AgentInCall` on the authorized live page before leaving auto-follow unattended.

The Windows updater downloads this repository's `main` source, not a GitHub Actions artifact. It runs only when you click Update now. Linux/macOS users can pull the repository and reload the unpacked extension; the Windows native helper is not portable.
