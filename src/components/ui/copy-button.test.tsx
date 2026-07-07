import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "@/components/ui/copy-button";

describe("CopyButton", () => {
  it("writes the value to the clipboard and confirms", async () => {
    const user = userEvent.setup();
    // userEvent installs a clipboard stub during setup(); spy on it.
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    render(<CopyButton value="abc-123" label="Org ID" />);
    await user.click(screen.getByRole("button", { name: /copy org id/i }));

    expect(writeText).toHaveBeenCalledWith("abc-123");
    // Label flips to the confirmation state.
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });
});
