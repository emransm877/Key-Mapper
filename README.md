# Key Mapper

Chrome extension for the **agent** side of the SuperAnnotate paired call test. The customer side is [Call Test Agent](https://github.com/antor1686/Call-Test-Agent).

## What it does
- **Auto-accept:** clicks `Accept`, `Connect` and `Run <tool>` buttons as they appear. It highlights them first, then clicks after 0.7 s. **Alt+Shift+A** turns auto-click on and off. **Enter** (or **Ctrl+Enter** while typing) clicks the highlighted button by hand.
- **Follow the caller:** when you're idle (no call, upload or button for *Idle minutes*, default 3), it checks which item your caller's Call Test Agent is on. If that item is different, it opens the item dropdown, searches for that item, opens it, and sets the status dropdown to **AgentInCall**.

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
3. Test it: while the caller is on an item, click **Switch to caller's item now**.

If the item or status dropdown isn't found, click **Item dropdown** or **Status dropdown** under **Teach**, then click the real dropdown on the page once.

## For the maintainer
Ship an update: change the code, **raise `version` in `manifest.json`**, and push to `main`. Users see **NEW** on the icon and click **Update now**.

## Follow-caller freshness and checks

Version 2.0.2 matches the caller's customer task to the corresponding agent task for the same scenario, including different company prefixes. The known `_customer_pc01` and `_agent_tp01` style suffixes are role/task IDs, not part of the scenario identity. It chooses only one matching agent-side dropdown option; if multiple variants match, it does not guess. Switch completion requires the actual editor selection to change. Embedded call headings cannot overwrite a fresh selected editor item, and call activity cancels an item/status switch that is still waiting for a dropdown.

After updating or reloading the extension, refresh the work page to replace old content scripts. If the popup asks you to refresh the work page, its selected-item heartbeat has not reached the extension yet. The caller's existing 1.4.1 broadcast remains compatible; no new caller update is required for this role-matching fix.

Key Mapper expects the caller's current-item heartbeat at least once a minute. It only follows ntfy messages received by the relay within the last two minutes, using the relay timestamp so different caller computer clocks do not matter. If the caller closes the page or stops broadcasting, an old item is not used indefinitely. The caller integration was merged in [Call Test Agent PR #1](https://github.com/antor1686/Call-Test-Agent/pull/1) and is available in upstream version 1.4.1.

Keep one active caller work tab per topic. Multiple caller tabs publishing different items to the same topic can replace each other's current item.

Run `node --test tests/regressions.test.cjs tests/native-host.test.cjs tests/item-follow.test.cjs` for local regressions. These use synthetic page and relay data; the native messaging frame test runs on Windows. They do not prove the real site's dropdown selectors or a complete paired call. Test item selection and `AgentInCall` on the authorized live page before leaving auto-follow unattended.

The Windows updater downloads this repository's `main` source, not a GitHub Actions artifact. It runs only when you click Update now. Linux/macOS users can pull the repository and reload the unpacked extension; the Windows native helper is not portable.
