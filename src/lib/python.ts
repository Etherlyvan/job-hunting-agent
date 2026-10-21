import { execFile } from "node:child_process";
import { PublicError } from "./security";
export function pythonCheck(
  operation: "guard" | "pdf",
  data: unknown,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      /*turbopackIgnore: true*/
      process.env.PYTHON_COMMAND ??
        (process.platform === "win32" ? "python" : "python3"),
      ["tools/agent_bridge.py", operation],
      { timeout: 15000, maxBuffer: 1000000, windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(
            new PublicError(
              "Local verification failed. Install Python and requirements-web.txt; check document page limits and text encoding.",
              422,
            ),
          );
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new PublicError("Invalid local verification result.", 500));
        }
      },
    );
    child.stdin?.on("error", () => {});
    child.stdin?.end(JSON.stringify(data));
  });
}
