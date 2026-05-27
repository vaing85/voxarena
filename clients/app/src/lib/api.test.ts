import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, ApiError, API_BASE } from "./api";

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("api", () => {
  it("lists songs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeResponse({ songs: [{ id: "s1", title: "Demo" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const songs = await api.listSongs();
    expect(songs).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/songs`, expect.anything());
  });

  it("throws ApiError with the server status on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse({ error: "nope" }, false, 404)));
    await expect(api.listSongs()).rejects.toMatchObject({ status: 404 });
    await expect(api.listSongs()).rejects.toBeInstanceOf(ApiError);
  });

  it("posts audio as multipart with the dev identity header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ performance: { id: "p1" } }));
    vi.stubGlobal("fetch", fetchMock);

    await api.scoreAudio("player-1", "song-1", "solo_practice", new Blob(["x"]));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/performances/audio`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers["x-player-id"]).toBe("player-1");
    // multipart boundary must be set by the browser, not us
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("builds the leaderboard query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ leaderboard: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await api.leaderboard("song-1", 5);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/leaderboard?songId=song-1&limit=5`);
  });
});
