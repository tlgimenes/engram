import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { StarCount } from "./StarCount";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows the star count once the fetch resolves", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: 42 }),
    }),
  );

  render(<StarCount />);

  await waitFor(() => expect(screen.getByText("★ 42")).toBeInTheDocument());
});

test("renders nothing if the fetch fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

  const { container } = render(<StarCount />);

  await waitFor(() => expect(container).toBeEmptyDOMElement());
});
