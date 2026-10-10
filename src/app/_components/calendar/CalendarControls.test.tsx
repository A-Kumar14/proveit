// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const refreshCalendar = vi.fn();
const disconnectCalendar = vi.fn();
vi.mock("@proveit/lib/api", () => ({ api: { refreshCalendar: () => refreshCalendar(), disconnectCalendar: () => disconnectCalendar() } }));

import { CalendarControls } from "./CalendarControls";

beforeEach(() => { refresh.mockReset(); refreshCalendar.mockReset().mockResolvedValue({ ok: true }); disconnectCalendar.mockReset().mockResolvedValue({ ok: true }); });
afterEach(cleanup);

describe("CalendarControls", () => {
  it("offers Connect while on the sample, with no Disconnect", () => {
    render(<CalendarControls connected={false} connectHref="/?connect=1" />);
    expect(screen.getByRole("link", { name: /Connect calendar/ }).getAttribute("href")).toBe("/?connect=1");
    expect(screen.queryByRole("button", { name: /Disconnect/ })).toBeNull();
  });

  it("refreshes the feed and re-renders the page", async () => {
    render(<CalendarControls connected connectHref="/?connect=1" />);
    await userEvent.click(screen.getByRole("button", { name: /Refresh calendar/ }));
    expect(refreshCalendar).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByText("Calendar refreshed.")).toBeTruthy();
  });

  it("explains why refresh did nothing on the sample calendar", async () => {
    refreshCalendar.mockRejectedValue(new Error("You're using the sample calendar. Connect yours to sync it."));
    render(<CalendarControls connected={false} connectHref="/?connect=1" />);
    await userEvent.click(screen.getByRole("button", { name: /Refresh calendar/ }));
    expect(await screen.findByText(/sample calendar/)).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("disconnects", async () => {
    render(<CalendarControls connected connectHref="/?connect=1" />);
    await userEvent.click(screen.getByRole("button", { name: /Disconnect/ }));
    expect(disconnectCalendar).toHaveBeenCalled();
    expect(await screen.findByText(/Showing the sample again/)).toBeTruthy();
  });
});
