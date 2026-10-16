# Ollama Verification Checklist for the Windows EXE

Exact steps to verify Ollama readiness detection in the Windows executable (served from `http://127.0.0.1:50505`):

1. **Ollama running + Offline mode ON -> Document tab Ollama Ready**
   - Start Ollama service on your computer (`ollama serve` or Ollama desktop app).
   - Launch MAKAN Translate Windows exe.
   - Switch Offline mode ON (click the Offline button in the top bar).
   - Open the **Document** tab.
   - Check the **Translate with** engine dropdown: Ollama should be listed with installed models and display **Ready** (not "Needs Ollama running" or "Ollama is not running").

2. **Ollama running + Offline mode OFF -> Ready**
   - Switch Offline mode OFF.
   - On the **Document** tab, inspect the Ollama option in the **Translate with** dropdown: it remains **Ready**.

3. **Quit Ollama -> message names the address tried**
   - Stop / quit Ollama completely.
   - In the Document tab with Ollama selected, drop a test text or docx file and click **Translate file**.
   - Notice the status line under progress: it must report that Ollama could not be reached and explicitly list the addresses tried (e.g. `http://localhost:11434, http://127.0.0.1:11434`), rather than silently failing or showing a generic error.

4. **Start Ollama again, click back into app window -> becomes Ready within a few seconds without restarting the exe**
   - Start Ollama again.
   - Click back into the MAKAN Translate app window (window focus / visibility trigger).
   - Within 5 seconds, without reloading or restarting the exe, the Document picker refreshes and displays the models as **Ready**.

5. **Load a big model then immediately open Document tab -> shows timeout message or Ready, never "not running"**
   - In a terminal, trigger a large model load (e.g. `ollama run <12b-model>` or a heavy model).
   - Immediately open the Document tab in MAKAN Translate.
   - The status should either display **Ready** or "Ollama did not answer in time (it may be busy loading a model). Wait a moment and try again." It must never mistakenly report "Ollama is not running".
