import { afterEach, describe, expect, it, vi } from "vitest";

import {
  escapeHtml,
  formatDate,
  initials,
  participantListMarkup,
  requestJson,
} from "./main.js";


afterEach(() => {
  vi.useRealTimers();
});


describe("front-end formatting", () => {
  it("formats database dates without a timezone shift", () => {
    expect(formatDate("2026-09-15")).toBe("September 15, 2026");
  });

  it("creates compact participant initials", () => {
    expect(initials("Alexandra Morgan")).toBe("AM");
    expect(initials("  Prince  ")).toBe("P");
  });

  it("escapes untrusted values before inserting them into markup", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });
});


describe("participant list rendering", () => {
  it("renders participant information and escapes API values", () => {
    const markup = participantListMarkup([
      {
        id: 27,
        name: "<Alex> Morgan",
        email: "alex@example.com",
        registeredAt: "2026-07-23",
      },
    ]);

    expect(markup).toContain("&lt;Alex&gt; Morgan");
    expect(markup).not.toContain("<Alex>");
    expect(markup).toContain("#/registrations/27");
    expect(markup).toContain("July 23, 2026");
  });

  it("renders distinct empty and filtered states", () => {
    expect(participantListMarkup([])).toContain("The starting line is open");
    expect(participantListMarkup([], true)).toContain("No participants found");
  });
});


describe("API client", () => {
  it("sends JSON requests and returns parsed data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({
        registration: { id: 42, name: "Alex Morgan" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestJson("/api/registrations", {
      method: "POST",
      body: JSON.stringify({
        name: "Alex Morgan",
        email: "alex@example.com",
        phone: "+44 7700 900000",
      }),
    });

    expect(result.registration.id).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/registrations",
      expect.objectContaining({
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("surfaces server validation fields to the form layer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: vi.fn().mockResolvedValue({
          error: {
            message: "Please correct the highlighted fields.",
            fields: { email: "Enter a valid email address." },
          },
        }),
      }),
    );

    await expect(
      requestJson("/api/registrations", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    ).rejects.toMatchObject({
      message: "Please correct the highlighted fields.",
      status: 422,
      fields: { email: "Enter a valid email address." },
    });
  });

  it("returns null for successful cancellation responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );

    await expect(
      requestJson("/api/registrations/42", { method: "DELETE" }),
    ).resolves.toBeNull();
  });
});
