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
